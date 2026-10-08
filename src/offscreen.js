import encode from '@jsquash/jpeg/encode';

const TARGET_WIDTH = 700;
const JPEG_QUALITY = 80; // 0-100, ניתן לשינוי

// האזנה להודעות מה-background
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.target !== 'offscreen') return false;

  processImage(message.imageUrl)
    .then((dataUrl) => sendResponse({ dataUrl }))
    .catch((err) => sendResponse({ error: err.message }));

  return true; // async response
});

async function processImage(imageUrl) {
  // שלב 1: הורדת התמונה
  const response = await fetch(imageUrl);
  if (!response.ok) throw new Error(`שגיאה בהורדת התמונה: ${response.status}`);
  const blob = await response.blob();

  // שלב 2: טעינה ל-ImageBitmap
  const bitmap = await createImageBitmap(blob);

  // שלב 3: חישוב גובה חדש תוך שמירת יחס
  const originalWidth = bitmap.width;
  const originalHeight = bitmap.height;

  let targetWidth = TARGET_WIDTH;
  let targetHeight = Math.round((originalHeight / originalWidth) * targetWidth);

  // אם התמונה כבר קטנה מ-700px — לא מגדילים
  if (originalWidth <= TARGET_WIDTH) {
    targetWidth = originalWidth;
    targetHeight = originalHeight;
  }

  // שלב 4: ציור על Canvas בגודל החדש
  const canvas = new OffscreenCanvas(targetWidth, targetHeight);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
  bitmap.close();

  // שלב 5: קבלת ImageData
  const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);

  // שלב 6: קידוד עם MozJPEG
  const arrayBuffer = await encode(imageData, { quality: JPEG_QUALITY });

  // שלב 7: המרה ל-data URL
  const jpegBlob = new Blob([arrayBuffer], { type: 'image/jpeg' });
  const dataUrl = await blobToDataUrl(jpegBlob);

  return dataUrl;
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('שגיאה בהמרת blob ל-data URL'));
    reader.readAsDataURL(blob);
  });
}
