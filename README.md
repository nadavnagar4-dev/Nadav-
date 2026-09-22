# MacAnki

A native-feeling, macOS-styled flashcard app inspired by Anki, built with Electron.

## Features

- **Dashboard home screen** — a GitHub-style review heatmap, streak/average/best-day/total stats, and a deck library table, all over a translucent wallpaper background
- **Decks** — create, rename, delete, import/export as JSON
- **Flashcards** — add, edit, delete front/back cards
- **Magic Add** — paste a list of `front :: back` (or tab- or `-`-separated) lines and bulk-create cards in one go
- **Import real Anki decks** — pick a `.apkg` file (Anki's export format) and its notes are parsed and imported as cards
- **Paste to import** — paste a previously-exported MacAnki JSON deck anywhere outside a text field to import it
- **Study mode** — Anki-style spaced repetition (SM-2 style scheduling) with a simple Forgot It / Got It rating
- **Read-aloud** — a Listen button speaks each card using the best available system voice (dyslexia-friendly)
- **Native macOS menu** — File/Edit/Study menu with real keyboard shortcuts (`⌘N` new deck, `⌘⇧N` new card, `⌘I` import, `⌘E` export, `⌘F` search, `⌘↩` study now) and working Cut/Copy/Paste in text fields
- **Delete confirmations** — native alerts before deleting a deck or card
- **Search** — filter the open deck's cards by front/back text
- **Keyboard shortcuts** — `Space` to reveal answer, `1`/`2` or `←`/`→` to rate the card during study
- **Local persistence** — your decks, cards, and review history are saved to a JSON file in the app's user data directory, no account or internet connection needed

## Getting started

```bash
npm install
npm start
```

This launches the app in a window with a native-style title bar (traffic lights inset into the sidebar), matching macOS conventions. On Windows/Linux the same UI runs, just without the traffic-light chrome.

## Building a macOS app (.dmg)

```bash
npm run dist
```

This uses `electron-builder` with the `mac` target configured in `package.json`. Building a signed/notarized `.dmg` requires running this on macOS (or a macOS CI runner); running it elsewhere will still produce an unsigned build where supported.

## How studying works

Each card tracks `interval`, `ease`, and `due` date, similar to Anki's SM-2 algorithm:

- **Again** — resets progress, card comes back in under a minute
- **Hard** — shorter interval growth, ease decreases slightly
- **Good** — standard growth (1 day → 6 days → interval × ease...)
- **Easy** — bigger jump, ease increases

Only cards whose `due` date has passed show up in "Study Now". Every rating is logged with a timestamp, which powers the dashboard's heatmap and stats.

## Importing a real Anki deck (.apkg)

Click **Add Anki File (.apkg)** in the bottom toolbar and pick an exported `.apkg` file. It's unzipped and its `collection.anki2`/`.anki21` SQLite database is read directly (via `sql.js`, no native dependencies) to pull out each note's first two fields as front/back. HTML formatting and cloze markup (`{{c1::...}}`) are stripped down to plain text. Media (images/audio) and the original deck's own scheduling history are not imported — cards come in fresh as "new".

## Project structure

```
main.js             Electron main process (window, menu, IPC handlers)
preload.js          contextBridge API exposed to the renderer
store.js            JSON-file persistence, spaced-repetition scheduler, stats
apkg.js             .apkg (Anki package) parser — unzip + SQLite read via sql.js
renderer/
  index.html        App shell (wallpaper, sidebar, dashboard, deck/study views, action bar, modal)
  styles.css        Dark glass UI over a wallpaper background
  app.js            UI logic wired to window.api (via preload)
  assets/wallpaper.jpg   Background image
web/                Standalone browser build (no Electron, no iPad required — but works there)
  template.html     Page shell + styles (placeholders filled in by build.js)
  app.js            Store (localStorage-backed) + UI logic, no IPC
  apkg.js           Memory-safe browser .apkg reader (targeted ZIP read + sql.js)
  build.js          Inlines wallpaper/icon/fflate/sql.js/apkg.js into one HTML file
```

## Web / iPad version

No Mac (or any desktop) required — `web/` is the same app rebuilt as a single self-contained
HTML file that runs entirely in the browser, no server needed:

```bash
node web/build.js   # writes web/dist/macanki-web.html
```

It keeps the same dark, wallpaper-backed design (with decorative traffic-light dots standing
in for the real macOS ones) and nearly every feature, including a **real** `.apkg` importer —
see below. Deck export copies JSON to your clipboard rather than downloading a file (paste it
back in anywhere, or pick a `.json` file, to import) since a plain file-download link doesn't
work everywhere this page might be opened. Data is saved with `localStorage`, entirely
on-device, plus lightweight auto-saved drafts so switching apps or an accidental refresh
mid-edit doesn't lose typed-but-unsaved text in a card, deck, or Magic Add.

Open the built HTML file in Safari and use Share → **Add to Home Screen** to get an app icon
that launches full-screen, no browser chrome — this is how it's meant to be used on an iPad.

### Nested decks ("sections")

Name a deck with `::` to nest it, e.g. `School::Biology::Exam 1` — any segment that doesn't
exist yet is created, and an existing one is reused (so `School::Biology` and later
`School::Chemistry` share one `School`). The sidebar and dashboard show the resulting tree
with expand/collapse toggles; a parent deck's badge counts and "Study Now" cover its own
cards plus everything nested under it, the same way opening `School` studies Biology and
Chemistry together, matching Anki's own subdeck model.

### Real `.apkg` import, sized for large collections

Unlike the desktop app's importer (which needs Node's filesystem), this one runs entirely in
the browser — and it's built to handle a large `.apkg` without loading the whole thing into
memory. Most of a package's size is usually bundled media (images/audio), which this never
touches: it reads the ZIP's central directory (a small index, even for a huge archive) to
find exactly where the collection database lives, then reads and decompresses only that one
entry via `Blob.slice()`. Peak memory stays proportional to the card data itself, not the
package — verified with a fixture where a 30MB dummy media entry sits right next to the real
collection, and the importer touches under 70KB total to extract it. Zip64 (needed for any
archive over ~4GB) is supported.

Anki 2.1.50+ stores the collection as `collection.anki21b`, whose content is
Zstandard-compressed on top of being a zip entry — both importers (browser and desktop)
decompress that extra layer via `fzstd` before handing the bytes to sql.js; the older
uncompressed `collection.anki21`/`.anki2` formats work too. What doesn't carry over: media
files themselves (no image/audio rendering) and the original deck's scheduling history —
cards come in fresh as "new".
