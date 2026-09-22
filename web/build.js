// Assembles the standalone web/iPad build of MacAnki from template.html + app.js,
// inlining the wallpaper and app icon as base64 data URIs so the whole thing is
// one self-contained HTML file with no external dependencies.
//
// Usage: node web/build.js
// Output: web/dist/macanki-web.html

const fs = require('fs');
const path = require('path');

const root = __dirname;
const template = fs.readFileSync(path.join(root, 'template.html'), 'utf8');
const appJs = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const wallpaper = fs.readFileSync(path.join(root, '..', 'renderer', 'assets', 'wallpaper.jpg')).toString('base64');
const icon = fs.readFileSync(path.join(root, '..', 'build', 'icon.png')).toString('base64');

const out = template
  .replace('{{WALLPAPER_B64}}', wallpaper)
  .replace('{{ICON_B64}}', icon)
  .replace('{{APP_JS}}', appJs);

const outDir = path.join(root, 'dist');
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, 'macanki-web.html');
fs.writeFileSync(outPath, out);
console.log(`Wrote ${outPath} (${out.length} bytes)`);
