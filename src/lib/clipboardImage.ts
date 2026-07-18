// Helpers for copying order photos to the clipboard alongside POS text.
// Chrome's ClipboardItem only reliably accepts image/png, so JPEG/data-URL
// photos are re-encoded to PNG via a canvas before being written.

export function photoToPngBlob(dataUrl: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Canvas 2D context unavailable'));
      ctx.drawImage(img, 0, 0);
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to encode PNG'));
      }, 'image/png');
    };
    img.onerror = () => reject(new Error('Failed to load photo'));
    img.src = dataUrl;
  });
}

function clipboardItemSupported(): boolean {
  return typeof ClipboardItem !== 'undefined' && !!navigator.clipboard?.write;
}

// Copy text + photo together. Returns whether the image was placed on the
// clipboard (false when unsupported or encoding failed — caller should then
// copy text-only and prompt the user to use the Copy Photo button).
export async function copyTextAndPhoto(
  text: string,
  photo?: string | null
): Promise<{ imageCopied: boolean }> {
  if (!photo || !clipboardItemSupported()) {
    await navigator.clipboard.writeText(text);
    return { imageCopied: false };
  }

  try {
    const pngBlob = await photoToPngBlob(photo);
    const item = new ClipboardItem({
      'text/plain': new Blob([text], { type: 'text/plain' }),
      'image/png': pngBlob,
    });
    await navigator.clipboard.write([item]);
    return { imageCopied: true };
  } catch {
    // Image encode/write failed — fall back to text only.
    await navigator.clipboard.writeText(text);
    return { imageCopied: false };
  }
}

// Copy just the photo (PNG). Throws if unsupported so the caller can surface
// a fallback (e.g. open the image in a new tab).
export async function copyPhotoOnly(photo: string): Promise<void> {
  if (!clipboardItemSupported()) {
    throw new Error('Clipboard image copy unsupported in this browser');
  }
  const pngBlob = await photoToPngBlob(photo);
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })]);
}
