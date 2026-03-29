// ── Card Types ──────────────────────────────────────────────
export var Suit;
(function (Suit) {
    Suit["Hearts"] = "hearts";
    Suit["Diamonds"] = "diamonds";
    Suit["Clubs"] = "clubs";
    Suit["Spades"] = "spades";
})(Suit || (Suit = {}));
export var Rank;
(function (Rank) {
    Rank[Rank["Ace"] = 1] = "Ace";
    Rank[Rank["Two"] = 2] = "Two";
    Rank[Rank["Three"] = 3] = "Three";
    Rank[Rank["Four"] = 4] = "Four";
    Rank[Rank["Five"] = 5] = "Five";
    Rank[Rank["Six"] = 6] = "Six";
    Rank[Rank["Seven"] = 7] = "Seven";
    Rank[Rank["Eight"] = 8] = "Eight";
    Rank[Rank["Nine"] = 9] = "Nine";
    Rank[Rank["Ten"] = 10] = "Ten";
    Rank[Rank["Jack"] = 11] = "Jack";
    Rank[Rank["Queen"] = 12] = "Queen";
    Rank[Rank["King"] = 13] = "King";
})(Rank || (Rank = {}));
// ── Helpers ─────────────────────────────────────────────────
export const SUITS = [Suit.Hearts, Suit.Diamonds, Suit.Clubs, Suit.Spades];
export const RANKS = [
    Rank.Ace, Rank.Two, Rank.Three, Rank.Four, Rank.Five, Rank.Six,
    Rank.Seven, Rank.Eight, Rank.Nine, Rank.Ten, Rank.Jack, Rank.Queen, Rank.King,
];
export function rankLabel(rank) {
    switch (rank) {
        case Rank.Ace: return 'A';
        case Rank.Jack: return 'J';
        case Rank.Queen: return 'Q';
        case Rank.King: return 'K';
        default: return String(rank);
    }
}
export function suitSymbol(suit) {
    switch (suit) {
        case Suit.Hearts: return '♥';
        case Suit.Diamonds: return '♦';
        case Suit.Clubs: return '♣';
        case Suit.Spades: return '♠';
    }
}
export function suitColor(suit) {
    return suit === Suit.Hearts || suit === Suit.Diamonds ? '#dc3545' : '#1a1a2e';
}
export function createDeck() {
    const cards = [];
    let id = 0;
    for (const suit of SUITS) {
        for (const rank of RANKS) {
            cards.push({ suit, rank, id: id++ });
        }
    }
    return cards;
}
export function shuffleDeck(deck) {
    const a = [...deck];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}
export function cardName(card) {
    return `${rankLabel(card.rank)}${suitSymbol(card.suit)}`;
}
//# sourceMappingURL=card.js.map