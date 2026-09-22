// Assembles the standalone web/iPad build of MacAnki from template.html + app.js,
// inlining the wallpaper, app icon, and the .apkg-reading stack (fflate + sql.js
// + our own zip/sqlite glue) as data so the whole thing is one self-contained
// HTML file with no external dependencies and no network fetches at runtime.
//
// Usage: node web/build.js
// Output: web/dist/macanki-web.html

const fs = require('fs');
const path = require('path');

const root = __dirname;
const nodeModules = path.join(root, '..', 'node_modules');

const template = fs.readFileSync(path.join(root, 'template.html'), 'utf8');
const appJs = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const apkgJs = fs.readFileSync(path.join(root, 'apkg.js'), 'utf8');
const fflateJs = fs.readFileSync(path.join(nodeModules, 'fflate', 'umd', 'index.js'), 'utf8');
const fzstdJs = fs.readFileSync(path.join(nodeModules, 'fzstd', 'umd', 'index.js'), 'utf8');
const sqlWasmJs = fs.readFileSync(path.join(nodeModules, 'sql.js', 'dist', 'sql-wasm.js'), 'utf8');
const sqlWasmB64 = fs.readFileSync(path.join(nodeModules, 'sql.js', 'dist', 'sql-wasm.wasm')).toString('base64');
const wallpaper = fs.readFileSync(path.join(root, '..', 'renderer', 'assets', 'wallpaper.jpg')).toString('base64');
const icon = fs.readFileSync(path.join(root, '..', 'build', 'icon.png')).toString('base64');

// A string replacement value gets `$&`/`$$`/etc. specially interpreted by
// String.replace() — real risk here since generated JS (sql.js's build in
// particular) can easily contain a literal "$" sequence that matches one of
// those tokens and silently corrupts the output. A replacer *function*'s
// return value is used verbatim, so every substitution goes through one.
function replaceLiteral(str, placeholder, value) {
  return str.replace(placeholder, () => value);
}

let out = template;
out = replaceLiteral(out, '{{WALLPAPER_B64}}', wallpaper);
out = replaceLiteral(out, '{{ICON_B64}}', icon);
out = replaceLiteral(out, '{{SQL_WASM_B64}}', sqlWasmB64);
out = replaceLiteral(out, '{{FFLATE_JS}}', fflateJs);
out = replaceLiteral(out, '{{FZSTD_JS}}', fzstdJs);
out = replaceLiteral(out, '{{SQL_WASM_JS}}', sqlWasmJs);
out = replaceLiteral(out, '{{APKG_JS}}', apkgJs);
out = replaceLiteral(out, '{{APP_JS}}', appJs);

const outDir = path.join(root, 'dist');
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, 'macanki-web.html');
fs.writeFileSync(outPath, out);
console.log(`Wrote ${outPath} (${out.length} bytes)`);
