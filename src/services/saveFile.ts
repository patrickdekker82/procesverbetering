import { invoke, isTauri } from '@tauri-apps/api/core';

/**
 * Lets the user save a text file. In the app: native save dialog + Rust write. In a browser: a
 * normal download. Returns false when the user cancelled.
 */
export async function saveTextFile(
  defaultName: string,
  contents: string,
  mime = 'text/plain',
): Promise<boolean> {
  if (isTauri()) {
    const { save } = await import('@tauri-apps/plugin-dialog');
    const path = await save({ defaultPath: defaultName });
    if (!path) return false;
    await invoke('save_text_file', { path, contents });
    return true;
  }
  const url = URL.createObjectURL(new Blob([contents], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = defaultName;
  a.click();
  URL.revokeObjectURL(url);
  return true;
}

/** Saves binary data (e.g. a PNG export). Returns false when the user cancelled. */
export async function saveBinaryFile(defaultName: string, bytes: Uint8Array, mime: string): Promise<boolean> {
  if (isTauri()) {
    const { save } = await import('@tauri-apps/plugin-dialog');
    const path = await save({ defaultPath: defaultName });
    if (!path) return false;
    await invoke('save_binary_file', { path, contents: Array.from(bytes) });
    return true;
  }
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = defaultName;
  a.click();
  URL.revokeObjectURL(url);
  return true;
}
