/**
 * Card — three cards, one per venture. Not one card with a venture
 * dropdown: switching changes the name, the role, the accent, the email
 * and the domain, because a Culture Club contact should never end up
 * holding a card that says UWAZI on it.
 *
 * Scan analytics answer the question a business card has never been able
 * to: which card someone opened, and where you handed it over.
 */

export interface DigitalCard {
  id: string;
  org: string;
  name: string;
  role: string;
  email: string;
  domain: string;
  phone: string;
  /** Rendered into the QR on the back, and shown under it in plain text. */
  url: string;
  tagline: string;
}

export const CARDS: DigitalCard[] = [
  {
    id: "c-uwazi",
    org: "uwazi",
    name: "Myke Bell",
    role: "Founder — UWAZI.AI",
    email: "myke@uwazi.ai",
    domain: "uwazi.ai",
    phone: "+1 816 555 0142",
    url: "https://uwazi.ai/card/myke",
    tagline: "Civic data that residents own.",
  },
  {
    id: "c-cc",
    org: "cc",
    name: "Myke Bell",
    role: "Managing partner — Culture Club",
    email: "myke@cultureclub.org",
    domain: "cultureclub.org",
    phone: "+1 816 555 0142",
    url: "https://cultureclub.org/card/myke",
    tagline: "Programming, venues, and the people who fill them.",
  },
  {
    id: "c-bin",
    org: "bin",
    name: "Myke Bell",
    role: "Convener — Black Innovators Network",
    email: "myke@bin.org",
    domain: "bin.org",
    phone: "+1 816 555 0142",
    url: "https://bin.org/card/myke",
    tagline: "Founders, mentors, and the room between them.",
  },
];

export interface Scan {
  /** Where you handed it over, not where the phone was. */
  place: string;
  /** How the card reached them. */
  via: "tap" | "qr" | "link";
  scans: number;
  /** Scans that led to a saved contact or a reply. */
  followed: number;
  when: string;
}

/** Keyed by card id — the analytics are per card, which is the whole point. */
export const SCANS: Record<string, Scan[]> = {
  "c-uwazi": [
    { place: "KC AI Club panel", via: "qr", scans: 34, followed: 11, when: "Jul 28" },
    { place: "Kauffman committee room", via: "tap", scans: 6, followed: 5, when: "Aug 26" },
    { place: "Email signature", via: "link", scans: 19, followed: 3, when: "ongoing" },
    { place: "Conference badge", via: "qr", scans: 12, followed: 1, when: "Aug 14" },
  ],
  "c-cc": [
    { place: "The Gem — showcase night", via: "tap", scans: 41, followed: 9, when: "Jul 19" },
    { place: "Artist intake form", via: "link", scans: 22, followed: 14, when: "ongoing" },
    { place: "Flyer QR, First Fridays", via: "qr", scans: 58, followed: 6, when: "Aug 1" },
  ],
  "c-bin": [
    { place: "Mentor mixer", via: "tap", scans: 27, followed: 18, when: "Aug 7" },
    { place: "Office hours page", via: "link", scans: 15, followed: 8, when: "ongoing" },
    { place: "Campus table", via: "qr", scans: 9, followed: 1, when: "Aug 21" },
  ],
};

export const VIA_LABEL: Record<Scan["via"], string> = {
  tap: "Tapped phone-to-phone",
  qr: "Scanned the QR",
  link: "Opened a link",
};

export const totals = (rows: Scan[]) => {
  const scans = rows.reduce((a, r) => a + r.scans, 0);
  const followed = rows.reduce((a, r) => a + r.followed, 0);
  return { scans, followed, rate: scans === 0 ? 0 : Math.round((followed / scans) * 100) };
};
