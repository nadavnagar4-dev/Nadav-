(() => {
  'use strict';

  // ---------- Storage (localStorage-backed, ported from the desktop app's store.js) ----------
  const STORAGE_KEY = 'macanki-data-v1';
  const MINUTE = 60 * 1000;
  const DAY = 24 * 60 * 60 * 1000;

  function makeId() {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  function emptyState() {
    return { decks: [], cards: [], log: [], settings: { lastSelectedDeckId: null } };
  }

  function dateKey(ts) {
    const d = new Date(ts);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function isToday(ts) {
    return dateKey(ts) === dateKey(Date.now());
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return emptyState();
      const parsed = JSON.parse(raw);
      if (!parsed.decks || !parsed.cards) return emptyState();
      if (!parsed.log) parsed.log = [];
      if (!parsed.settings) parsed.settings = { lastSelectedDeckId: null };
      return parsed;
    } catch (e) {
      return emptyState();
    }
  }

  let state = loadState();
  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      showToast("Couldn't save — your browser's storage may be full.");
    }
  }

  const Store = {
    getStats(days = 140) {
      const counts = {};
      for (const entry of state.log) {
        const key = dateKey(entry.ts);
        counts[key] = (counts[key] || 0) + 1;
      }
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const cells = [];
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const key = dateKey(d.getTime());
        cells.push({ date: key, count: counts[key] || 0 });
      }
      let streak = 0;
      for (let i = 0; ; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        if ((counts[dateKey(d.getTime())] || 0) > 0) streak++;
        else break;
      }
      const activeDays = Object.keys(counts).length;
      const totalReviews = state.log.length;
      const avgPerDay = activeDays > 0 ? Math.round(totalReviews / activeDays) : 0;
      const bestDay = Object.values(counts).reduce((m, v) => Math.max(m, v), 0);
      const todayCount = counts[dateKey(today.getTime())] || 0;
      return { cells, streak, avgPerDay, bestDay, totalReviews, todayCount };
    },

    getAll() {
      const now = Date.now();
      const decks = state.decks.map((d) => {
        const deckCards = state.cards.filter((c) => c.deckId === d.id);
        const newCount = deckCards.filter((c) => c.state === 'new').length;
        const dueReviewCount = deckCards.filter((c) => c.state !== 'new' && c.due <= now).length;
        const todayCount = state.log.filter((e) => e.deckId === d.id && isToday(e.ts)).length;
        return {
          ...d,
          cardCount: deckCards.length,
          newCount,
          dueReviewCount,
          dueCount: newCount + dueReviewCount,
          todayCount,
        };
      });
      return { decks, cards: state.cards, settings: state.settings, stats: this.getStats() };
    },

    setLastSelectedDeck(id) {
      state.settings.lastSelectedDeckId = id;
      persist();
    },

    addDeck(name, parentId = null) {
      const deck = { id: makeId(), name: name.trim() || 'Untitled Deck', parentId: parentId || null, createdAt: Date.now() };
      state.decks.push(deck);
      persist();
      return deck;
    },

    // Splits "Parent::Child::Grandchild" into a chain of decks, reusing any
    // segment that already exists under the same parent (so adding
    // "School::Biology" and later "School::Chemistry" share one "School").
    // Returns the leaf deck — the one that actually holds new cards.
    addDeckPath(fullName) {
      const segments = fullName.split('::').map((s) => s.trim()).filter(Boolean);
      if (segments.length === 0) segments.push('Untitled Deck');
      let parentId = null;
      let deck = null;
      for (const segment of segments) {
        deck = state.decks.find((d) => d.name === segment && (d.parentId || null) === parentId);
        if (!deck) {
          deck = { id: makeId(), name: segment, parentId, createdAt: Date.now() };
          state.decks.push(deck);
        }
        parentId = deck.id;
      }
      persist();
      return deck;
    },

    renameDeck(id, name) {
      const deck = state.decks.find((d) => d.id === id);
      if (!deck) return null;
      deck.name = name.trim() || deck.name;
      persist();
      return deck;
    },

    // A deck's id, plus every descendant's id (its children, their children, ...).
    collectSubtreeIds(rootId) {
      const ids = new Set([rootId]);
      let added = true;
      while (added) {
        added = false;
        for (const d of state.decks) {
          if (d.parentId && ids.has(d.parentId) && !ids.has(d.id)) {
            ids.add(d.id);
            added = true;
          }
        }
      }
      return ids;
    },

    deleteDeck(id) {
      const ids = this.collectSubtreeIds(id);
      state.decks = state.decks.filter((d) => !ids.has(d.id));
      state.cards = state.cards.filter((c) => !ids.has(c.deckId));
      state.log = state.log.filter((e) => !ids.has(e.deckId));
      if (ids.has(state.settings.lastSelectedDeckId)) state.settings.lastSelectedDeckId = null;
      persist();
    },

    addCard(deckId, front, back) {
      const card = {
        id: makeId(), deckId, front: front.trim(), back: back.trim(),
        createdAt: Date.now(), due: Date.now(), interval: 0, ease: 2.5, reps: 0, lapses: 0, state: 'new',
      };
      state.cards.push(card);
      persist();
      return card;
    },

    addCardsBulk(deckId, pairs) {
      const added = [];
      for (const { front, back } of pairs) {
        if (!front || !back) continue;
        const card = {
          id: makeId(), deckId, front: front.trim(), back: back.trim(),
          createdAt: Date.now(), due: Date.now(), interval: 0, ease: 2.5, reps: 0, lapses: 0, state: 'new',
        };
        state.cards.push(card);
        added.push(card);
      }
      persist();
      return added;
    },

    updateCard(id, front, back) {
      const card = state.cards.find((c) => c.id === id);
      if (!card) return null;
      card.front = front.trim();
      card.back = back.trim();
      persist();
      return card;
    },

    deleteCard(id) {
      state.cards = state.cards.filter((c) => c.id !== id);
      persist();
    },

    cardsForDeck(deckId) {
      return state.cards.filter((c) => c.deckId === deckId);
    },

    dueCardsForDeck(deckId) {
      const now = Date.now();
      return state.cards
        .filter((c) => c.deckId === deckId && c.due <= now)
        .sort((a, b) => (a.state === 'new' ? 1 : 0) - (b.state === 'new' ? 1 : 0) || a.due - b.due);
    },

    // Same as dueCardsForDeck, but pulls in every descendant deck's due cards
    // too — studying a deck with subdecks studies the whole branch.
    dueCardsForDeckTree(deckId) {
      const ids = this.collectSubtreeIds(deckId);
      const now = Date.now();
      return state.cards
        .filter((c) => ids.has(c.deckId) && c.due <= now)
        .sort((a, b) => (a.state === 'new' ? 1 : 0) - (b.state === 'new' ? 1 : 0) || a.due - b.due);
    },

    // Simplified SM-2 style scheduler, modeled after Anki's rating scale.
    rateCard(id, rating) {
      const card = state.cards.find((c) => c.id === id);
      if (!card) return null;

      if (rating === 'again') {
        card.lapses += 1;
        card.ease = Math.max(1.3, card.ease - 0.2);
        card.interval = 0;
        card.state = 'learning';
        card.due = Date.now() + 1 * MINUTE;
      } else if (rating === 'hard') {
        card.ease = Math.max(1.3, card.ease - 0.15);
        if (card.state === 'new' || card.state === 'learning') {
          card.interval = 1;
          card.due = Date.now() + 10 * MINUTE;
        } else {
          card.interval = Math.max(1, Math.round(card.interval * 1.2));
          card.due = Date.now() + card.interval * DAY;
        }
        card.state = 'review';
      } else if (rating === 'good') {
        if (card.state === 'new' || card.state === 'learning') {
          card.interval = 1;
          card.due = Date.now() + 1 * DAY;
        } else {
          card.interval = Math.max(1, Math.round(card.interval * card.ease));
          card.due = Date.now() + card.interval * DAY;
        }
        card.state = 'review';
      } else if (rating === 'easy') {
        card.ease = card.ease + 0.15;
        if (card.state === 'new' || card.state === 'learning') {
          card.interval = 4;
          card.due = Date.now() + 4 * DAY;
        } else {
          card.interval = Math.max(1, Math.round(card.interval * card.ease * 1.3));
          card.due = Date.now() + card.interval * DAY;
        }
        card.state = 'review';
      }

      card.reps += 1;
      state.log.push({ cardId: card.id, deckId: card.deckId, rating, ts: Date.now() });
      persist();
      return card;
    },

    importDeck(name, cards) {
      const deck = this.addDeck(name);
      for (const c of cards) {
        if (c && c.front && c.back) this.addCard(deck.id, c.front, c.back);
      }
      return deck;
    },

    exportDeck(deckId) {
      const deck = state.decks.find((d) => d.id === deckId);
      if (!deck) return null;
      const cards = this.cardsForDeck(deckId).map((c) => ({ front: c.front, back: c.back }));
      return { name: deck.name, cards };
    },
  };

  // ---------- Toast (lightweight, non-blocking feedback) ----------
  let toastTimer = null;
  function showToast(message) {
    const el = document.getElementById('toast');
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
  }

  // ---------- Auto-save drafts (protects in-progress typing from a crash/refresh
  // while a modal is open — normal Cancel/Save/backdrop-dismiss clears the draft) ----------
  function draftKey(kind, contextId) {
    return `macanki-draft-${kind}${contextId != null ? ':' + contextId : ''}`;
  }
  function saveDraft(kind, contextId, data) {
    try {
      localStorage.setItem(draftKey(kind, contextId), JSON.stringify(data));
    } catch (e) {
      /* drafts are a nice-to-have; never block on storage errors */
    }
  }
  function loadDraftValue(kind, contextId) {
    try {
      const raw = localStorage.getItem(draftKey(kind, contextId));
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }
  function clearAllDrafts() {
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k && k.startsWith('macanki-draft-')) localStorage.removeItem(k);
      }
    } catch (e) {
      /* ignore */
    }
  }
  function restoreDraft(kind, contextId, input) {
    const val = loadDraftValue(kind, contextId);
    if (typeof val === 'string' && val) input.value = val;
  }

  // ---------- App UI ----------
  const appState = {
    decks: [],
    stats: null,
    selectedDeckId: null,
    currentCards: [],
    studyQueue: [],
    studyIndex: 0,
    showingAnswer: false,
  };

  // ---------- Deck tree (nested "sections", like Anki's Parent::Child decks) ----------
  // Tracks only what's been explicitly collapsed — anything absent (including
  // a section created just now) defaults to expanded, with no separate "seed
  // the initial state" step that could go stale as new sections appear.
  const collapsedDeckIds = new Set();
  let deckTreeById = new Map(); // refreshed by buildDeckTree(); id -> node with rollup* fields

  function buildDeckTree(decks) {
    const byId = new Map();
    for (const d of decks) byId.set(d.id, { ...d, children: [] });
    const roots = [];
    for (const node of byId.values()) {
      if (node.parentId && byId.has(node.parentId)) {
        byId.get(node.parentId).children.push(node);
      } else {
        roots.push(node);
      }
    }
    const sortRec = (nodes) => {
      nodes.sort((a, b) => a.name.localeCompare(b.name));
      nodes.forEach((n) => sortRec(n.children));
    };
    sortRec(roots);

    const rollup = (node) => {
      let newCount = node.newCount;
      let dueReviewCount = node.dueReviewCount;
      let cardCount = node.cardCount;
      let todayCount = node.todayCount;
      for (const child of node.children) {
        rollup(child);
        newCount += child.rollupNewCount;
        dueReviewCount += child.rollupDueReviewCount;
        cardCount += child.rollupCardCount;
        todayCount += child.rollupTodayCount;
      }
      node.rollupNewCount = newCount;
      node.rollupDueReviewCount = dueReviewCount;
      node.rollupDueCount = newCount + dueReviewCount;
      node.rollupCardCount = cardCount;
      node.rollupTodayCount = todayCount;
    };
    roots.forEach(rollup);

    deckTreeById = byId;
    return roots;
  }

  function flattenVisibleTree(roots, depth = 0, out = []) {
    for (const node of roots) {
      out.push({ node, depth });
      if (node.children.length > 0 && !collapsedDeckIds.has(node.id)) {
        flattenVisibleTree(node.children, depth + 1, out);
      }
    }
    return out;
  }

  function toggleDeckExpanded(id) {
    if (collapsedDeckIds.has(id)) collapsedDeckIds.delete(id);
    else collapsedDeckIds.add(id);
  }

  function treeRowHtml(node, expandBtnClass) {
    const toggle = node.children.length > 0
      ? `<button class="${expandBtnClass}" data-id="${node.id}">${collapsedDeckIds.has(node.id) ? '+' : '−'}</button>`
      : `<span class="${expandBtnClass} tree-toggle-spacer"></span>`;
    return toggle;
  }

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
    jsonFileInput: document.getElementById('json-file-input'),
    apkgFileInput: document.getElementById('apkg-file-input'),
  };

  function panes() {
    return [el.dashboard, el.deckView, el.studyView, el.studyDone];
  }

  function showPane(pane) {
    for (const p of panes()) p.hidden = p !== pane;
  }

  function refresh() {
    const data = Store.getAll();
    appState.decks = data.decks;
    appState.stats = data.stats;

    renderDeckList();
    if (appState.selectedDeckId && !appState.decks.find((d) => d.id === appState.selectedDeckId)) {
      appState.selectedDeckId = null;
    }
    if (appState.selectedDeckId) {
      renderDeckView();
    } else {
      renderDashboard();
      showPane(el.dashboard);
    }
  }

  function goHome() {
    stopSpeaking();
    appState.selectedDeckId = null;
    Store.setLastSelectedDeck(null);
    renderDeckList();
    renderDashboard();
    showPane(el.dashboard);
  }

  function renderDeckList() {
    el.homeBtn.classList.toggle('selected', !appState.selectedDeckId);
    el.deckList.innerHTML = '';
    const roots = buildDeckTree(appState.decks);
    const flat = flattenVisibleTree(roots);
    for (const { node, depth } of flat) {
      const item = document.createElement('div');
      item.className = 'deck-item' + (node.id === appState.selectedDeckId ? ' selected' : '');
      item.style.paddingLeft = `${10 + depth * 16}px`;
      const badges = [];
      if (node.rollupNewCount > 0) badges.push(`<span class="deck-badge badge-new">${node.rollupNewCount}</span>`);
      if (node.rollupDueReviewCount > 0) badges.push(`<span class="deck-badge badge-due">${node.rollupDueReviewCount}</span>`);
      item.innerHTML = `${treeRowHtml(node, 'tree-toggle')}<span class="deck-name">${escapeHtml(node.name)}</span><div class="deck-badges">${badges.join('')}</div>`;
      const toggleBtn = item.querySelector('.tree-toggle:not(.tree-toggle-spacer)');
      if (toggleBtn) {
        toggleBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          toggleDeckExpanded(node.id);
          renderDeckList();
        });
      }
      item.addEventListener('click', () => selectDeck(node.id));
      el.deckList.appendChild(item);
    }
  }

  function renderDashboard() {
    const stats = appState.stats || { cells: [], streak: 0, avgPerDay: 0, bestDay: 0, totalReviews: 0, todayCount: 0 };
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
    if (appState.decks.length === 0) {
      el.deckLibraryRows.innerHTML = '<div class="deck-library-empty">No decks yet — use New Deck below to create your first one.</div>';
      return;
    }
    const roots = buildDeckTree(appState.decks);
    const flat = flattenVisibleTree(roots);
    for (const { node, depth } of flat) {
      const row = document.createElement('div');
      row.className = 'deck-library-row';
      row.innerHTML = `
        <span class="deck-library-name" style="padding-left:${depth * 16}px">${treeRowHtml(node, 'tree-toggle')}<span class="deck-dot"></span>${escapeHtml(node.name)}</span>
        <span class="deck-library-col">${node.rollupDueReviewCount > 0 ? `<span class="deck-badge badge-due">${node.rollupDueReviewCount}</span>` : ''}</span>
        <span class="deck-library-col">${node.rollupNewCount > 0 ? `<span class="deck-badge badge-new">${node.rollupNewCount}</span>` : ''}</span>
      `;
      const toggleBtn = row.querySelector('.tree-toggle:not(.tree-toggle-spacer)');
      if (toggleBtn) {
        toggleBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          toggleDeckExpanded(node.id);
          renderDashboard();
        });
      }
      row.addEventListener('click', () => selectDeck(node.id));
      el.deckLibraryRows.appendChild(row);
    }
  }

  function selectDeck(id) {
    stopSpeaking();
    if (id !== appState.selectedDeckId) el.cardSearch.value = '';
    appState.selectedDeckId = id;
    Store.setLastSelectedDeck(id);
    renderDeckList();
    renderDeckView();
  }

  function renderDeckView() {
    const deck = appState.decks.find((d) => d.id === appState.selectedDeckId);
    if (!deck) {
      renderDashboard();
      showPane(el.dashboard);
      return;
    }
    showPane(el.deckView);
    const rollup = deckTreeById.get(deck.id) || deck;
    const hasChildren = rollup.children && rollup.children.length > 0;
    el.deckTitle.textContent = deck.name;
    el.deckSubtitle.textContent = hasChildren
      ? `${deck.cardCount} card${deck.cardCount === 1 ? '' : 's'} directly here · ${rollup.rollupCardCount} across all sections`
      : `${deck.cardCount} card${deck.cardCount === 1 ? '' : 's'} · ${deck.newCount} new`;
    el.studyHint.textContent = rollup.rollupDueCount > 0
      ? `${rollup.rollupDueCount} card${rollup.rollupDueCount === 1 ? '' : 's'} due${hasChildren ? ' across all sections' : ''}`
      : 'Nothing due right now';
    el.todayStat.textContent = `Studied today: ${rollup.rollupTodayCount}`;

    const studyBtn = document.getElementById('study-btn');
    studyBtn.disabled = rollup.rollupDueCount === 0;
    studyBtn.style.opacity = rollup.rollupDueCount === 0 ? 0.4 : 1;

    appState.currentCards = Store.cardsForDeck(deck.id);
    renderCardList();
  }

  function renderCardList() {
    const query = el.cardSearch.value.trim().toLowerCase();
    const cards = query
      ? appState.currentCards.filter((c) => c.front.toLowerCase().includes(query) || c.back.toLowerCase().includes(query))
      : appState.currentCards;

    el.cardList.innerHTML = '';
    if (appState.currentCards.length === 0) {
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
      row.querySelector('.delete-card').addEventListener('click', (e) => {
        e.stopPropagation();
        openConfirmModal({
          title: 'Delete this card?',
          message: card.front,
          confirmLabel: 'Delete Card',
          onConfirm: () => {
            Store.deleteCard(card.id);
            refresh();
          },
        });
      });
      el.cardList.appendChild(row);
    }
  }

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  // ---------- Read-aloud (dyslexia-friendly) ----------
  const NOVELTY_VOICE_NAMES = /fred|zarvox|trinoids|cellos|bells|bubbles|bahh|boing|deranged|hysterical|pipe organ|whisper|wobble|albert|bad news|good news|junior|kathy|ralph|jester|organ|rocko/i;
  const NATURAL_VOICE_NAMES = /ava|nathan|samantha|allison|susan|zoe|tom|karen|moira|tessa|daniel|serena|evan|siri/i;
  // Quality tier is often encoded in voiceURI (e.g. "com.apple.voice.premium.en-US.Ava"),
  // not necessarily in the human-readable name — check both.
  const QUALITY_MARKERS = /premium|enhanced|neural|siri/i;

  function scoreVoice(v) {
    let score = 0;
    if (/en[-_]US/i.test(v.lang)) score += 3;
    else if (v.lang && v.lang.toLowerCase().startsWith('en')) score += 2;
    if (QUALITY_MARKERS.test(v.name) || QUALITY_MARKERS.test(v.voiceURI || '')) score += 5;
    if (NATURAL_VOICE_NAMES.test(v.name)) score += 3;
    if (NOVELTY_VOICE_NAMES.test(v.name)) score -= 10;
    if (/compact/i.test(v.voiceURI || '')) score -= 2;
    if (v.default) score += 1;
    return score;
  }

  // Queried fresh every time rather than cached at page load: getVoices()
  // very commonly returns an empty list on the very first call (especially
  // on Safari), and its 'voiceschanged' event is not reliable everywhere —
  // caching that first empty result would silently disable voice selection
  // for the rest of the session.
  function pickVoice() {
    if (!window.speechSynthesis) return null;
    const voices = window.speechSynthesis.getVoices();
    if (!voices || voices.length === 0) return null;
    return voices.slice().sort((a, b) => scoreVoice(b) - scoreVoice(a))[0];
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

  // ---------- Deck modal ----------
  function openDeckModal(existingDeck) {
    el.modalTitle.textContent = existingDeck ? 'Rename Deck' : 'New Deck';
    el.modalBody.innerHTML = `
      <label for="deck-name-input">Deck name</label>
      <input id="deck-name-input" type="text" value="${existingDeck ? escapeHtml(existingDeck.name) : ''}" />
      ${existingDeck ? '' : '<p class="hint">Use "::" to nest it in a section, e.g. "School::Biology::Exam 1".</p>'}
    `;
    el.modalConfirm.textContent = 'Save';
    el.modalConfirm.className = 'primary-btn';
    el.modalBackdrop.hidden = false;
    const input = document.getElementById('deck-name-input');
    restoreDraft('deck', null, input);
    input.focus();
    input.select();
    input.addEventListener('input', () => saveDraft('deck', null, input.value));

    const onConfirm = () => {
      const name = input.value.trim();
      if (!name) return;
      if (existingDeck) {
        Store.renameDeck(existingDeck.id, name);
      } else {
        const deck = Store.addDeckPath(name);
        appState.selectedDeckId = deck.id;
        Store.setLastSelectedDeck(deck.id);
      }
      closeModal();
      refresh();
    };
    bindModal(onConfirm);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') onConfirm();
    });
  }

  // ---------- Card modal ----------
  function openCardModal(existingCard) {
    el.modalTitle.textContent = existingCard ? 'Edit Card' : 'New Card';
    el.modalBody.innerHTML = `
      <label for="card-front-input">Front</label>
      <textarea id="card-front-input">${existingCard ? escapeHtml(existingCard.front) : ''}</textarea>
      <label for="card-back-input">Back</label>
      <textarea id="card-back-input">${existingCard ? escapeHtml(existingCard.back) : ''}</textarea>
    `;
    el.modalConfirm.textContent = 'Save';
    el.modalConfirm.className = 'primary-btn';
    el.modalBackdrop.hidden = false;
    const frontEl = document.getElementById('card-front-input');
    const backEl = document.getElementById('card-back-input');
    const draftContext = existingCard ? existingCard.id : 'new';
    const draft = loadDraftValue('card', draftContext);
    if (draft) {
      frontEl.value = draft.front || '';
      backEl.value = draft.back || '';
    }
    const saveCardDraft = () => saveDraft('card', draftContext, { front: frontEl.value, back: backEl.value });
    frontEl.addEventListener('input', saveCardDraft);
    backEl.addEventListener('input', saveCardDraft);
    frontEl.focus();

    const onConfirm = () => {
      const f = document.getElementById('card-front-input').value.trim();
      const b = document.getElementById('card-back-input').value.trim();
      if (!f || !b) return;
      if (existingCard) {
        Store.updateCard(existingCard.id, f, b);
      } else {
        Store.addCard(appState.selectedDeckId, f, b);
      }
      closeModal();
      refresh();
    };
    bindModal(onConfirm);
  }

  // ---------- Confirm modal (replaces native OS confirm dialogs) ----------
  function openConfirmModal({ title, message, confirmLabel, onConfirm }) {
    el.modalTitle.textContent = title;
    el.modalBody.innerHTML = `<p class="confirm-message">${escapeHtml(message)}</p>`;
    el.modalConfirm.textContent = confirmLabel;
    el.modalConfirm.className = 'primary-btn';
    el.modalConfirm.style.background = 'var(--danger)';
    el.modalBackdrop.hidden = false;
    bindModal(() => {
      onConfirm();
      closeModal();
    });
  }

  // ---------- Magic Add modal: paste many lines, split each into a front/back pair ----------
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
    const existingDeck = appState.decks.find((d) => d.id === appState.selectedDeckId);
    el.modalTitle.textContent = 'Magic Add';
    el.modalBody.innerHTML = `
      ${existingDeck
        ? `<label>Adding to</label><p class="hint">${escapeHtml(existingDeck.name)}</p>`
        : `<label for="magic-deck-name">New deck name</label><input id="magic-deck-name" type="text" value="Quick Add" />`}
      <label for="magic-textarea">One card per line</label>
      <p class="hint">Separate front and back with a Tab, "::", or " - ". Paste straight from a spreadsheet or type your own list.</p>
      <textarea id="magic-textarea" class="magic-textarea" placeholder="perro :: dog&#10;gato :: cat"></textarea>
    `;
    el.modalConfirm.textContent = 'Save';
    el.modalConfirm.className = 'primary-btn';
    el.modalBackdrop.hidden = false;
    const magicTextarea = document.getElementById('magic-textarea');
    const magicDraft = loadDraftValue('magic', null);
    if (magicDraft) magicTextarea.value = magicDraft;
    magicTextarea.addEventListener('input', () => saveDraft('magic', null, magicTextarea.value));
    magicTextarea.focus();

    const onConfirm = () => {
      const text = document.getElementById('magic-textarea').value;
      const pairs = parseMagicLines(text);
      if (pairs.length === 0) return;

      let deckId = appState.selectedDeckId;
      if (!deckId) {
        const nameInput = document.getElementById('magic-deck-name');
        const deck = Store.addDeckPath((nameInput && nameInput.value.trim()) || 'Quick Add');
        deckId = deck.id;
      }
      Store.addCardsBulk(deckId, pairs);
      appState.selectedDeckId = deckId;
      Store.setLastSelectedDeck(deckId);
      closeModal();
      refresh();
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
    el.modalConfirm.style.background = '';
    currentConfirmHandler = null;
    clearAllDrafts();
  }

  el.modalConfirm.addEventListener('click', () => currentConfirmHandler && currentConfirmHandler());
  el.modalCancel.addEventListener('click', closeModal);
  el.modalBackdrop.addEventListener('click', (e) => {
    if (e.target === el.modalBackdrop) closeModal();
  });

  // ---------- Study mode ----------
  function startStudy() {
    if (!appState.selectedDeckId) return;
    const cards = Store.dueCardsForDeckTree(appState.selectedDeckId);
    if (cards.length === 0) {
      showPane(el.studyDone);
      return;
    }
    appState.studyQueue = cards;
    appState.studyIndex = 0;
    appState.showingAnswer = false;
    showPane(el.studyView);
    renderStudyCard();
  }

  function renderStudyCard() {
    stopSpeaking();
    const card = appState.studyQueue[appState.studyIndex];
    if (!card) {
      showPane(el.studyDone);
      return;
    }
    appState.showingAnswer = false;
    el.studyProgress.textContent = `${appState.studyIndex + 1} / ${appState.studyQueue.length}`;
    el.flashcardFace.innerHTML = `<div>${escapeHtml(card.front)}</div>`;
    el.showAnswerBtn.hidden = false;
    el.ratingButtons.hidden = true;
  }

  function revealAnswer() {
    const card = appState.studyQueue[appState.studyIndex];
    if (!card || appState.showingAnswer) return;
    appState.showingAnswer = true;
    el.flashcardFace.innerHTML = `
      <div>${escapeHtml(card.front)}</div>
      <div class="flashcard-back">${escapeHtml(card.back)}</div>
    `;
    el.showAnswerBtn.hidden = true;
    el.ratingButtons.hidden = false;
  }

  function listenToCurrentCard() {
    const card = appState.studyQueue[appState.studyIndex];
    if (!card) return;
    speak(appState.showingAnswer ? `${card.front}. ${card.back}` : card.front);
  }

  function rateCurrentCard(rating) {
    const card = appState.studyQueue[appState.studyIndex];
    if (!card) return;
    stopSpeaking();
    Store.rateCard(card.id, rating);
    appState.studyIndex += 1;
    if (appState.studyIndex >= appState.studyQueue.length) {
      refresh();
      showPane(el.studyDone);
    } else {
      renderStudyCard();
    }
  }

  // ---------- Export / Import (browser-native, no OS dialogs) ----------
  // A plain file-download link does nothing inside the artifact viewer, so
  // export copies the deck's JSON to the clipboard instead — it pairs with
  // the paste-anywhere importer below for a working round trip either way.
  function openExportFallbackModal(json) {
    el.modalTitle.textContent = 'Copy this deck';
    el.modalBody.innerHTML = `
      <p class="hint">Couldn't copy automatically — select all the text below and copy it yourself, then paste it anywhere in MacAnki to import it.</p>
      <textarea id="export-json-textarea" class="magic-textarea" readonly></textarea>
    `;
    document.getElementById('export-json-textarea').value = json;
    el.modalConfirm.textContent = 'Done';
    el.modalConfirm.className = 'primary-btn';
    el.modalBackdrop.hidden = false;
    const ta = document.getElementById('export-json-textarea');
    ta.focus();
    ta.select();
    bindModal(closeModal);
  }

  async function doExportDeck() {
    if (!appState.selectedDeckId) return;
    const data = Store.exportDeck(appState.selectedDeckId);
    if (!data) return;
    const json = JSON.stringify(data, null, 2);
    try {
      await navigator.clipboard.writeText(json);
      showToast('Deck copied — paste it anywhere in MacAnki to import it.');
    } catch (err) {
      openExportFallbackModal(json);
    }
  }

  function doImportDeck() {
    el.jsonFileInput.click();
  }

  function importDeckFromParsed(parsed) {
    if (!parsed || !Array.isArray(parsed.cards)) return false;
    const deck = Store.importDeck(parsed.name || 'Imported Deck', parsed.cards);
    refresh();
    selectDeck(deck.id);
    return true;
  }

  el.jsonFileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!importDeckFromParsed(parsed)) showToast("That file doesn't look like a MacAnki deck export.");
    } catch (err) {
      showToast("Couldn't read that file.");
    }
  });

  // ---------- .apkg (real Anki package) import ----------
  // Lazily initializes sql.js once, from the wasm binary inlined into this
  // page (no network fetch — works offline and inside any sandbox).
  let sqlJsPromise = null;
  function loadSQL() {
    if (!sqlJsPromise) {
      const wasmBytes = base64ToBytes(window.__SQL_WASM_B64__);
      sqlJsPromise = window.initSqlJs({ wasmBinary: wasmBytes });
    }
    return sqlJsPromise;
  }

  function base64ToBytes(b64) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  function doImportApkg() {
    el.apkgFileInput.click();
  }

  el.apkgFileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    showToast(`Reading ${file.name}…`);
    try {
      const SQL = await loadSQL();
      const result = await window.MacAnkiApkg.parseApkgBlob(file, file.name, SQL);
      const deck = Store.importDeck(result.name, result.cards);
      refresh();
      selectDeck(deck.id);
      showToast(`Imported ${result.cards.length} card${result.cards.length === 1 ? '' : 's'} from ${file.name}.`);
    } catch (err) {
      showToast(err && err.message ? err.message : "Couldn't import that .apkg file.");
    }
  });

  // ---------- Actions ----------
  function doAddDeck() {
    openDeckModal(null);
  }

  function doAddCard() {
    if (!appState.selectedDeckId) return;
    openCardModal(null);
  }

  // ---------- Event wiring ----------
  el.homeBtn.addEventListener('click', goHome);
  document.getElementById('new-deck-btn').addEventListener('click', doAddDeck);
  document.getElementById('add-apkg-btn').addEventListener('click', doImportApkg);
  document.getElementById('magic-add-btn').addEventListener('click', openMagicAddModal);
  document.getElementById('rename-deck-btn').addEventListener('click', () => {
    const deck = appState.decks.find((d) => d.id === appState.selectedDeckId);
    if (deck) openDeckModal(deck);
  });
  document.getElementById('delete-deck-btn').addEventListener('click', () => {
    if (!appState.selectedDeckId) return;
    const deck = appState.decks.find((d) => d.id === appState.selectedDeckId);
    if (!deck) return;
    openConfirmModal({
      title: `Delete "${deck.name}"?`,
      message: `This permanently deletes this deck and all ${deck.cardCount} card${deck.cardCount === 1 ? '' : 's'} in it. This cannot be undone.`,
      confirmLabel: 'Delete Deck',
      onConfirm: () => {
        Store.deleteDeck(deck.id);
        appState.selectedDeckId = null;
        refresh();
      },
    });
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
        if (!appState.showingAnswer) revealAnswer();
      } else if (appState.showingAnswer && (e.key === '1' || e.key === 'ArrowLeft')) {
        rateCurrentCard('again');
      } else if (appState.showingAnswer && (e.key === '2' || e.key === 'ArrowRight')) {
        rateCurrentCard('good');
      }
    }
  });

  // Paste a previously-exported deck's JSON anywhere outside a text field to import it.
  document.addEventListener('paste', (e) => {
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
    importDeckFromParsed(parsed);
  });

  // ---------- Boot ----------
  const lastId = state.settings.lastSelectedDeckId;
  if (lastId && state.decks.find((d) => d.id === lastId)) {
    appState.selectedDeckId = lastId;
  }
  refresh();
})();
