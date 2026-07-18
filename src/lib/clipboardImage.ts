// Helpers for copying order photos to the clipboard alongside POS text.
//
// Key insight: when a ClipboardItem offers both `image/png` and `text/plain`,
// rich editors (Word, Gmail, Outlook) pick the image MIME and silently drop
// the text. To get BOTH the details and the photo into one paste, we embed the
// photo as an inline <img> inside `text/html` and offer `text/plain` +
// `text/html` (no top-level image type). Rich editors render the HTML
// (details + inline image); plain-text targets get the details only.

export function photoToPngDataUrl(dataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Canvas 2D context unavailable'));
      ctx.drawImage(img, 0, 0);
      try {
        resolve(canvas.toDataURL('image/png'));
      } catch (err) {
        reject(err instanceof Error ? err : new Error('Failed to encode PNG'));
      }
    };
    img.onerror = () => reject(new Error('Failed to load photo'));
    img.src = dataUrl;
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function clipboardItemSupported(): boolean {
  return typeof ClipboardItem !== 'undefined' && !!navigator.clipboard?.write;
}

// Build an HTML payload that shows the POS text as preformatted details plus
// the photo inline. Falls back to plain <pre> text if the photo is absent or
// fails to encode.
async function buildClipboardPayload(
  text: string,
  photo?: string | null
): Promise<{ text: string; html: string; imageEmbedded: boolean }> {
  if (!photo) {
    return { text, html: `<pre>${escapeHtml(text)}</pre>`, imageEmbedded: false };
  }
  try {
    const pngDataUrl = await photoToPngDataUrl(photo);
    const html =
      `<div style="font-family:monospace;white-space:pre-wrap;">${escapeHtml(text)}</div>` +
      `<div style="margin-top:12px;"><img src="${pngDataUrl}" alt="Order photo" style="max-width:100%;"/></div>`;
    return { text, html, imageEmbedded: true };
  } catch {
    return { text, html: `<pre>${escapeHtml(text)}</pre>`, imageEmbedded: false };
  }
}

// Copy text + photo together. Returns whether the image was embedded in the
// HTML payload (false when there was no photo or encoding failed — the text
// is still copied).
export async function copyTextAndPhoto(
  text: string,
  photo?: string | null
): Promise<{ imageCopied: boolean }> {
  const { text: plainText, html, imageEmbedded } = await buildClipboardPayload(text, photo);

  if (!clipboardItemSupported()) {
    await navigator.clipboard.writeText(plainText);
    return { imageCopied: false };
  }

  try {
    const item = new ClipboardItem({
      'text/plain': new Blob([plainText], { type: 'text/plain' }),
      'text/html': new Blob([html], { type: 'text/html' }),
    });
    await navigator.clipboard.write([item]);
    return { imageCopied: imageEmbedded };
  } catch {
    // Some browsers reject text/html — fall back to plain text only.
    await navigator.clipboard.writeText(plainText);
    return { imageCopied: false };
  }
}


export { copyTextAndPhoto }