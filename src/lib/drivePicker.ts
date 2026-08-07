/**
 * Google Picker. The user picks in Google's own UI, which grants Kova access to
 * that file alone — drive.file, not drive.readonly. Kova never builds its own
 * Drive browser: the Picker already has search, recents and shared drives.
 *
 * Picker needs a browser API key and OAuth client id at build time. When they
 * are absent the caller degrades to pasting a link rather than showing a broken
 * button.
 */

const PICKER_KEY = import.meta.env.VITE_GOOGLE_PICKER_KEY as string | undefined;
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

export const pickerConfigured = () => Boolean(PICKER_KEY && CLIENT_ID);

export type PickedFile = { id: string; name: string; mimeType: string; url: string };

declare global {
  interface Window {
    gapi?: any;
    google?: any;
  }
}

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

async function ensurePicker() {
  await loadScript("https://apis.google.com/js/api.js");
  await loadScript("https://accounts.google.com/gsi/client");
  await new Promise<void>((resolve) => window.gapi.load("picker", () => resolve()));
}

async function getToken(): Promise<string> {
  return new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: "https://www.googleapis.com/auth/drive.file",
      callback: (res: { access_token?: string; error?: string }) =>
        res.access_token ? resolve(res.access_token) : reject(new Error(res.error ?? "No token")),
    });
    client.requestAccessToken({ prompt: "" });
  });
}

export async function openDrivePicker(): Promise<PickedFile[] | null> {
  if (!pickerConfigured()) throw new Error("Google Picker is not configured for this deployment.");
  await ensurePicker();
  const token = await getToken();

  return new Promise((resolve) => {
    const view = new window.google.picker.DocsView(window.google.picker.ViewId.DOCS)
      .setIncludeFolders(true)
      .setSelectFolderEnabled(false);

    const picker = new window.google.picker.PickerBuilder()
      .setOAuthToken(token)
      .setDeveloperKey(PICKER_KEY)
      .addView(view)
      .enableFeature(window.google.picker.Feature.SUPPORT_DRIVES)
      .enableFeature(window.google.picker.Feature.MULTISELECT_ENABLED)
      .setCallback((data: any) => {
        if (data.action === window.google.picker.Action.PICKED) {
          resolve(
            (data.docs ?? []).map((d: any) => ({
              id: d.id,
              name: d.name,
              mimeType: d.mimeType,
              url: d.url,
            })),
          );
        } else if (data.action === window.google.picker.Action.CANCEL) {
          resolve(null);
        }
      })
      .build();

    picker.setVisible(true);
  });
}
