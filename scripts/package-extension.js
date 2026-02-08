/**
 * Package entire CodingPet VSCode extension
 */
const { execSync } = require('child_process');
const path = require('path');

const rootDir = path.join(__dirname, '..');

console.log('[Package] Step 1: Building main extension...');
execSync('npm run build', { cwd: rootDir, stdio: 'inherit' });

console.log('[Package] Step 2: Building overlay...');
execSync('node scripts/build-overlay.js', { cwd: rootDir, stdio: 'inherit' });

console.log('[Package] Step 3: Packaging VSIX...');
try {
  execSync('npx vsce package', { cwd: rootDir, stdio: 'inherit' });
  console.log('[Package] Done! VSIX file created.');
} catch (e) {
  console.log('[Package] Note: vsce not available. Install with: npm i -g @vscode/vsce');
  console.log('[Package] You can still use the extension in development mode.');
}
