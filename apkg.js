const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const initSqlJs = require('sql.js');
const fzstd = require('fzstd');

function stripHtml(str) {
  return String(str)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?div[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

const CLOZE_PATTERN = /\{\{c(\d+)::(.*?)(?:::(.*?))?\}\}/g;

function clozeNumbersIn(text) {
  const nums = new Set();
  let m;
  CLOZE_PATTERN.lastIndex = 0;
  while ((m = CLOZE_PATTERN.exec(text))) nums.add(Number(m[1]));
  return [...nums].sort((a, b) => a - b);
}

// Renders a cloze note's text for one specific cloze number: that number's
// deletion becomes a blank (or its answer, when `reveal` is true) — every
// OTHER cloze number in the same text is always shown filled in, matching
// how Anki's own cloze template behaves.
function renderCloze(text, activeNum, reveal) {
  return text.replace(CLOZE_PATTERN, (_match, numStr, answer, hint) => {
    if (Number(numStr) === activeNum) {
      return reveal ? answer : hint ? `[${hint}]` : '[...]';
    }
    return answer;
  });
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
      const field0 = fields[0] || '';
      const extra = fields[1] || '';
      const clozeNums = clozeNumbersIn(field0);

      if (clozeNums.length > 0) {
        // Cloze note: Anki generates one card per {{cN::...}} number, each
        // hiding only that number (others in the same text stay revealed).
        for (const num of clozeNums) {
          const front = stripHtml(renderCloze(field0, num, false));
          let back = stripHtml(renderCloze(field0, num, true));
          const extraText = stripHtml(extra);
          if (extraText) back += `\n\n${extraText}`;
          if (front && back) cards.push({ front, back });
        }
      } else {
        const front = stripHtml(field0);
        const back = stripHtml(extra);
        if (front && back) cards.push({ front, back });
      }
    }
  }

  if (cards.length === 0) {
    throw new Error('No importable cards were found in this .apkg file.');
  }

  return { name: path.basename(filePath, path.extname(filePath)), cards };
}

module.exports = { parseApkg };
