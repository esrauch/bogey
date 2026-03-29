// ── Card Types ──────────────────────────────────────────────

export enum Suit {
  Hearts = 'hearts',
  Diamonds = 'diamonds',
  Clubs = 'clubs',
  Spades = 'spades',
}

export enum Rank {
  Ace = 1,
  Two = 2,
  Three = 3,
  Four = 4,
  Five = 5,
  Six = 6,
  Seven = 7,
  Eight = 8,
  Nine = 9,
  Ten = 10,
  Jack = 11,
  Queen = 12,
  King = 13,
}

export interface Card {
  suit: Suit;
  rank: Rank;
  id: number; // unique identifier 0-51
}

// ── Helpers ─────────────────────────────────────────────────

export const SUITS: Suit[] = [Suit.Hearts, Suit.Diamonds, Suit.Clubs, Suit.Spades];
export const RANKS: Rank[] = [
  Rank.Ace, Rank.Two, Rank.Three, Rank.Four, Rank.Five, Rank.Six,
  Rank.Seven, Rank.Eight, Rank.Nine, Rank.Ten, Rank.Jack, Rank.Queen, Rank.King,
];

export function rankLabel(rank: Rank): string {
  switch (rank) {
    case Rank.Ace: return 'A';
    case Rank.Jack: return 'J';
    case Rank.Queen: return 'Q';
    case Rank.King: return 'K';
    default: return String(rank);
  }
}

export function suitSymbol(suit: Suit): string {
  switch (suit) {
    case Suit.Hearts: return '♥';
    case Suit.Diamonds: return '♦';
    case Suit.Clubs: return '♣';
    case Suit.Spades: return '♠';
  }
}

export function suitColor(suit: Suit): string {
  switch (suit) {
    case Suit.Hearts:
      return '#b85c53'; // deep terracotta/brick red
    case Suit.Diamonds:
      return '#4a7c59'; // deep sage/forest green
    case Suit.Clubs:
      return '#6b5887'; // deep muted plum/violet
    case Suit.Spades:
      return '#2b323f'; // dark slate navy
  }
}

export function createDeck(): Card[] {
  const cards: Card[] = [];
  let id = 0;
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      cards.push({ suit, rank, id: id++ });
    }
  }
  return cards;
}

export function shuffleDeck(deck: Card[]): Card[] {
  const a = [...deck];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function cardName(card: Card): string {
  return `${rankLabel(card.rank)}${suitSymbol(card.suit)}`;
}
