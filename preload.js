const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getAll: () => ipcRenderer.invoke('data:getAll'),

  addDeck: (name) => ipcRenderer.invoke('deck:add', name),
  renameDeck: (id, name) => ipcRenderer.invoke('deck:rename', id, name),
  deleteDeck: (id) => ipcRenderer.invoke('deck:delete', id),
  exportDeck: (id) => ipcRenderer.invoke('deck:export', id),
  importDeck: () => ipcRenderer.invoke('deck:import'),
  importDeckFromText: (text) => ipcRenderer.invoke('deck:importFromText', text),
  importApkg: () => ipcRenderer.invoke('deck:importApkg'),

  addCard: (deckId, front, back) => ipcRenderer.invoke('card:add', deckId, front, back),
  addCardsBulk: (deckId, pairs) => ipcRenderer.invoke('card:addBulk', deckId, pairs),
  updateCard: (id, front, back) => ipcRenderer.invoke('card:update', id, front, back),
  deleteCard: (id) => ipcRenderer.invoke('card:delete', id),
  listCardsForDeck: (deckId) => ipcRenderer.invoke('card:listForDeck', deckId),
  dueCardsForDeck: (deckId) => ipcRenderer.invoke('card:dueForDeck', deckId),
  rateCard: (id, rating) => ipcRenderer.invoke('card:rate', id, rating),

  setLastSelectedDeck: (id) => ipcRenderer.invoke('settings:setLastDeck', id),

  onMenuNewDeck: (cb) => ipcRenderer.on('menu:new-deck', cb),
  onMenuNewCard: (cb) => ipcRenderer.on('menu:new-card', cb),
  onMenuImportDeck: (cb) => ipcRenderer.on('menu:import-deck', cb),
  onMenuImportApkg: (cb) => ipcRenderer.on('menu:import-apkg', cb),
  onMenuExportDeck: (cb) => ipcRenderer.on('menu:export-deck', cb),
  onMenuFocusSearch: (cb) => ipcRenderer.on('menu:focus-search', cb),
  onMenuStudyNow: (cb) => ipcRenderer.on('menu:study-now', cb),
});
