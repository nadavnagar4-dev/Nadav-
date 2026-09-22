const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;

function makeId() {
  return crypto.randomBytes(9).toString('base64url');
}

function emptyState() {
  return { decks: [], cards: [], log: [], settings: { lastSelectedDeckId: null } };
}

function isToday(ts) {
  const a = new Date(ts);
  const b = new Date();
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

class Store {
  constructor(filePath) {
    this.filePath = filePath;
    this.state = this._load();
  }

  _load() {
    try {
      const raw = fs.readFileSync(this.filePath, 'utf8');
      const parsed = JSON.parse(raw);
      if (!parsed.decks || !parsed.cards) return emptyState();
      if (!parsed.log) parsed.log = [];
      if (!parsed.settings) parsed.settings = { lastSelectedDeckId: null };
      return parsed;
    } catch (err) {
      return emptyState();
    }
  }

  _save() {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(this.state, null, 2), 'utf8');
  }

  getAll() {
    const now = Date.now();
    const decks = this.state.decks.map((d) => {
      const deckCards = this.state.cards.filter((c) => c.deckId === d.id);
      const newCount = deckCards.filter((c) => c.state === 'new').length;
      const dueReviewCount = deckCards.filter((c) => c.state !== 'new' && c.due <= now).length;
      const todayCount = this.state.log.filter((e) => e.deckId === d.id && isToday(e.ts)).length;
      return {
        ...d,
        cardCount: deckCards.length,
        newCount,
        dueReviewCount,
        dueCount: newCount + dueReviewCount,
        todayCount,
      };
    });
    return { decks, cards: this.state.cards, settings: this.state.settings };
  }

  setLastSelectedDeck(id) {
    this.state.settings.lastSelectedDeckId = id;
    this._save();
  }

  addDeck(name) {
    const deck = { id: makeId(), name: name.trim() || 'Untitled Deck', createdAt: Date.now() };
    this.state.decks.push(deck);
    this._save();
    return deck;
  }

  renameDeck(id, name) {
    const deck = this.state.decks.find((d) => d.id === id);
    if (!deck) return null;
    deck.name = name.trim() || deck.name;
    this._save();
    return deck;
  }

  deleteDeck(id) {
    this.state.decks = this.state.decks.filter((d) => d.id !== id);
    this.state.cards = this.state.cards.filter((c) => c.deckId !== id);
    this.state.log = this.state.log.filter((e) => e.deckId !== id);
    if (this.state.settings.lastSelectedDeckId === id) this.state.settings.lastSelectedDeckId = null;
    this._save();
  }

  addCard(deckId, front, back) {
    const card = {
      id: makeId(),
      deckId,
      front: front.trim(),
      back: back.trim(),
      createdAt: Date.now(),
      due: Date.now(),
      interval: 0,
      ease: 2.5,
      reps: 0,
      lapses: 0,
      state: 'new',
    };
    this.state.cards.push(card);
    this._save();
    return card;
  }

  updateCard(id, front, back) {
    const card = this.state.cards.find((c) => c.id === id);
    if (!card) return null;
    card.front = front.trim();
    card.back = back.trim();
    this._save();
    return card;
  }

  deleteCard(id) {
    this.state.cards = this.state.cards.filter((c) => c.id !== id);
    this._save();
  }

  cardsForDeck(deckId) {
    return this.state.cards.filter((c) => c.deckId === deckId);
  }

  dueCardsForDeck(deckId) {
    const now = Date.now();
    return this.state.cards
      .filter((c) => c.deckId === deckId && c.due <= now)
      .sort((a, b) => (a.state === 'new' ? 1 : 0) - (b.state === 'new' ? 1 : 0) || a.due - b.due);
  }

  // Simplified SM-2 style scheduler, modeled after Anki's rating scale.
  rateCard(id, rating) {
    const card = this.state.cards.find((c) => c.id === id);
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
    this.state.log.push({ cardId: card.id, deckId: card.deckId, rating, ts: Date.now() });
    this._save();
    return card;
  }

  importDeck(name, cards) {
    const deck = this.addDeck(name);
    for (const c of cards) {
      if (c && c.front && c.back) this.addCard(deck.id, c.front, c.back);
    }
    return deck;
  }

  exportDeck(deckId) {
    const deck = this.state.decks.find((d) => d.id === deckId);
    if (!deck) return null;
    const cards = this.cardsForDeck(deckId).map((c) => ({ front: c.front, back: c.back }));
    return { name: deck.name, cards };
  }
}

module.exports = { Store };
