(() => {
  const state = {
    decks: [],
    stats: null,
    selectedDeckId: null,
    currentCards: [],
    studyQueue: [],
    studyIndex: 0,
    showingAnswer: false,
  };

  let hasInitialized = false;

  const el = {
    deckList: document.getElementById('deck-list'),
    homeBtn: document.getElementById('home-btn'),
    dashboard: document.getElementById('dashboard'),
    dashTodayCount: document.getElementById('dash-today-count'),
    heatmapGrid: document.getElementById('heatmap-grid'),
    statStreak: document.getElementById('stat-streak'),
    statAvg: document.getElementById('stat-avg'),
    statBest: document.getElementById('stat-best'),
    statTotal: document.getElementById('stat-total'),
    deckLibraryRows: document.getElementById('deck-library-rows'),
    deckView: document.getElementById('deck-view'),
    studyView: document.getElementById('study-view'),
    studyDone: document.getElementById('study-done'),
    deckTitle: document.getElementById('deck-title'),
    deckSubtitle: document.getElementById('deck-subtitle'),
    studyHint: document.getElementById('study-hint'),
    todayStat: document.getElementById('today-stat'),
    cardSearch: document.getElementById('card-search'),
    cardList: document.getElementById('card-list'),
    flashcardFace: document.getElementById('flashcard-face'),
    flashcard: document.getElementById('flashcard'),
    listenBtn: document.getElementById('listen-btn'),
    studyProgress: document.getElementById('study-progress'),
    showAnswerBtn: document.getElementById('show-answer-btn'),
    ratingButtons: document.getElementById('rating-buttons'),
    modalBackdrop: document.getElementById('modal-backdrop'),
    modalTitle: document.getElementById('modal-title'),
    modalBody: document.getElementById('modal-body'),
    modalConfirm: document.getElementById('modal-confirm'),
    modalCancel: document.getElementById('modal-cancel'),
  };

  function panes() {
    return [el.dashboard, el.deckView, el.studyView, el.studyDone];
  }

  function showPane(pane) {
    for (const p of panes()) p.hidden = p !== pane;
  }

  async function refresh() {
    const data = await window.api.getAll();
    state.decks = data.decks;
    state.stats = data.stats;

    if (!hasInitialized) {
      hasInitialized = true;
      const lastId = data.settings && data.settings.lastSelectedDeckId;
      if (!state.selectedDeckId && lastId && state.decks.find((d) => d.id === lastId)) {
        state.selectedDeckId = lastId;
      }
    }

    renderDeckList();
    if (state.selectedDeckId && !state.decks.find((d) => d.id === state.selectedDeckId)) {
      state.selectedDeckId = null;
    }
    if (state.selectedDeckId) {
      await renderDeckView();
    } else {
      renderDashboard();
      showPane(el.dashboard);
    }
  }

  function goHome() {
    stopSpeaking();
    state.selectedDeckId = null;
    window.api.setLastSelectedDeck(null);
    renderDeckList();
    renderDashboard();
    showPane(el.dashboard);
  }

  function renderDeckList() {
    el.homeBtn.classList.toggle('selected', !state.selectedDeckId);
    el.deckList.innerHTML = '';
    for (const deck of state.decks) {
      const item = document.createElement('div');
      item.className = 'deck-item' + (deck.id === state.selectedDeckId ? ' selected' : '');
      const badges = [];
      if (deck.newCount > 0) badges.push(`<span class="deck-badge badge-new">${deck.newCount}</span>`);
      if (deck.dueReviewCount > 0) badges.push(`<span class="deck-badge badge-due">${deck.dueReviewCount}</span>`);
      item.innerHTML = `<span class="deck-name">${escapeHtml(deck.name)}</span><div class="deck-badges">${badges.join('')}</div>`;
      item.addEventListener('click', () => selectDeck(deck.id));
      el.deckList.appendChild(item);
    }
  }

  function renderDashboard() {
    const stats = state.stats || { cells: [], streak: 0, avgPerDay: 0, bestDay: 0, totalReviews: 0, todayCount: 0 };
    el.dashTodayCount.textContent = stats.todayCount;
    el.statStreak.textContent = stats.streak;
    el.statAvg.textContent = stats.avgPerDay;
    el.statBest.textContent = stats.bestDay;
    el.statTotal.textContent = stats.totalReviews;

    el.heatmapGrid.innerHTML = '';
    for (const cell of stats.cells) {
      const div = document.createElement('div');
      div.className = 'heatmap-cell';
      const level = cell.count === 0 ? 0 : cell.count < 5 ? 1 : cell.count < 15 ? 2 : cell.count < 30 ? 3 : 4;
      div.dataset.level = String(level);
      div.title = `${cell.date}: ${cell.count} review${cell.count === 1 ? '' : 's'}`;
      el.heatmapGrid.appendChild(div);
    }

    el.deckLibraryRows.innerHTML = '';
    if (state.decks.length === 0) {
      el.deckLibraryRows.innerHTML = '<div class="deck-library-empty">No decks yet — use New Deck below to create your first one.</div>';
      return;
    }
    for (const deck of state.decks) {
      const row = document.createElement('div');
      row.className = 'deck-library-row';
      row.innerHTML = `
        <span class="deck-library-name"><span class="deck-dot"></span>${escapeHtml(deck.name)}</span>
        <span class="deck-library-col">${deck.dueReviewCount > 0 ? `<span class="deck-badge badge-due">${deck.dueReviewCount}</span>` : ''}</span>
        <span class="deck-library-col">${deck.newCount > 0 ? `<span class="deck-badge badge-new">${deck.newCount}</span>` : ''}</span>
      `;
      row.addEventListener('click', () => selectDeck(deck.id));
      el.deckLibraryRows.appendChild(row);
    }
  }

  async function selectDeck(id) {
    stopSpeaking();
    if (id !== state.selectedDeckId) el.cardSearch.value = '';
    state.selectedDeckId = id;
    window.api.setLastSelectedDeck(id);
    renderDeckList();
    await renderDeckView();
  }

  async function renderDeckView() {
    const deck = state.decks.find((d) => d.id === state.selectedDeckId);
    if (!deck) {
      renderDashboard();
      showPane(el.dashboard);
      return;
    }
    showPane(el.deckView);
    el.deckTitle.textContent = deck.name;
    el.deckSubtitle.textContent = `${deck.cardCount} card${deck.cardCount === 1 ? '' : 's'} · ${deck.newCount} new`;
    el.studyHint.textContent = deck.dueCount > 0
      ? `${deck.dueCount} card${deck.dueCount === 1 ? '' : 's'} due`
      : 'Nothing due right now';
    el.todayStat.textContent = `Studied today: ${deck.todayCount}`;

    const studyBtn = document.getElementById('study-btn');
    studyBtn.disabled = deck.dueCount === 0;
    studyBtn.style.opacity = deck.dueCount === 0 ? 0.4 : 1;

    state.currentCards = await window.api.listCardsForDeck(deck.id);
    renderCardList();
  }

  function renderCardList() {
    const query = el.cardSearch.value.trim().toLowerCase();
    const cards = query
      ? state.currentCards.filter((c) => c.front.toLowerCase().includes(query) || c.back.toLowerCase().includes(query))
      : state.currentCards;

    el.cardList.innerHTML = '';
    if (state.currentCards.length === 0) {
      el.cardList.innerHTML = '<div class="no-cards">No cards yet. Add your first one above.</div>';
      return;
    }
    if (cards.length === 0) {
      el.cardList.innerHTML = '<div class="no-cards">No cards match your search.</div>';
      return;
    }
    for (const card of cards) {
      const row = document.createElement('div');
      row.className = 'card-row';
      row.innerHTML = `
        <span class="side front">${escapeHtml(card.front)}</span>
        <span class="side back">${escapeHtml(card.back)}</span>
        <div class="row-actions">
          <button class="icon-btn listen-card" title="Read aloud">🔊</button>
          <button class="icon-btn edit-card" title="Edit">✎</button>
          <button class="icon-btn delete-card" title="Delete">✕</button>
        </div>`;
      row.querySelector('.listen-card').addEventListener('click', (e) => {
        e.stopPropagation();
        speak(`${card.front}. ${card.back}`);
      });
      row.querySelector('.edit-card').addEventListener('click', (e) => {
        e.stopPropagation();
        openCardModal(card);
      });
      row.querySelector('.delete-card').addEventListener('click', async (e) => {
        e.stopPropagation();
        const result = await window.api.deleteCard(card.id);
        if (result && result.ok) await refresh();
      });
      el.cardList.appendChild(row);
    }
  }

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  // --- Read-aloud (dyslexia-friendly) ---
  let cachedVoices = [];
  if (window.speechSynthesis) {
    cachedVoices = window.speechSynthesis.getVoices();
    window.speechSynthesis.addEventListener('voiceschanged', () => {
      cachedVoices = window.speechSynthesis.getVoices();
    });
  }

  // Prefer natural-sounding voices (macOS "Enhanced"/"Premium" neural voices,
  // and known good default voices) and actively avoid the old novelty/robotic
  // system voices (Fred, Zarvox, Bubbles, etc.) that some OSes still ship.
  const NOVELTY_VOICE_NAMES = /fred|zarvox|trinoids|cellos|bells|bubbles|bahh|boing|deranged|hysterical|pipe organ|whisper|wobble|albert|bad news|good news|junior|kathy|ralph|jester|organ|rocko/i;
  const NATURAL_VOICE_NAMES = /ava|nathan|samantha|allison|susan|zoe|tom|karen|moira|tessa|daniel|serena|evan|siri/i;

  function scoreVoice(v) {
    let score = 0;
    if (/en[-_]US/i.test(v.lang)) score += 3;
    else if (v.lang && v.lang.toLowerCase().startsWith('en')) score += 2;
    if (/premium|enhanced|neural/i.test(v.name)) score += 5;
    if (NATURAL_VOICE_NAMES.test(v.name)) score += 3;
    if (NOVELTY_VOICE_NAMES.test(v.name)) score -= 10;
    if (v.default) score += 1;
    return score;
  }

  function pickVoice() {
    if (cachedVoices.length === 0) return null;
    return cachedVoices.slice().sort((a, b) => scoreVoice(b) - scoreVoice(a))[0];
  }

  function stopSpeaking() {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
  }

  function speak(text) {
    if (!window.speechSynthesis || !text) return;
    stopSpeaking();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.pitch = 1;
    const voice = pickVoice();
    if (voice) utterance.voice = voice;
    window.speechSynthesis.speak(utterance);
  }

  // --- Deck modal ---
  function openDeckModal(existingDeck) {
    el.modalTitle.textContent = existingDeck ? 'Rename Deck' : 'New Deck';
    el.modalBody.innerHTML = `
      <label for="deck-name-input">Deck name</label>
      <input id="deck-name-input" type="text" value="${existingDeck ? escapeHtml(existingDeck.name) : ''}" />
    `;
    el.modalBackdrop.hidden = false;
    const input = document.getElementById('deck-name-input');
    input.focus();
    input.select();

    const onConfirm = async () => {
      const name = input.value.trim();
      if (!name) return;
      if (existingDeck) {
        await window.api.renameDeck(existingDeck.id, name);
      } else {
        const deck = await window.api.addDeck(name);
        state.selectedDeckId = deck.id;
        window.api.setLastSelectedDeck(deck.id);
      }
      closeModal();
      await refresh();
    };
    bindModal(onConfirm);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') onConfirm();
    });
  }

  // --- Card modal ---
  function openCardModal(existingCard) {
    el.modalTitle.textContent = existingCard ? 'Edit Card' : 'New Card';
    el.modalBody.innerHTML = `
      <label for="card-front-input">Front</label>
      <textarea id="card-front-input">${existingCard ? escapeHtml(existingCard.front) : ''}</textarea>
      <label for="card-back-input">Back</label>
      <textarea id="card-back-input">${existingCard ? escapeHtml(existingCard.back) : ''}</textarea>
    `;
    el.modalBackdrop.hidden = false;
    const front = document.getElementById('card-front-input');
    front.focus();

    const onConfirm = async () => {
      const f = front.value.trim();
      const b = document.getElementById('card-back-input').value.trim();
      if (!f || !b) return;
      if (existingCard) {
        await window.api.updateCard(existingCard.id, f, b);
      } else {
        await window.api.addCard(state.selectedDeckId, f, b);
      }
      closeModal();
      await refresh();
    };
    bindModal(onConfirm);
  }

  // --- Magic Add modal: paste many lines, split each into a front/back pair ---
  function parseMagicLines(text) {
    const pairs = [];
    for (const rawLine of text.split('\n')) {
      const line = rawLine.trim();
      if (!line) continue;
      let front = null;
      let back = null;
      if (line.includes('\t')) {
        [front, back] = line.split('\t');
      } else if (line.includes('::')) {
        [front, back] = line.split('::');
      } else if (line.includes(' - ')) {
        const idx = line.indexOf(' - ');
        front = line.slice(0, idx);
        back = line.slice(idx + 3);
      }
      if (front != null && back != null) {
        front = front.trim();
        back = back.trim();
        if (front && back) pairs.push({ front, back });
      }
    }
    return pairs;
  }

  function openMagicAddModal() {
    const existingDeck = state.decks.find((d) => d.id === state.selectedDeckId);
    el.modalTitle.textContent = 'Magic Add';
    el.modalBody.innerHTML = `
      ${existingDeck
        ? `<label>Adding to</label><p class="hint">${escapeHtml(existingDeck.name)}</p>`
        : `<label for="magic-deck-name">New deck name</label><input id="magic-deck-name" type="text" value="Quick Add" />`}
      <label for="magic-textarea">One card per line</label>
      <p class="hint">Separate front and back with a Tab, "::", or " - ". Paste straight from a spreadsheet or type your own list.</p>
      <textarea id="magic-textarea" class="magic-textarea" placeholder="perro :: dog&#10;gato :: cat"></textarea>
    `;
    el.modalBackdrop.hidden = false;
    document.getElementById('magic-textarea').focus();

    const onConfirm = async () => {
      const text = document.getElementById('magic-textarea').value;
      const pairs = parseMagicLines(text);
      if (pairs.length === 0) return;

      let deckId = state.selectedDeckId;
      if (!deckId) {
        const nameInput = document.getElementById('magic-deck-name');
        const deck = await window.api.addDeck((nameInput && nameInput.value.trim()) || 'Quick Add');
        deckId = deck.id;
      }
      await window.api.addCardsBulk(deckId, pairs);
      state.selectedDeckId = deckId;
      window.api.setLastSelectedDeck(deckId);
      closeModal();
      await refresh();
    };
    bindModal(onConfirm);
  }

  let currentConfirmHandler = null;
  function bindModal(onConfirm) {
    currentConfirmHandler = onConfirm;
  }

  function closeModal() {
    el.modalBackdrop.hidden = true;
    el.modalBody.innerHTML = '';
    currentConfirmHandler = null;
  }

  el.modalConfirm.addEventListener('click', () => currentConfirmHandler && currentConfirmHandler());
  el.modalCancel.addEventListener('click', closeModal);
  el.modalBackdrop.addEventListener('click', (e) => {
    if (e.target === el.modalBackdrop) closeModal();
  });

  // --- Study mode ---
  async function startStudy() {
    if (!state.selectedDeckId) return;
    const cards = await window.api.dueCardsForDeck(state.selectedDeckId);
    if (cards.length === 0) {
      showPane(el.studyDone);
      return;
    }
    state.studyQueue = cards;
    state.studyIndex = 0;
    state.showingAnswer = false;
    showPane(el.studyView);
    renderStudyCard();
  }

  function renderStudyCard() {
    stopSpeaking();
    const card = state.studyQueue[state.studyIndex];
    if (!card) {
      showPane(el.studyDone);
      return;
    }
    state.showingAnswer = false;
    el.studyProgress.textContent = `${state.studyIndex + 1} / ${state.studyQueue.length}`;
    el.flashcardFace.innerHTML = `<div>${escapeHtml(card.front)}</div>`;
    el.showAnswerBtn.hidden = false;
    el.ratingButtons.hidden = true;
  }

  function revealAnswer() {
    const card = state.studyQueue[state.studyIndex];
    if (!card || state.showingAnswer) return;
    state.showingAnswer = true;
    el.flashcardFace.innerHTML = `
      <div>${escapeHtml(card.front)}</div>
      <div class="flashcard-back">${escapeHtml(card.back)}</div>
    `;
    el.showAnswerBtn.hidden = true;
    el.ratingButtons.hidden = false;
  }

  function listenToCurrentCard() {
    const card = state.studyQueue[state.studyIndex];
    if (!card) return;
    speak(state.showingAnswer ? `${card.front}. ${card.back}` : card.front);
  }

  async function rateCurrentCard(rating) {
    const card = state.studyQueue[state.studyIndex];
    if (!card) return;
    stopSpeaking();
    await window.api.rateCard(card.id, rating);
    state.studyIndex += 1;
    if (state.studyIndex >= state.studyQueue.length) {
      await refresh();
      showPane(el.studyDone);
    } else {
      renderStudyCard();
    }
  }

  // --- Actions (shared between buttons and native menu) ---
  function doAddDeck() {
    openDeckModal(null);
  }

  function doAddCard() {
    if (!state.selectedDeckId) return;
    openCardModal(null);
  }

  async function doExportDeck() {
    if (state.selectedDeckId) await window.api.exportDeck(state.selectedDeckId);
  }

  async function doImportDeck() {
    const result = await window.api.importDeck();
    if (result && result.ok) {
      await refresh();
      await selectDeck(result.deck.id);
    }
  }

  async function doImportApkg() {
    const result = await window.api.importApkg();
    if (result && result.ok) {
      await refresh();
      await selectDeck(result.deck.id);
    }
  }

  // --- Event wiring ---
  el.homeBtn.addEventListener('click', goHome);
  document.getElementById('new-deck-btn').addEventListener('click', doAddDeck);
  document.getElementById('magic-add-btn').addEventListener('click', openMagicAddModal);
  document.getElementById('add-apkg-btn').addEventListener('click', doImportApkg);
  document.getElementById('rename-deck-btn').addEventListener('click', () => {
    const deck = state.decks.find((d) => d.id === state.selectedDeckId);
    if (deck) openDeckModal(deck);
  });
  document.getElementById('delete-deck-btn').addEventListener('click', async () => {
    if (!state.selectedDeckId) return;
    const result = await window.api.deleteDeck(state.selectedDeckId);
    if (result && result.ok) {
      state.selectedDeckId = null;
      await refresh();
    }
  });
  document.getElementById('export-deck-btn').addEventListener('click', doExportDeck);
  document.getElementById('import-btn').addEventListener('click', doImportDeck);
  document.getElementById('add-card-btn').addEventListener('click', doAddCard);
  document.getElementById('study-btn').addEventListener('click', startStudy);
  document.getElementById('exit-study-btn').addEventListener('click', () => {
    stopSpeaking();
    refresh();
  });
  document.getElementById('done-back-btn').addEventListener('click', refresh);
  document.getElementById('show-answer-btn').addEventListener('click', revealAnswer);
  el.listenBtn.addEventListener('click', listenToCurrentCard);
  el.flashcard.addEventListener('click', revealAnswer);
  el.ratingButtons.addEventListener('click', (e) => {
    const btn = e.target.closest('.rate-btn');
    if (btn) rateCurrentCard(btn.dataset.rating);
  });
  el.cardSearch.addEventListener('input', renderCardList);

  document.addEventListener('keydown', (e) => {
    if (!el.studyView.hidden) {
      if (e.code === 'Space') {
        e.preventDefault();
        if (!state.showingAnswer) revealAnswer();
      } else if (state.showingAnswer && (e.key === '1' || e.key === 'ArrowLeft')) {
        rateCurrentCard('again');
      } else if (state.showingAnswer && (e.key === '2' || e.key === 'ArrowRight')) {
        rateCurrentCard('good');
      }
    }
  });

  // Paste a previously-exported deck's JSON anywhere outside a text field to import it.
  document.addEventListener('paste', async (e) => {
    const tag = document.activeElement && document.activeElement.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    const text = e.clipboardData && e.clipboardData.getData('text/plain');
    if (!text) return;
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      return;
    }
    if (!parsed || !Array.isArray(parsed.cards)) return;
    const result = await window.api.importDeckFromText(text);
    if (result && result.ok) {
      await refresh();
      await selectDeck(result.deck.id);
    }
  });

  // --- Native menu wiring ---
  window.api.onMenuNewDeck(doAddDeck);
  window.api.onMenuNewCard(doAddCard);
  window.api.onMenuImportDeck(doImportDeck);
  window.api.onMenuImportApkg(doImportApkg);
  window.api.onMenuExportDeck(doExportDeck);
  window.api.onMenuFocusSearch(() => {
    if (!el.deckView.hidden) el.cardSearch.focus();
  });
  window.api.onMenuStudyNow(() => {
    if (!el.deckView.hidden) startStudy();
  });

  refresh();
})();
