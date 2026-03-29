// ── Game state and logic ────────────────────────────────────

import { Card, Suit, Rank, createDeck, shuffleDeck } from './card.js';

export const MAX_COLUMNS = 12;

export type GamePhase =
  | 'menu'
  | 'tutorial'
  | 'player_draw'
  | 'player_turn'
  | 'bogey_turn'
  | 'bogey_place'
  | 'bogey_loss'
  | 'game_over'
  | 'game_won';

export interface UndoSnapshot {
  hand: Card[];
  columns: Card[][];
  discardPile: Card[];
}

export interface GameState {
  phase: GamePhase;
  deck: Card[];
  hand: Card[];
  discardPile: Card[];
  columns: Card[][];
  bogeyCard: Card | null;
  turnNumber: number;
  handSize: number;
  cardsPlayed: number;
  cardsDiscarded: number;
  undoStack: UndoSnapshot[];
  hasDrawnThisTurn: boolean;
  message: string;
  messageTimer: number;
}

export function createGameState(): GameState {
  const handSize = 5;
  const deck = shuffleDeck(createDeck());
  return {
    phase: 'player_draw',
    deck,
    hand: [],
    discardPile: [],
    columns: [],
    bogeyCard: null,
    turnNumber: 1,
    handSize,
    cardsPlayed: 0,
    cardsDiscarded: 0,
    undoStack: [],
    hasDrawnThisTurn: false,
    message: '',
    messageTimer: 0,
  };
}

export function createTutorialState(): GameState {
  const fullDeck = createDeck();

  // Create the specific tutorial hand
  const tutorialHand: Card[] = [
    { suit: Suit.Spades, rank: Rank.Jack, id: 49 },
    { suit: Suit.Diamonds, rank: Rank.Two, id: 14 },
    { suit: Suit.Diamonds, rank: Rank.Five, id: 17 },
    { suit: Suit.Clubs, rank: Rank.Eight, id: 33 },
    { suit: Suit.Spades, rank: Rank.Queen, id: 50 },
  ];

  // Remove tutorial cards from deck and shuffle the rest
  const tutorialCardIds = new Set(tutorialHand.map(c => c.id));
  const remainingDeck = fullDeck.filter(c => !tutorialCardIds.has(c.id));
  const deck = shuffleDeck(remainingDeck);

  return {
    phase: 'player_turn',
    deck,
    hand: tutorialHand,
    discardPile: [],
    columns: [],
    bogeyCard: null,
    turnNumber: 1,
    handSize: 5,
    cardsPlayed: 0,
    cardsDiscarded: 0,
    undoStack: [],
    hasDrawnThisTurn: true, // Mark as drawn so they don't autofill
    message: '',
    messageTimer: 0,
  };
}

// ── Card legality checks ────────────────────────────────────

export function canPlayToColumn(card: Card, column: Card[]): boolean {
  if (column.length === 0) return true;
  const top = column[column.length - 1];
  return card.suit === top.suit && card.rank < top.rank;
}

export function getValidColumns(card: Card, columns: Card[][]): number[] {
  const valid: number[] = [];
  for (let i = 0; i < columns.length; i++) {
    if (canPlayToColumn(card, columns[i])) {
      valid.push(i);
    }
  }
  // Can start new column if under limit
  if (columns.length < MAX_COLUMNS) {
    valid.push(columns.length); // index for "new column"
  }
  return valid;
}

export function canBogeyPlay(card: Card, columns: Card[][]): boolean {
  // Check existing columns
  for (const col of columns) {
    if (canPlayToColumn(card, col)) return true;
  }
  // Check if can start a new column
  return columns.length < MAX_COLUMNS;
}

// ── State transitions ───────────────────────────────────────

export function drawCards(state: GameState): Card[] {
  const drawn: Card[] = [];
  while (state.hand.length < state.handSize) {
    if (state.deck.length === 0) {
      if (state.discardPile.length === 0) break;
      // Recycle discards
      state.deck = shuffleDeck(state.discardPile);
      state.discardPile = [];
    }
    const card = state.deck.pop()!;
    state.hand.push(card);
    drawn.push(card);
  }
  state.hasDrawnThisTurn = true;
  state.phase = 'player_turn';
  return drawn;
}

