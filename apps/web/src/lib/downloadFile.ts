/**
 * Forces a real download instead of an in-tab open. A blob: URL is always
 * same-origin, so the `download` attribute is honored reliably regardless of
 * where the underlying bytes came from — unlike a plain `<a href>` pointing
 * at a cross-origin URL (e.g. a presigned B2 link), which browsers silently
 * treat as a normal navigation instead of a download.
 */
export async function downloadBlob(fetchImage: () => Promise<Response>, filename: string): Promise<void> {
  const res = await fetchImage();
  if (!res.ok) throw new Error(`download failed (${res.status})`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
