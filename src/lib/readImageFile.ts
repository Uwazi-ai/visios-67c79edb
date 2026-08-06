/**
 * readImageFile — a chosen file becomes a data URL held in memory.
 *
 * There is no upload here and no persistence, on purpose. A settings screen
 * that writes the photo to localStorage and calls it saved is worse than one
 * that admits the truth: the user comes back tomorrow, the avatar is gone,
 * and they blame themselves for not clicking a save button that never existed.
 * The copy next to the picker says "this session only" because that is what
 * this function does.
 *
 * Swap for a storage upload later: the call site only needs a URL back.
 */

/** Above this a data URL starts to hurt render and memory for no gain. */
const MAX_BYTES = 25 * 1024 * 1024;

export interface ReadResult {
  url?: string;
  error?: string;
}

export function readImageFile(file: File): Promise<ReadResult> {
  if (!file.type.startsWith("image/")) {
    return Promise.resolve({ error: `${file.name} is not an image.` });
  }
  if (file.size > MAX_BYTES) {
    return Promise.resolve({
      error: `${file.name} is ${(file.size / 1024 / 1024).toFixed(1)} MB — keep it under 25 MB.`,
    });
  }
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ url: String(reader.result) });
    reader.onerror = () => resolve({ error: `Could not read ${file.name}.` });
    reader.readAsDataURL(file);
  });
}
