import { ANY_ORG } from "@/lib/AppState";

/**
 * Inbox — the thread is context; the draft is the work.
 *
 * A draft written by an agent is not a message. It is a proposal that
 * happens to be shaped like one, which is exactly why it needs a visible
 * edge: dashed until a person sends it, solid after. Replace with:
 *   select … from email_threads join email_drafts on draft.thread_id = …
 * Keep `draft` a separate row from `messages` — merging them at write time
 * is how an unsent draft ends up rendered as sent mail.
 */

export interface Message {
  from: string;
  initials: string;
  at: string;
  body: string;
  /** true when it is you in the thread already. */
  mine?: boolean;
}

export interface Draft {
  /** Why Kova wrote this one, in the user's terms. */
  because: string;
  subject: string;
  body: string;
  /** Everything the send would touch. Named before, not after. */
  reach: string;
}

export interface Thread {
  id: string;
  org: string;
  subject: string;
  with: string;
  initials: string;
  at: string;
  preview: string;
  unread: boolean;
  messages: Message[];
  draft: Draft;
}

export const THREADS: Thread[] = [
  {
    id: "t-kauffman",
    org: "uwazi",
    subject: "Kauffman — civic data pilot, next steps",
    with: "Renée Alvarez",
    initials: "RA",
    at: "9:12 AM",
    preview: "Can you get us the ownership model in writing before the 5th?",
    unread: true,
    messages: [
      {
        from: "Renée Alvarez",
        initials: "RA",
        at: "Yesterday, 4:48 PM",
        body: "Good session on Tuesday. The committee liked the pilot but they want the residents-own-the-data part written down, not described. Can you get us the ownership model in writing before the 5th? Two pages is plenty.",
      },
      {
        from: "Myke",
        initials: "MY",
        at: "Yesterday, 6:02 PM",
        mine: true,
        body: "Yes. I'll pull it from the UWAZI governance doc and cut it to two pages.",
      },
      {
        from: "Renée Alvarez",
        initials: "RA",
        at: "9:12 AM",
        body: "One more thing — the committee will ask who holds the keys if UWAZI goes away. Please address that explicitly.",
      },
    ],
    draft: {
      because:
        "Renée asked twice for the ownership model in writing, and the Kauffman deadline is Sep 5 — four days out.",
      subject: "Re: Kauffman — civic data pilot, next steps",
      body: `Renée,

Attaching the two-page ownership model ahead of the 5th. It answers the succession question directly: the resident data trust holds the keys, not UWAZI. If UWAZI dissolves, the trust continues under its own board and the pilot data never changes hands.

Section 2 covers the deletion right, which the committee will likely ask about next.

Happy to walk the committee through it Thursday if that's useful.

Myke`,
      reach: "Sends to renee.alvarez@kauffman.org and CCs the two committee members already on the thread. One outbound email, no attachments generated — you attach the PDF.",
    },
  },
  {
    id: "t-cc-venue",
    org: "cc",
    subject: "October showcase — venue hold expires Friday",
    with: "Tasha Boyd",
    initials: "TB",
    at: "8:40 AM",
    preview: "They'll release the room if we don't confirm a headcount.",
    unread: true,
    messages: [
      {
        from: "Tasha Boyd",
        initials: "TB",
        at: "8:40 AM",
        body: "The Gem is holding Oct 18 for us but they'll release the room Friday if we don't confirm a headcount. Last year we did 140. Do we say 150 and eat the deposit if we're short?",
      },
    ],
    draft: {
      because:
        "The hold expires Friday and Tasha is waiting on a number, not an opinion.",
      subject: "Re: October showcase — venue hold expires Friday",
      body: `Tasha,

Confirm 150. Last year's 140 was with two weeks of promotion; we've had six this time and the mailing list is up 22% since March.

If we come in short the deposit is $600, which is inside the event budget line. Missing the room is not recoverable — there is no second venue at that capacity on the 18th.

Confirm today so we're not doing it on Friday afternoon.

Myke`,
      reach: "Sends to tasha@cultureclub.org only. Does not contact the venue — Tasha holds that relationship.",
    },
  },
  {
    id: "t-bin-mentor",
    org: "bin",
    subject: "Mentor intake — 11 applications sitting unreviewed",
    with: "BIN Ops",
    initials: "BO",
    at: "Tue",
    preview: "Oldest has been waiting 19 days.",
    unread: false,
    messages: [
      {
        from: "BIN Ops",
        initials: "BO",
        at: "Tue, 11:20 AM",
        body: "Eleven mentor applications are unreviewed. Oldest has been waiting 19 days. We told applicants seven.",
      },
    ],
    draft: {
      because: "You promised a seven-day review and the oldest is at 19. Silence is the damage here, not the backlog.",
      subject: "Your BIN mentor application — where it stands",
      body: `Thanks for applying to mentor with the Black Innovators Network.

We said seven days and we are past that. Your application is in the queue and will get a decision by Sep 8. That is a commitment, not an estimate.

No action needed from you in the meantime.

— BIN`,
      reach: "Sends to 11 applicants as separate messages. This is the only draft on this screen that reaches people who did not email you.",
    },
  },
  {
    id: "t-raia-wire",
    org: ANY_ORG,
    subject: "Bank — verify the new payee before Thursday",
    with: "First Interstate",
    initials: "FI",
    at: "Mon",
    preview: "Two-step verification required for the new vendor.",
    unread: false,
    messages: [
      {
        from: "First Interstate",
        initials: "FI",
        at: "Mon, 2:15 PM",
        body: "A new payee was added to your business account. Verify by phone before any transfer clears.",
      },
    ],
    draft: {
      because: "It is a bank notice about money movement. Kova wrote a holding reply and nothing else.",
      subject: "Re: Verify the new payee",
      body: `Acknowledged. I will verify by phone using the number on the back of the card, not a number in this email.

Myke`,
      reach: "One reply to the bank's no-reply address. Kova cannot move money and did not draft anything that would.",
    },
  },
];
