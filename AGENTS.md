# Architecture rules
- Keep legacy Vision route, component, table, persona keys, and API identifiers stable during identity changes; only presentation labels and prompt wording change to avoid breaking stored data and integrations.
- Compose client assistant prompts with the shared voice module and mirror that contract in the server chat helper; server persona copy is normalized at read time so existing persona records retain their keys and permissions.
- Start Google OAuth only through src/lib/googleOAuth.ts startGoogleOAuth: Google blocks framing, so framed (editor preview) sessions open Google in a new tab that hands the session back to its same-origin opener and closes; the fresh-tab sign-out rule must exempt OAuth return loads.
