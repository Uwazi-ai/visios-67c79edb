/**
 * Google product marks.
 *
 * These are vendor colours, not palette colours — the same category as an org's
 * identity colour, which is why they live here in src/data and never in
 * tokens.css. Nothing in Kova's own chrome may use them.
 */

export type DriveKind = "doc" | "sheet" | "slide" | "form" | "pdf" | "folder" | "file";

export const GOOGLE_MARKS: Record<DriveKind, string> = {
  doc: "#4285F4",
  sheet: "#0F9D58",
  slide: "#F4B400",
  form: "#7248B9",
  pdf: "#EA4335",
  folder: "#5F6368",
  file: "#5F6368",
};

export const DRIVE_LABEL: Record<DriveKind, string> = {
  doc: "Google Doc",
  sheet: "Google Sheet",
  slide: "Google Slides",
  form: "Google Form",
  pdf: "PDF",
  folder: "Drive folder",
  file: "Drive file",
};

export function driveKind(mime: string | null | undefined): DriveKind {
  const m = mime ?? "";
  if (m.includes("spreadsheet")) return "sheet";
  if (m.includes("presentation")) return "slide";
  if (m.includes("form")) return "form";
  if (m.includes("folder")) return "folder";
  if (m.includes("document")) return "doc";
  if (m === "application/pdf") return "pdf";
  return "file";
}

/** Types Vision can actually extract text from. Everything else is honest about it. */
const EXTRACTABLE = new Set([
  "application/vnd.google-apps.document",
  "application/vnd.google-apps.spreadsheet",
  "application/vnd.google-apps.presentation",
  "application/pdf",
  "text/plain",
  "text/csv",
  "text/markdown",
]);

export const visionCanRead = (mime: string | null | undefined) =>
  !!mime && (EXTRACTABLE.has(mime) || mime.startsWith("text/"));

export const isDriveUrl = (url: string) =>
  /^https:\/\/(docs|drive|sheets|slides)\.google\.com\/\S+/.test(url);

export function firstDriveUrl(text: string): string | null {
  const match = text.match(/https:\/\/(?:docs|drive|sheets|slides)\.google\.com\/\S+/);
  return match ? match[0] : null;
}
