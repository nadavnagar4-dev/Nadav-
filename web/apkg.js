// Memory-conscious .apkg (Anki package) reader for the browser.
//
// A naive approach (unzip the whole archive into memory, then read the
// database) falls over on a large package: most of an .apkg's size is
// bundled media, and loading gigabytes of images/audio into a browser tab
// just to reach one small SQLite file would exceed the tab's memory limit
// on an iPad long before it exceeded a desktop's.
//
// Instead this reads the ZIP's central directory (a small index, even for a
// huge archive) to find exactly where "collection.anki2"/"collection.anki21"
// lives, then reads and inflates only that one entry via Blob.slice() —
// which never touches the rest of the file. Peak memory stays proportional
// to the size of the card data itself, not the package.
//
// Supports Zip64 (needed for any archive over ~4GB, or with a huge entry).
// Requires a global `fflate` (for inflateSync) to already be loaded.

(function (global) {
  'use strict';

  const ZIP64_MAGIC = 0xffffffff;

  function readU64(dv, off) {
    const lo = dv.getUint32(off, true);
    const hi = dv.getUint32(off + 4, true);
    return hi * 4294967296 + lo;
  }

  async function blobSlice(blob, start, end) {
    return new Uint8Array(await blob.slice(start, end).arrayBuffer());
  }

  // Finds the End Of Central Directory record and returns { cdOffset, cdSize }.
  async function locateCentralDirectory(blob) {
    const EOCD_MIN_SIZE = 22;
    const MAX_COMMENT = 65535;
    const tailSize = Math.min(blob.size, EOCD_MIN_SIZE + MAX_COMMENT);
    const tailOffset = blob.size - tailSize;
    const tailBuf = await blobSlice(blob, tailOffset, blob.size);

    let eocdPos = -1;
    for (let i = tailBuf.length - EOCD_MIN_SIZE; i >= 0; i--) {
      if (tailBuf[i] === 0x50 && tailBuf[i + 1] === 0x4b && tailBuf[i + 2] === 0x05 && tailBuf[i + 3] === 0x06) {
        eocdPos = i;
        break;
      }
    }
    if (eocdPos === -1) throw new Error("Not a valid .apkg file (no end-of-central-directory record found).");

    const dv = new DataView(tailBuf.buffer, tailBuf.byteOffset, tailBuf.byteLength);
    let cdSize = dv.getUint32(eocdPos + 12, true);
    let cdOffset = dv.getUint32(eocdPos + 16, true);

    if (cdOffset === ZIP64_MAGIC || cdSize === ZIP64_MAGIC) {
      const locatorPos = eocdPos - 20;
      if (locatorPos < 0 || dv.getUint32(locatorPos, true) !== 0x07064b50) {
        throw new Error("This .apkg reports a 64-bit size but its Zip64 locator is missing or corrupt.");
      }
      const zip64EocdOffset = readU64(dv, locatorPos + 8);

      let z64dv;
      let z64Base;
      if (zip64EocdOffset >= tailOffset) {
        z64dv = dv;
        z64Base = zip64EocdOffset - tailOffset;
      } else {
        const z64buf = await blobSlice(blob, zip64EocdOffset, zip64EocdOffset + 56);
        z64dv = new DataView(z64buf.buffer, z64buf.byteOffset, z64buf.byteLength);
        z64Base = 0;
      }
      if (z64dv.getUint32(z64Base, true) !== 0x06064b50) {
        throw new Error("Corrupt Zip64 end-of-central-directory record in this .apkg.");
      }
      cdSize = readU64(z64dv, z64Base + 40);
      cdOffset = readU64(z64dv, z64Base + 48);
    }

    return { cdOffset, cdSize };
  }

  // Reads the central directory and returns entry metadata for any of `targetNames` found.
  async function findEntries(blob, targetNames) {
    const { cdOffset, cdSize } = await locateCentralDirectory(blob);
    const cdBuf = await blobSlice(blob, cdOffset, cdOffset + cdSize);
    const cdv = new DataView(cdBuf.buffer, cdBuf.byteOffset, cdBuf.byteLength);

    const wanted = new Set(targetNames);
    const found = {};
    let pos = 0;
    while (pos + 46 <= cdBuf.length && cdv.getUint32(pos, true) === 0x02014b50) {
      const method = cdv.getUint16(pos + 10, true);
      let compSize = cdv.getUint32(pos + 20, true);
      let uncompSize = cdv.getUint32(pos + 24, true);
      const nameLen = cdv.getUint16(pos + 28, true);
      const extraLen = cdv.getUint16(pos + 30, true);
      const commentLen = cdv.getUint16(pos + 32, true);
      let localOffset = cdv.getUint32(pos + 42, true);
      const name = new TextDecoder("utf-8").decode(cdBuf.subarray(pos + 46, pos + 46 + nameLen));

      if (compSize === ZIP64_MAGIC || uncompSize === ZIP64_MAGIC || localOffset === ZIP64_MAGIC) {
        let extraPos = pos + 46 + nameLen;
        const extraEnd = extraPos + extraLen;
        while (extraPos + 4 <= extraEnd) {
          const headerId = cdv.getUint16(extraPos, true);
          const dataSize = cdv.getUint16(extraPos + 2, true);
          if (headerId === 0x0001) {
            let off = extraPos + 4;
            if (uncompSize === ZIP64_MAGIC) { uncompSize = readU64(cdv, off); off += 8; }
            if (compSize === ZIP64_MAGIC) { compSize = readU64(cdv, off); off += 8; }
            if (localOffset === ZIP64_MAGIC) { localOffset = readU64(cdv, off); off += 8; }
          }
          extraPos += 4 + dataSize;
        }
      }

      if (wanted.has(name)) {
        found[name] = { method, compSize, uncompSize, localOffset };
      }
      pos += 46 + nameLen + extraLen + commentLen;
    }
    return found;
  }

  // Reads and decompresses exactly one entry, given its central-directory metadata.
  async function readEntry(blob, entry, name) {
    const { method, compSize, localOffset } = entry;
    const headerProbe = await blobSlice(blob, localOffset, localOffset + 30);
    const hv = new DataView(headerProbe.buffer, headerProbe.byteOffset, headerProbe.byteLength);
    if (hv.getUint32(0, true) !== 0x04034b50) {
      throw new Error(`Corrupt local file header for "${name}" in this .apkg.`);
    }
    const localNameLen = hv.getUint16(26, true);
    const localExtraLen = hv.getUint16(28, true);
    const dataStart = localOffset + 30 + localNameLen + localExtraLen;
    const compBytes = await blobSlice(blob, dataStart, dataStart + compSize);

    if (method === 0) return compBytes;
    if (method === 8) return global.fflate.inflateSync(compBytes);
    throw new Error(`"${name}" uses an unsupported compression method (${method}) — only store and deflate are supported.`);
  }

  function stripHtml(str) {
    return String(str)
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/?div[^>]*>/gi, "\n")
      .replace(/\{\{c\d+::(.*?)(::.*?)?\}\}/g, "$1")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();
  }

  // Parses a .apkg File/Blob and returns { name, cards: [{front, back}] }.
  // Only reads the collection database out of the archive — bundled media
  // (images/audio) is never touched, so this stays memory-safe regardless
  // of how large the overall package is.
  async function parseApkgBlob(blob, suggestedName, SQL) {
    const CANDIDATES = ["collection.anki21", "collection.anki21b", "collection.anki2"];
    const found = await findEntries(blob, CANDIDATES);
    const presentName = CANDIDATES.find((n) => found[n]);
    if (!presentName) {
      throw new Error("Not a valid .apkg file: no collection database found inside.");
    }

    let dbBytes = await readEntry(blob, found[presentName], presentName);

    // Anki 2.1.50+ stores the newer-schema collection as "collection.anki21b",
    // whose content is Zstandard-compressed on top of being a zip entry —
    // one more decompression pass is needed before it's a real SQLite file.
    if (presentName === "collection.anki21b") {
      if (!global.fzstd) {
        throw new Error("This .apkg uses Anki's newer compressed format, but the Zstandard decoder didn't load.");
      }
      try {
        dbBytes = global.fzstd.decompress(dbBytes);
      } catch (err) {
        throw new Error(`Couldn't decompress this .apkg's collection data: ${err.message}`);
      }
    }

    const db = new SQL.Database(dbBytes);

    let noteRows;
    try {
      noteRows = db.exec("SELECT flds FROM notes");
    } finally {
      db.close();
    }

    const cards = [];
    if (noteRows.length > 0) {
      for (const row of noteRows[0].values) {
        const flds = row[0];
        if (typeof flds !== "string") continue;
        const fields = flds.split("\x1f");
        const front = stripHtml(fields[0] || "");
        const back = stripHtml(fields[1] || "");
        if (front && back) cards.push({ front, back });
      }
    }

    if (cards.length === 0) {
      throw new Error("No importable cards were found in this .apkg file.");
    }

    return { name: suggestedName.replace(/\.apkg$/i, ""), cards };
  }

  global.MacAnkiApkg = { parseApkgBlob, findEntries, readEntry, locateCentralDirectory };
})(typeof window !== "undefined" ? window : globalThis);
