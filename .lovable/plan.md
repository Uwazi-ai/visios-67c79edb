## Overview

Add three features to Visi OS, matching the existing dark glass design system:

1. **My Digital Card** — public shareable profile at `/card/:username` + editor at `/settings/my-card`
2. **Business Card Scanner** — camera capture on Contacts page that uses AI vision to auto-create contacts
3. **PWA Setup** — make Visi OS installable on mobile/desktop

## Important deviations from spec (and why)

- **Profiles table already exists** (with `id = auth.users.id`, `username`, `avatar_url`, `display_name`). I will **extend** it via migration with the missing fields (`title`, `company`, `primary_org_id`, `tagline`, `phone`, `linkedin_url`, `website_url`, `card_theme`, `custom_links`) instead of recreating it. Also adding a public-read RLS policy scoped to rows where `username IS NOT NULL` (already exists — perfect for the public card route).
- **AI vision** for card scanning will use the **Lovable AI Gateway** (`google/gemini-2.5-flash` with image input) via a new edge function `scan-business-card`. We don't have an Anthropic key, and Lovable AI is the project standard.
- **PWA in Lovable preview**: per platform rules, the service worker will be guarded so it only registers in production (not in iframes / `id-preview--*` / `lovableproject.com` hosts). Otherwise the preview breaks with stale caches.
- **Contacts table** — already has `metadata jsonb`; I'll store the `source: 'card_scan'` flag inside `metadata` rather than adding a new column to keep the schema lean. (Spec asks for a column, but metadata avoids another migration and keeps types stable.)

## File plan

### Database (one migration)
- Add columns to `profiles`: `title`, `company`, `primary_org_id`, `tagline`, `phone`, `linkedin_url`, `website_url`, `card_theme`, `custom_links`, `website_url`. (Existing fields kept.)

### Feature 1 — Digital Card
- `src/pages/CardPublic.tsx` — public route, no auth, fetches profile by username, renders avatar/name/title/org pill/action buttons/custom links/QR. vCard generation via Blob.
- `src/pages/MyCardSettings.tsx` — editor with live phone-frame preview.
- `src/lib/vcard.ts` — vCard string builder + download helper.
- `src/components/card/CardPreview.tsx` — shared card render used in both public page and editor preview.
- Route adds in `src/App.tsx`: `/card/:username` (outside AppShell, public) and `/settings/my-card` (inside AppShell).

### Feature 2 — Business Card Scanner
- `src/components/contacts/CardScannerModal.tsx` — fullscreen camera modal (getUserMedia, capture, upload fallback, processing, review).
- `supabase/functions/scan-business-card/index.ts` — accepts base64 image, calls Lovable AI Gateway with vision prompt, returns parsed JSON. Public function (no JWT), CORS enabled.
- `supabase/config.toml` — register `scan-business-card` with `verify_jwt = false`.
- Wire into `src/pages/Contacts.tsx`: add "Scan Card" button, handle `?scan=true` query param to auto-open.
- After save: insert into `contacts` with `metadata.source = 'card_scan'` and a `contact_interactions` row (`type='note'`, `source='card_scan'`).

### Feature 3 — PWA
- `bun add qrcode @types/qrcode vite-plugin-pwa workbox-window`
- `vite.config.ts` — add VitePWA plugin (manifest disabled, link static manifest), with iframe-safe runtime caching.
- `public/manifest.json` — name/icons/shortcuts as specified.
- `public/icons/icon-192.png` and `icon-512.png` — generate via imagegen (dark bg #02020A with V mark, maskable safe zone).
- `public/offline.html` — dark fallback page.
- `index.html` — manifest link, apple meta tags, apple-touch-icon.
- `src/components/pwa/InstallBanner.tsx` — listens to `beforeinstallprompt`, iOS detection, 7-day localStorage dismiss, hidden when standalone.
- `src/main.tsx` — guarded SW registration (skip in iframe / preview hosts; unregister existing SWs there to be safe).
- `src/index.css` — add safe-area-inset padding utilities for top/bottom bars.

## Routing summary

```text
/card/:username           public  (new, outside AppShell)
/settings/my-card         auth    (new, inside AppShell)
/contacts                 auth    (existing, + Scan button + ?scan=true handling)
```

## Build order

1. Migration (extend `profiles`)
2. PWA infra (manifest, icons, vite plugin, guarded registration, install banner)
3. Card editor + public card page + vCard + QR
4. Card scanner modal + edge function + Contacts wiring

After each step I'll let the build hook validate. I'll generate the icons last so I don't block on imagegen.