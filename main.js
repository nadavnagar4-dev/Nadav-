const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const { Store } = require('./store');

let store;
let mainWindow;

function send(channel) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel);
}

function buildMenu() {
  const isMac = process.platform === 'darwin';

  const template = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' },
              { type: 'separator' },
              { role: 'hide' },
              { role: 'hideOthers' },
              { role: 'unhide' },
              { type: 'separator' },
              { role: 'quit' },
            ],
          },
        ]
      : []),
    {
      label: 'File',
      submenu: [
        { label: 'New Deck…', accelerator: 'CmdOrCtrl+N', click: () => send('menu:new-deck') },
        { label: 'New Card…', accelerator: 'CmdOrCtrl+Shift+N', click: () => send('menu:new-card') },
        { type: 'separator' },
        { label: 'Import Deck…', accelerator: 'CmdOrCtrl+I', click: () => send('menu:import-deck') },
        { label: 'Export Deck…', accelerator: 'CmdOrCtrl+E', click: () => send('menu:export-deck') },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
        { type: 'separator' },
        { label: 'Find in Deck', accelerator: 'CmdOrCtrl+F', click: () => send('menu:focus-search') },
      ],
    },
    {
      label: 'Study',
      submenu: [{ label: 'Study Now', accelerator: 'CmdOrCtrl+Return', click: () => send('menu:study-now') }],
    },
    { role: 'windowMenu' },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 820,
    minHeight: 560,
    backgroundColor: '#ececec',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 18, y: 20 },
    vibrancy: 'sidebar',
    visualEffectState: 'active',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

app.whenReady().then(() => {
  const dataPath = path.join(app.getPath('userData'), 'macanki-data.json');
  store = new Store(dataPath);
  buildMenu();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('data:getAll', () => store.getAll());
ipcMain.handle('deck:add', (_e, name) => store.addDeck(name));
ipcMain.handle('deck:rename', (_e, id, name) => store.renameDeck(id, name));

ipcMain.handle('deck:delete', async (_e, id) => {
  const deck = store.state.decks.find((d) => d.id === id);
  if (!deck) return { ok: false };
  const cardCount = store.cardsForDeck(id).length;
  const { response } = await dialog.showMessageBox(mainWindow, {
    type: 'warning',
    buttons: ['Cancel', 'Delete Deck'],
    defaultId: 0,
    cancelId: 0,
    message: `Delete "${deck.name}"?`,
    detail: `This permanently deletes this deck and all ${cardCount} card${cardCount === 1 ? '' : 's'} in it. This cannot be undone.`,
  });
  if (response !== 1) return { ok: false };
  store.deleteDeck(id);
  return { ok: true };
});

ipcMain.handle('card:add', (_e, deckId, front, back) => store.addCard(deckId, front, back));
ipcMain.handle('card:update', (_e, id, front, back) => store.updateCard(id, front, back));

ipcMain.handle('card:delete', async (_e, id) => {
  const card = store.state.cards.find((c) => c.id === id);
  if (!card) return { ok: false };
  const { response } = await dialog.showMessageBox(mainWindow, {
    type: 'warning',
    buttons: ['Cancel', 'Delete Card'],
    defaultId: 0,
    cancelId: 0,
    message: 'Delete this card?',
    detail: card.front,
  });
  if (response !== 1) return { ok: false };
  store.deleteCard(id);
  return { ok: true };
});

ipcMain.handle('card:listForDeck', (_e, deckId) => store.cardsForDeck(deckId));
ipcMain.handle('card:dueForDeck', (_e, deckId) => store.dueCardsForDeck(deckId));
ipcMain.handle('card:rate', (_e, id, rating) => store.rateCard(id, rating));

ipcMain.handle('settings:setLastDeck', (_e, id) => store.setLastSelectedDeck(id));

ipcMain.handle('deck:export', async (_e, deckId) => {
  const data = store.exportDeck(deckId);
  if (!data) return { ok: false };
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Export Deck',
    defaultPath: `${data.name}.json`,
    filters: [{ name: 'MacAnki Deck', extensions: ['json'] }],
  });
  if (canceled || !filePath) return { ok: false };
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  return { ok: true, filePath };
});

ipcMain.handle('deck:import', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Import Deck',
    filters: [{ name: 'MacAnki Deck', extensions: ['json'] }],
    properties: ['openFile'],
  });
  if (canceled || !filePaths[0]) return { ok: false };
  try {
    const raw = fs.readFileSync(filePaths[0], 'utf8');
    const parsed = JSON.parse(raw);
    const deck = store.importDeck(parsed.name || 'Imported Deck', parsed.cards || []);
    return { ok: true, deck };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});