export function saveUndo(state: GameState): void {
  if (state.hasDrawnThisTurn) return; // can't undo after drawing
  state.undoStack.push({
    hand: [...state.hand],
    columns: state.columns.map(c => [...c]),
    discardPile: [...state.discardPile],
  });
}

export function performUndo(state: GameState): boolean {
  if (state.hasDrawnThisTurn || state.undoStack.length === 0) return false;
  const snap = state.undoStack.pop()!;
  state.hand = snap.hand;
  state.columns = snap.columns;
  state.discardPile = snap.discardPile;
  return true;
}

export function playCardToColumn(state: GameState, handIndex: number, colIndex: number): boolean {
  const card = state.hand[handIndex];
  if (!card) return false;

  if (colIndex === state.columns.length) {
    if (state.columns.length >= MAX_COLUMNS) return false;
    state.columns.push([card]);
  } else {
    if (!canPlayToColumn(card, state.columns[colIndex])) return false;
    state.columns[colIndex].push(card);
  }

  state.hand.splice(handIndex, 1);
  state.cardsPlayed++;
  return true;
}

export function discardCard(state: GameState, handIndex: number): boolean {
  const card = state.hand[handIndex];
  if (!card) return false;
  state.discardPile.push(card);
  state.hand.splice(handIndex, 1);
  state.cardsDiscarded++;
  return true;
}

export function endPlayerTurn(state: GameState): void {
  state.phase = 'bogey_turn';
  state.undoStack = [];
  state.hasDrawnThisTurn = false;
}

export function drawBogeyCard(state: GameState): Card | null {
  if (state.deck.length === 0) {
    if (state.discardPile.length === 0) {
      // All cards accounted for — check win
      checkWin(state);
      return null;
    }
    state.deck = shuffleDeck(state.discardPile);
    state.discardPile = [];
  }
  const card = state.deck.pop()!;
  state.bogeyCard = card;
  state.phase = 'bogey_place';

  // Check if bogey card can be placed at all
  if (!canBogeyPlay(card, state.columns)) {
    state.phase = 'bogey_loss';
    state.message = "The bogey's card can't be placed! Click to continue.";
  }

  return card;
}

export function placeBogeyCard(state: GameState, colIndex: number): boolean {
  if (!state.bogeyCard) return false;

  if (colIndex === state.columns.length) {
    if (state.columns.length >= MAX_COLUMNS) return false;
    state.columns.push([state.bogeyCard]);
  } else {
    if (!canPlayToColumn(state.bogeyCard, state.columns[colIndex])) return false;
    state.columns[colIndex].push(state.bogeyCard);
  }

  state.cardsPlayed++;
  state.bogeyCard = null;

  // Check if all cards played
  checkWin(state);
  if (state.phase !== 'game_won') {
    state.phase = 'player_draw';
    state.turnNumber++;
  }
  return true;
}

function checkWin(state: GameState): void {
  const totalOnTable = state.columns.reduce((sum, col) => sum + col.length, 0);
  if (totalOnTable === 52) {
    state.phase = 'game_won';
  }
}

export function resign(state: GameState): void {
  state.phase = 'game_over';
  state.message = 'You resigned.';
}

export function getWinRating(numColumns: number): string {
  if (numColumns <= 8) return '🏆 Epic';
  if (numColumns <= 9) return '⚔️ Legendary';
  if (numColumns <= 10) return '🎯 Advanced';
  if (numColumns <= 11) return '✅ Normal';
  return '📖 Novice';
}

export function getTotalCardsOnTable(state: GameState): number {
  return state.columns.reduce((sum, col) => sum + col.length, 0);
}

export function getRemainingCards(state: GameState): number {
  return 52 - getTotalCardsOnTable(state);
}
