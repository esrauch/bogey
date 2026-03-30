// ── Game state and logic ────────────────────────────────────

import { Card, Suit, Rank, createDeck, shuffleDeck } from './card.js';

export const MAX_PILES = 13;

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
  piles: Card[][];
  discardPile: Card[];
}

export interface GameState {
  phase: GamePhase;
  deck: Card[];
  hand: Card[];
  discardPile: Card[];
  piles: Card[][];
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
    piles: [],
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
    piles: [],
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

export function canPlayToPile(card: Card, pile: Card[]): boolean {
  if (pile.length === 0) return true;
  const top = pile[pile.length - 1];
  if (card.suit !== top.suit) return false;

  // Standard descending order (higher rank to lower rank; Ace as low)
  if (card.rank < top.rank) return true;

  // Allow Ace as a 'highest' card starting a pile, but no wrap around of (2 > A > K)
  if (pile.length == 1 && top.rank === Rank.Ace) return true;

  return false;
}

export function getValidPiles(card: Card, piles: Card[][]): number[] {
  const valid: number[] = [];
  for (let i = 0; i < piles.length; i++) {
    if (canPlayToPile(card, piles[i])) {
      valid.push(i);
    }
  }
  // Can start new pile if under limit
  if (piles.length < MAX_PILES) {
    valid.push(piles.length); // index for "new pile"
  }
  return valid;
}

export function canBogeyPlay(card: Card, piles: Card[][]): boolean {
  // Check existing piles
  for (const pile of piles) {
    if (canPlayToPile(card, pile)) return true;
  }
  // Check if can start a new pile
  return piles.length < MAX_PILES;
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
  state.undoStack = []; // reset undo stack at start of each turn
  state.phase = 'player_turn';
  return drawn;
}

export function saveUndo(state: GameState): void {
  state.undoStack.push({
    hand: [...state.hand],
    piles: state.piles.map(c => [...c]),
    discardPile: [...state.discardPile],
  });
}

export function performUndo(state: GameState): boolean {
  if (state.undoStack.length === 0) return false;
  const snap = state.undoStack.pop()!;
  state.hand = snap.hand;
  state.piles = snap.piles;
  state.discardPile = snap.discardPile;
  return true;
}

export function playCardToPile(state: GameState, handIndex: number, pileIndex: number): boolean {
  const card = state.hand[handIndex];
  if (!card) return false;

  if (pileIndex === state.piles.length) {
    if (state.piles.length >= MAX_PILES) return false;
    state.piles.push([card]);
  } else {
    if (!canPlayToPile(card, state.piles[pileIndex])) return false;
    state.piles[pileIndex].push(card);
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
  if (!canBogeyPlay(card, state.piles)) {
    state.phase = 'bogey_loss';
    state.message = "The bogey's card can't be placed! Click to continue.";
  }

  return card;
}

export function placeBogeyCard(state: GameState, pileIndex: number): boolean {
  if (!state.bogeyCard) return false;

  if (pileIndex === state.piles.length) {
    if (state.piles.length >= MAX_PILES) return false;
    state.piles.push([state.bogeyCard]);
  } else {
    if (!canPlayToPile(state.bogeyCard, state.piles[pileIndex])) return false;
    state.piles[pileIndex].push(state.bogeyCard);
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
  const totalOnTable = state.piles.reduce((sum, col) => sum + col.length, 0);
  if (totalOnTable === 52) {
    state.phase = 'game_won';
  }
}

export function resign(state: GameState): void {
  state.phase = 'game_over';
  state.message = 'You resigned.';
}

export function getWinRating(numPiles: number): string {
  if (numPiles <= 8) return '🏆 Epic';
  if (numPiles <= 9) return '⚔️ Legendary';
  if (numPiles <= 10) return '🎯 Advanced';
  if (numPiles <= 11) return '✅ Normal';
  return '📖 Novice';
}

export function getTotalCardsOnTable(state: GameState): number {
  return state.piles.reduce((sum, col) => sum + col.length, 0);
}

export function getRemainingCards(state: GameState): number {
  return 52 - getTotalCardsOnTable(state);
}
