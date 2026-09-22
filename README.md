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
```

## Web / iPad version

No Mac (or any desktop) required — `web/` is the same app rebuilt as a single self-contained
HTML file that runs entirely in the browser, no server needed:

```bash
node web/build.js   # writes web/dist/macanki-web.html
```

It keeps the same dark, wallpaper-backed design (with decorative traffic-light dots standing
in for the real macOS ones) and every feature except real `.apkg` import, which needs Node's
filesystem and isn't something a browser sandbox can safely do — JSON import/export still
works (export copies the deck's JSON to your clipboard; paste it back in anywhere, or use a
`.json` file, to import). Data is saved with `localStorage`, entirely on-device.

Open the built HTML file in Safari and use Share → **Add to Home Screen** to get an app icon
that launches full-screen, no browser chrome — this is how it's meant to be used on an iPad.
