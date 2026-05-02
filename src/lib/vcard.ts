// Client-side vCard 3.0 generation + download helper. No backend required.

export interface VCardInput {
  name: string;
  title?: string | null;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  linkedin?: string | null;
}

function escape(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

export function buildVCard(input: VCardInput): string {
  const lines: string[] = ["BEGIN:VCARD", "VERSION:3.0"];
  lines.push(`FN:${escape(input.name)}`);
  if (input.company) lines.push(`ORG:${escape(input.company)}`);
  if (input.title) lines.push(`TITLE:${escape(input.title)}`);
  if (input.email) lines.push(`EMAIL;TYPE=WORK:${input.email}`);
  if (input.phone) lines.push(`TEL;TYPE=WORK:${input.phone}`);
  if (input.website) lines.push(`URL:${input.website}`);
  if (input.linkedin) lines.push(`URL;TYPE=LinkedIn:${input.linkedin}`);
  lines.push("NOTE:Connected via Visi OS");
  lines.push("END:VCARD");
  return lines.join("\r\n");
}

export function downloadVCard(input: VCardInput) {
  const vcf = buildVCard(input);
  const blob = new Blob([vcf], { type: "text/vcard;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const safeName = input.name.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "contact";
  a.download = `${safeName}.vcf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
