/**
 * Colour values in state are token references ("var(--ws-uwazi)") until the
 * user overrides one, at which point they are a literal hex from the native
 * picker. Both are valid CSS, so every render path just works — but
 * <input type="color"> accepts nothing except #rrggbb, so it needs the
 * resolved value.
 *
 * Resolution happens against the live document rather than a lookup table:
 * the tokens are theme-scoped, and a hardcoded map would drift the first
 * time a token changes in tokens.css.
 */

const toHex = (n: number) => n.toString(16).padStart(2, "0");

/** Fallback only reached if the browser hands back something unparseable. */
const FALLBACK = "#2563EB";

export function resolveHex(value: string): string {
  if (/^#[0-9a-f]{6}$/i.test(value)) return value;
  if (typeof document === "undefined") return FALLBACK;

  const probe = document.createElement("span");
  probe.style.color = value;
  probe.style.display = "none";
  document.body.appendChild(probe);
  const computed = getComputedStyle(probe).color;
  probe.remove();

  const m = computed.match(/\d+/g);
  if (!m || m.length < 3) return FALLBACK;
  return `#${toHex(+m[0])}${toHex(+m[1])}${toHex(+m[2])}`;
}
