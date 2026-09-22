# MacAnki

A native-feeling, macOS-styled flashcard app inspired by Anki, built with Electron.

## Features

- **Decks** — create, rename, delete, import/export as JSON
- **Flashcards** — add, edit, delete front/back cards
- **Study mode** — Anki-style spaced repetition (SM-2 style scheduling) with Again / Hard / Good / Easy ratings
- **macOS look** — inset traffic-light title bar, translucent sidebar, native light/dark mode support
- **Keyboard shortcuts** — `Space` to reveal answer, `1`–`4` to rate the card during study
- **Local persistence** — your decks and cards are saved to a JSON file in the app's user data directory, no account or internet connection needed

## Getting started

```bash
npm install
npm start
```

This launches the app in a window with a native-style title bar (traffic lights inset into the sidebar), matching macOS conventions. On Windows/Linux the same UI runs, just without the vibrancy/traffic-light chrome.

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

Only cards whose `due` date has passed show up in "Study Now".

## Project structure

```
main.js            Electron main process (window, IPC handlers)
preload.js          contextBridge API exposed to the renderer
store.js            JSON-file persistence + spaced-repetition scheduler
renderer/
  index.html        App shell (sidebar, deck view, study view, modal)
  styles.css        macOS-style UI (light/dark aware)
  app.js            UI logic wired to window.api (via preload)
```
