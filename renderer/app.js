(() => {
  const state = {
    decks: [],
    selectedDeckId: null,
    studyQueue: [],
    studyIndex: 0,
    showingAnswer: false,
  };

  const el = {
    deckList: document.getElementById('deck-list'),
    emptyState: document.getElementById('empty-state'),
    deckView: document.getElementById('deck-view'),
    studyView: document.getElementById('study-view'),
    studyDone: document.getElementById('study-done'),
    deckTitle: document.getElementById('deck-title'),
    deckSubtitle: document.getElementById('deck-subtitle'),
    studyHint: document.getElementById('study-hint'),
    cardList: document.getElementById('card-list'),
    flashcardFace: document.getElementById('flashcard-face'),
    flashcard: document.getElementById('flashcard'),
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
    return [el.emptyState, el.deckView, el.studyView, el.studyDone];
  }

  function showPane(pane) {
    for (const p of panes()) p.hidden = p !== pane;
  }

  async function refresh() {
    const data = await window.api.getAll();
    state.decks = data.decks;
    renderDeckList();
    if (state.selectedDeckId && !state.decks.find((d) => d.id === state.selectedDeckId)) {
      state.selectedDeckId = null;
    }
    if (state.selectedDeckId) {
      await renderDeckView();
    } else {
      showPane(el.emptyState);
    }
  }

  function renderDeckList() {
    el.deckList.innerHTML = '';
    for (const deck of state.decks) {
      const item = document.createElement('div');
      item.className = 'deck-item' + (deck.id === state.selectedDeckId ? ' selected' : '');
      item.innerHTML = `<span class="deck-name">${escapeHtml(deck.name)}</span>` +
        (deck.dueCount > 0 ? `<span class="deck-badge">${deck.dueCount}</span>` : '');
      item.addEventListener('click', () => selectDeck(deck.id));
      el.deckList.appendChild(item);
    }
  }

  async function selectDeck(id) {
    state.selectedDeckId = id;
    renderDeckList();
    await renderDeckView();
  }

  async function renderDeckView() {
    const deck = state.decks.find((d) => d.id === state.selectedDeckId);
    if (!deck) {
      showPane(el.emptyState);
      return;
    }
    showPane(el.deckView);
    el.deckTitle.textContent = deck.name;
    el.deckSubtitle.textContent = `${deck.cardCount} card${deck.cardCount === 1 ? '' : 's'} · ${deck.newCount} new`;
    el.studyHint.textContent = deck.dueCount > 0
      ? `${deck.dueCount} card${deck.dueCount === 1 ? '' : 's'} due`
      : 'Nothing due right now';

    const studyBtn = document.getElementById('study-btn');
    studyBtn.disabled = deck.dueCount === 0;
    studyBtn.style.opacity = deck.dueCount === 0 ? 0.4 : 1;

    const cards = await window.api.listCardsForDeck(deck.id);
    el.cardList.innerHTML = '';
    if (cards.length === 0) {
      el.cardList.innerHTML = '<div class="no-cards">No cards yet. Add your first one above.</div>';
      return;
    }
    for (const card of cards) {
      const row = document.createElement('div');
      row.className = 'card-row';
      row.innerHTML = `
        <span class="side front">${escapeHtml(card.front)}</span>
        <span class="side back">${escapeHtml(card.back)}</span>
        <div class="row-actions">
          <button class="icon-btn edit-card" title="Edit">✎</button>
          <button class="icon-btn delete-card" title="Delete">✕</button>
        </div>`;
      row.querySelector('.edit-card').addEventListener('click', (e) => {
        e.stopPropagation();
        openCardModal(card);
      });
      row.querySelector('.delete-card').addEventListener('click', async (e) => {
        e.stopPropagation();
        await window.api.deleteCard(card.id);
        await refresh();
      });
      el.cardList.appendChild(row);
    }
  }

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
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

  async function rateCurrentCard(rating) {
    const card = state.studyQueue[state.studyIndex];
    if (!card) return;
    await window.api.rateCard(card.id, rating);
    state.studyIndex += 1;
    if (state.studyIndex >= state.studyQueue.length) {
      await refresh();
      showPane(el.studyDone);
    } else {
      renderStudyCard();
    }
  }

  // --- Event wiring ---
  document.getElementById('add-deck-btn').addEventListener('click', () => openDeckModal(null));
  document.getElementById('rename-deck-btn').addEventListener('click', () => {
    const deck = state.decks.find((d) => d.id === state.selectedDeckId);
    if (deck) openDeckModal(deck);
  });
  document.getElementById('delete-deck-btn').addEventListener('click', async () => {
    if (!state.selectedDeckId) return;
    await window.api.deleteDeck(state.selectedDeckId);
    state.selectedDeckId = null;
    await refresh();
  });
  document.getElementById('export-deck-btn').addEventListener('click', async () => {
    if (state.selectedDeckId) await window.api.exportDeck(state.selectedDeckId);
  });
  document.getElementById('import-btn').addEventListener('click', async () => {
    const result = await window.api.importDeck();
    if (result && result.ok) await refresh();
  });
  document.getElementById('add-card-btn').addEventListener('click', () => openCardModal(null));
  document.getElementById('study-btn').addEventListener('click', startStudy);
  document.getElementById('exit-study-btn').addEventListener('click', refresh);
  document.getElementById('done-back-btn').addEventListener('click', refresh);
  document.getElementById('show-answer-btn').addEventListener('click', revealAnswer);
  el.flashcard.addEventListener('click', revealAnswer);
  el.ratingButtons.addEventListener('click', (e) => {
    const btn = e.target.closest('.rate-btn');
    if (btn) rateCurrentCard(btn.dataset.rating);
  });

  document.addEventListener('keydown', (e) => {
    if (!el.studyView.hidden) {
      if (e.code === 'Space') {
        e.preventDefault();
        if (!state.showingAnswer) revealAnswer();
      } else if (state.showingAnswer && ['1', '2', '3', '4'].includes(e.key)) {
        const map = { 1: 'again', 2: 'hard', 3: 'good', 4: 'easy' };
        rateCurrentCard(map[e.key]);
      }
    }
  });

  refresh();
})();
