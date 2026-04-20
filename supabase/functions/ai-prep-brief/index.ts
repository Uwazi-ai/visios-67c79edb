// Generates a 3-4 sentence AI prep brief for a booking and stores it on
// bookings.prep_brief. Can be called publicly with a bookingId (it only
// reveals the brief to org members via the bookings RLS).
import { corsHeaders, jsonResponse, adminClient } from "../_shared/google.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { bookingId } = await req.json();
    if (!bookingId) return jsonResponse({ error: "bookingId required" }, 400);
    const admin = adminClient();
    const { data: b } = await admin
      .from("bookings")
      .select("id, invitee_name, invitee_email, intake_data, start_at, event_type_id, prep_brief")
      .eq("id", bookingId)
      .maybeSingle();
    if (!b) return jsonResponse({ error: "Booking not found" }, 404);
    if (b.prep_brief) return jsonResponse({ ok: true, brief: b.prep_brief, cached: true });

    const { data: et } = await admin
      .from("event_types")
      .select("name, description")
      .eq("id", b.event_type_id ?? "")
      .maybeSingle();

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return jsonResponse({ error: "LOVABLE_API_KEY missing" }, 500);

    const intakeStr = b.intake_data && Object.keys(b.intake_data).length
      ? JSON.stringify(b.intake_data, null, 2)
      : "(no intake provided)";

    const prompt = `You are preparing a brief for an upcoming meeting. Write 3-4 concise sentences (no headers, no bullets) covering: who the invitee likely is based on their email domain, why they probably booked, and 1-2 sharp talking points or questions to lead with.

Invitee: ${b.invitee_name} <${b.invitee_email}>
Event type: ${et?.name ?? "Meeting"} — ${et?.description ?? ""}
When: ${b.start_at}
Intake answers:
${intakeStr}`;

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are a sharp executive assistant. Be specific, never generic." },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (r.status === 429) return jsonResponse({ error: "Rate limited, try again later" }, 429);
    if (r.status === 402) return jsonResponse({ error: "AI credits exhausted" }, 402);
    const data = await r.json();
    if (!r.ok) return jsonResponse({ error: `AI failed: ${JSON.stringify(data)}` }, 500);
    const brief: string = data?.choices?.[0]?.message?.content?.trim() ?? "";
    if (brief) {
      await admin.from("bookings").update({ prep_brief: brief }).eq("id", bookingId);
    }
    return jsonResponse({ ok: true, brief });
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
