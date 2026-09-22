const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { Store } = require('./store');

let store;
let mainWindow;

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
ipcMain.handle('deck:delete', (_e, id) => store.deleteDeck(id));

ipcMain.handle('card:add', (_e, deckId, front, back) => store.addCard(deckId, front, back));
ipcMain.handle('card:update', (_e, id, front, back) => store.updateCard(id, front, back));
ipcMain.handle('card:delete', (_e, id) => store.deleteCard(id));
ipcMain.handle('card:listForDeck', (_e, deckId) => store.cardsForDeck(deckId));
ipcMain.handle('card:dueForDeck', (_e, deckId) => store.dueCardsForDeck(deckId));
ipcMain.handle('card:rate', (_e, id, rating) => store.rateCard(id, rating));

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
