/**
 * Build Electron overlay desktop pet
 */
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const overlayDir = path.join(__dirname, '..', 'overlay');

console.log('[Build] Installing overlay dependencies...');
execSync('npm install', { cwd: overlayDir, stdio: 'inherit' });

console.log('[Build] Compiling TypeScript...');
execSync('npx tsc', { cwd: overlayDir, stdio: 'inherit' });

const rendererSrc = path.join(overlayDir, 'renderer');
const rendererDst = path.join(overlayDir, 'dist', 'renderer');

function copyDir(src, dst) {
  if (!fs.existsSync(dst)) {
    fs.mkdirSync(dst, { recursive: true });
  }
  const entries = fs.readdirSync(src);
  for (const entry of entries) {
    const srcPath = path.join(src, entry);
    const dstPath = path.join(dst, entry);
    const stat = fs.statSync(srcPath);
    if (stat.isDirectory()) {
      copyDir(srcPath, dstPath);
    } else if (!entry.endsWith('.ts')) {
      fs.copyFileSync(srcPath, dstPath);
    }
  }
}

if (fs.existsSync(rendererSrc)) {
  console.log('[Build] Copying renderer assets...');
  copyDir(rendererSrc, rendererDst);
}

console.log('[Build] Overlay build complete!');
