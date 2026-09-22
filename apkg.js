const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const initSqlJs = require('sql.js');
const fzstd = require('fzstd');

function stripHtml(str) {
  return String(str)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?div[^>]*>/gi, '\n')
    .replace(/\{\{c\d+::(.*?)(::.*?)?\}\}/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

// Parses a .apkg (Anki package) file and returns { name, cards: [{front, back}] }.
// Supports the common "Basic" / "Basic (and reversed card)" style note types by
// taking the first two fields of each note as front/back; media and scheduling
// history from the source deck are intentionally not imported.
async function parseApkg(filePath) {
  const zip = new AdmZip(filePath);
  const entries = zip.getEntries();

  const dbEntry =
    entries.find((e) => e.entryName === 'collection.anki21') ||
    entries.find((e) => e.entryName === 'collection.anki21b') ||
    entries.find((e) => e.entryName === 'collection.anki2');

  if (!dbEntry) {
    throw new Error('Not a valid .apkg file: no collection database found inside.');
  }

  let dbBytes = dbEntry.getData();

  // Anki 2.1.50+ stores the newer-schema collection as "collection.anki21b",
  // whose content is Zstandard-compressed on top of being a zip entry — one
  // more decompression pass is needed before it's a real SQLite file.
  if (dbEntry.entryName === 'collection.anki21b') {
    try {
      dbBytes = Buffer.from(fzstd.decompress(dbBytes));
    } catch (err) {
      throw new Error(`Couldn't decompress this .apkg's collection data: ${err.message}`);
    }
  }

  const wasmPath = path.join(path.dirname(require.resolve('sql.js')), '..', 'dist', 'sql-wasm.wasm');
  const SQL = await initSqlJs({ locateFile: () => wasmPath });
  const db = new SQL.Database(dbBytes);

  let noteRows;
  try {
    noteRows = db.exec('SELECT flds, sfld FROM notes');
  } catch (err) {
    db.close();
    throw new Error(`Could not read notes from this .apkg file: ${err.message}`);
  }
  db.close();

  const cards = [];
  if (noteRows.length > 0) {
    for (const row of noteRows[0].values) {
      const flds = row[0];
      if (typeof flds !== 'string') continue;
      const fields = flds.split('\x1f');
      const front = stripHtml(fields[0] || '');
      const back = stripHtml(fields[1] || '');
      if (front && back) cards.push({ front, back });
    }
  }

  if (cards.length === 0) {
    throw new Error('No importable cards were found in this .apkg file.');
  }

  return { name: path.basename(filePath, path.extname(filePath)), cards };
}

module.exports = { parseApkg };
