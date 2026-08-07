/**
 * Kova notifications — the shared raise-an-event helper.
 *
 * Two rules are load-bearing:
 *  1. Never notify the actor about their own action.
 *  2. In-app is always on; email is opt-in per event type, defaulting to few.
 */

export type NotificationEventType =
  | "dm_received"
  | "mention"
  | "proposal_pending"
  | "proposal_expiring"
  | "task_assigned"
  | "task_due"
  | "meeting_soon"
  | "meeting_brief_ready"
  | "connection_failed"
  | "connection_expired"
  | "member_joined"
  | "quota_warning";

export type DeliveryMode = "off" | "immediate" | "digest";

/** Conservative by design: a user spammed once turns everything off forever. */
export const DEFAULT_EMAIL_MODE: Record<NotificationEventType, DeliveryMode> = {
  dm_received: "immediate",
  mention: "immediate",
  connection_failed: "immediate",
  connection_expired: "immediate",
  task_assigned: "immediate",
  quota_warning: "immediate",
  meeting_soon: "off",
  meeting_brief_ready: "off",
  member_joined: "off",
  proposal_pending: "digest",
  proposal_expiring: "digest",
  task_due: "digest",
};

/** Which surface each event belongs to — used for the "already saw it" rule. */
export const EVENT_SURFACE: Record<NotificationEventType, string> = {
  dm_received: "chat",
  mention: "chat",
  proposal_pending: "dashboard",
  proposal_expiring: "dashboard",
  task_assigned: "tasks",
  task_due: "tasks",
  meeting_soon: "calendar",
  meeting_brief_ready: "calendar",
  connection_failed: "connect",
  connection_expired: "connect",
  member_joined: "settings",
  quota_warning: "settings",
};

export interface NotifyInput {
  recipient_id: string;
  org_id?: string | null;
  event_type: NotificationEventType;
  title: string;
  body?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  deep_link: string;
  actor_id?: string | null;
}

/**
 * Raise a notification. Returns the event id, or null when suppressed.
 * `admin` must be a service-role Supabase client.
 */
export async function notify(admin: any, input: NotifyInput): Promise<string | null> {
  // 1. Never notify the actor about their own action.
  if (input.actor_id && input.actor_id === input.recipient_id) return null;

  // Demo orgs never generate deliverable notifications.
  if (input.org_id) {
    const { data: org } = await admin
      .from("orgs")
      .select("is_demo")
      .eq("id", input.org_id)
      .maybeSingle();
    if (org?.is_demo) return null;
  }

  // 2. Resolve preference: org override → global default → system default.
  const { data: prefs } = await admin
    .from("notification_preferences")
    .select("org_id,in_app,email")
    .eq("user_id", input.recipient_id)
    .eq("event_type", input.event_type);

  const orgPref = (prefs ?? []).find((p: any) => p.org_id === input.org_id);
  const globalPref = (prefs ?? []).find((p: any) => p.org_id === null);
  const resolved = orgPref ?? globalPref ?? null;

  const emailMode: DeliveryMode = resolved?.email ?? DEFAULT_EMAIL_MODE[input.event_type];

  // 3. In-app always lands — it costs nothing and is not interruptive.
  const { data: event, error } = await admin
    .from("notification_events")
    .insert({
      org_id: input.org_id ?? null,
      recipient_id: input.recipient_id,
      actor_id: input.actor_id ?? null,
      event_type: input.event_type,
      title: input.title,
      body: input.body ?? null,
      entity_type: input.entity_type ?? null,
      entity_id: input.entity_id ?? null,
      deep_link: input.deep_link,
    })
    .select("id")
    .single();

  if (error || !event) return null;

  // 4. Only 'immediate' creates a delivery row. Digest mode is picked up later.
  if (emailMode === "immediate") {
    await admin.from("notification_deliveries").insert({ event_id: event.id, channel: "email" });
  }

  return event.id;
}
