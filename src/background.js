import encode from '@jsquash/jpeg/encode';

const CONTEXT_MENU_ID = 'download-compressed-image';
const TARGET_WIDTH = 700;
const JPEG_QUALITY = 80;

// ─── עזרי Notifications ────────────────────────────────────────────────────

function notify(id, title, message) {
  chrome.notifications.create(id, {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icons/icon48.png'),
    title,
    message,
    priority: 2,
  });
}

// ─── Context Menu ──────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: CONTEXT_MENU_ID,
    title: 'הורד תמונה דחוסה (700px)',
    contexts: ['image'],
  });
});

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId !== CONTEXT_MENU_ID) return;
  const imageUrl = info.srcUrl;
  if (!imageUrl) {
    notify('err-no-url', '❌ שגיאה', 'לא נמצאה כתובת תמונה');
    return;
  }
  handleDownload(imageUrl);
});

// ─── עיבוד ────────────────────────────────────────────────────────────────

async function handleDownload(imageUrl) {
  notify('progress', '⏳ מעבד...', 'מוריד ומכווץ את התמונה, נא להמתין');

  try {
    // שלב 1: הורדת התמונה
    let response;
    try {
      response = await fetch(imageUrl, { credentials: 'include' });
    } catch (e) {
      notify('err-fetch', '❌ שגיאת רשת', `לא ניתן להוריד את התמונה: ${e.message}`);
      return;
    }
    if (!response.ok) {
      notify('err-http', '❌ שגיאת HTTP', `סטטוס: ${response.status} — ${imageUrl}`);
      return;
    }

    // שלב 2: blob → ImageBitmap
    const blob = await response.blob();
    let bitmap;
    try {
      bitmap = await createImageBitmap(blob);
    } catch (e) {
      notify('err-bitmap', '❌ שגיאת תמונה', `לא ניתן לפענח את התמונה: ${e.message}`);
      return;
    }

    // שלב 3: חישוב גודל יעד
    const scale = bitmap.width > TARGET_WIDTH ? TARGET_WIDTH / bitmap.width : 1;
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);

    // שלב 4: ציור ב-OffscreenCanvas
    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    const imageData = ctx.getImageData(0, 0, w, h);

    // שלב 5: קידוד עם MozJPEG WASM
    let arrayBuffer;
    try {
      arrayBuffer = await encode(imageData, { quality: JPEG_QUALITY });
    } catch (e) {
      notify('err-encode', '❌ שגיאת MozJPEG', `קידוד נכשל: ${e.message}`);
      return;
    }

    // שלב 6: המרה ל-data URL (base64 chunk-wise)
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    const chunk = 8192;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    const dataUrl = 'data:image/jpeg;base64,' + btoa(binary);

    // שלב 7: הורדה
    const filename = buildFilename(imageUrl);
    try {
      await chrome.downloads.download({ url: dataUrl, filename, saveAs: true });
      notify('done', '✅ הורדה הושלמה', `${filename} — ${w}×${h}px`);
    } catch (e) {
      notify('err-dl', '❌ שגיאת הורדה', e.message);
    }

  } catch (e) {
    notify('err-unknown', '❌ שגיאה לא צפויה', e.message || String(e));
    console.error('[MozJPEG]', e);
  }
}

// ─── שם קובץ ──────────────────────────────────────────────────────────────

function buildFilename(url) {
  try {
    const { pathname } = new URL(url);
    const parts = pathname.split('/').filter(Boolean);
    const original = parts[parts.length - 1] || 'image';
    const base = original.replace(/\.[^.]+$/, '');
    return `${base}_700px.jpg`;
  } catch {
    return 'image_700px.jpg';
  }
}
