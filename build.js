const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const isWatch = process.argv.includes('--watch');

// וודא שתיקיית dist קיימת
if (!fs.existsSync('dist')) fs.mkdirSync('dist');

// העתקת קובץ ה-WASM של MozJPEG ל-dist
function copyWasm() {
  const wasmSrc = path.join(
    __dirname,
    'node_modules/@jsquash/jpeg/codec/enc/mozjpeg_enc.wasm'
  );
  const wasmDest = path.join(__dirname, 'dist/mozjpeg_enc.wasm');
  fs.copyFileSync(wasmSrc, wasmDest);
  console.log('✓ mozjpeg_enc.wasm הועתק ל-dist/');
}

copyWasm();

const config = {
  entryPoints: ['src/background.js'],
  bundle: true,
  format: 'esm',
  target: 'chrome120',
  loader: { '.wasm': 'file' },
  assetNames: '[name]',
  outdir: 'dist',
};

async function build() {
  try {
    await esbuild.build(config);
    console.log('✓ Build הושלם בהצלחה — תיקיית dist/ מוכנה');
    console.log('  כעת טען את התוסף מתיקיית השורש ב-chrome://extensions');
  } catch (err) {
    console.error('✗ שגיאה ב-build:', err);
    process.exit(1);
  }
}

if (isWatch) {
  esbuild.context(config).then((ctx) => {
    ctx.watch();
    console.log('👀 Watch mode — ממתין לשינויים...');
  });
} else {
  build();
}
