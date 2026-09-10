import type { Card, Rank, Suit } from './types';

const SUITS: Suit[] = ['s', 'h', 'd', 'c'];
const RANKS: Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

export function freshDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit });
    }
  }
  return deck;
}

// Fisher-Yates shuffle. Uses crypto.getRandomValues when available (browser),
// falling back to Math.random otherwise. Not intended for real-money play.
export function shuffle<T>(items: T[]): T[] {
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function randomInt(maxExclusive: number): number {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const buf = new Uint32Array(1);
    const limit = Math.floor(0xffffffff / maxExclusive) * maxExclusive;
    let val: number;
    do {
      crypto.getRandomValues(buf);
      val = buf[0];
    } while (val >= limit);
    return val % maxExclusive;
  }
  return Math.floor(Math.random() * maxExclusive);
}

const FACE_RANKS: Partial<Record<Rank, string>> = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };

export function cardToString(card: Card): string {
  const rankStr = card.rank <= 10 ? String(card.rank) : FACE_RANKS[card.rank];
  return `${rankStr}${card.suit}`;
}
