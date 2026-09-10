import type { Card, Rank } from './types';

export type HandCategory =
  | 'High Card'
  | 'Pair'
  | 'Two Pair'
  | 'Three of a Kind'
  | 'Straight'
  | 'Flush'
  | 'Full House'
  | 'Four of a Kind'
  | 'Straight Flush';

const CATEGORY_NAMES: HandCategory[] = [
  'High Card',
  'Pair',
  'Two Pair',
  'Three of a Kind',
  'Straight',
  'Flush',
  'Full House',
  'Four of a Kind',
  'Straight Flush',
];

export interface RankedHand {
  category: number; // 0-8, higher is better
  categoryName: HandCategory;
  tiebreakers: number[]; // descending significance, for comparing within same category
  cards: Card[]; // the best 5 cards, in no particular order
}

function combinations<T>(items: T[], k: number): T[][] {
  const results: T[][] = [];
  const combo: T[] = [];
  function backtrack(start: number) {
    if (combo.length === k) {
      results.push(combo.slice());
      return;
    }
    for (let i = start; i < items.length; i++) {
      combo.push(items[i]);
      backtrack(i + 1);
      combo.pop();
    }
  }
  backtrack(0);
  return results;
}

// Evaluates exactly 5 cards.
export function evaluateFive(cards: Card[]): RankedHand {
  if (cards.length !== 5) throw new Error('evaluateFive requires exactly 5 cards');

  const ranksDesc = cards.map((c) => c.rank).sort((a, b) => b - a);
  const isFlush = cards.every((c) => c.suit === cards[0].suit);

  const straightHigh = straightHighCard(ranksDesc);
  const isStraight = straightHigh !== null;

  const countByRank = new Map<Rank, number>();
  for (const r of ranksDesc) countByRank.set(r, (countByRank.get(r) ?? 0) + 1);

  const groups = Array.from(countByRank.entries()).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1]; // by count desc
    return b[0] - a[0]; // then by rank desc
  });
  const counts = groups.map((g) => g[1]);

  let category: number;
  let tiebreakers: number[];

  if (isStraight && isFlush) {
    category = 8;
    tiebreakers = [straightHigh!];
  } else if (counts[0] === 4) {
    category = 7;
    tiebreakers = [groups[0][0], groups[1][0]];
  } else if (counts[0] === 3 && counts[1] === 2) {
    category = 6;
    tiebreakers = [groups[0][0], groups[1][0]];
  } else if (isFlush) {
    category = 5;
    tiebreakers = ranksDesc;
  } else if (isStraight) {
    category = 4;
    tiebreakers = [straightHigh!];
  } else if (counts[0] === 3) {
    category = 3;
    tiebreakers = [groups[0][0], ...groups.slice(1).map((g) => g[0])];
  } else if (counts[0] === 2 && counts[1] === 2) {
    const pairRanks = [groups[0][0], groups[1][0]].sort((a, b) => b - a);
    tiebreakers = [...pairRanks, groups[2][0]];
    category = 2;
  } else if (counts[0] === 2) {
    category = 1;
    tiebreakers = [groups[0][0], ...groups.slice(1).map((g) => g[0])];
  } else {
    category = 0;
    tiebreakers = ranksDesc;
  }

  return { category, categoryName: CATEGORY_NAMES[category], tiebreakers, cards };
}

// Returns the high card of the best straight in the given descending, deduped-by-rank
// rank list, or null if none. Handles the wheel (A-2-3-4-5).
function straightHighCard(ranksDescWithDupes: number[]): number | null {
  const uniqueDesc = Array.from(new Set(ranksDescWithDupes)).sort((a, b) => b - a);
  // Ace-low straight: treat A as 1 too
  const withAceLow = uniqueDesc.includes(14) ? [...uniqueDesc, 1] : uniqueDesc;

  for (let i = 0; i <= withAceLow.length - 5; i++) {
    let consecutive = true;
    for (let j = 0; j < 4; j++) {
      if (withAceLow[i + j] - withAceLow[i + j + 1] !== 1) {
        consecutive = false;
        break;
      }
    }
    if (consecutive) return withAceLow[i];
  }
  return null;
}

// Evaluates the best 5-card hand out of 5, 6, or 7 cards.
export function evaluateBest(cards: Card[]): RankedHand {
  if (cards.length < 5) throw new Error('need at least 5 cards');
  if (cards.length === 5) return evaluateFive(cards);

  let best: RankedHand | null = null;
  for (const combo of combinations(cards, 5)) {
    const ranked = evaluateFive(combo);
    if (!best || compareRankedHands(ranked, best) > 0) {
      best = ranked;
    }
  }
  return best!;
}

// Returns >0 if a beats b, <0 if b beats a, 0 if tie.
export function compareRankedHands(a: RankedHand, b: RankedHand): number {
  if (a.category !== b.category) return a.category - b.category;
  const len = Math.max(a.tiebreakers.length, b.tiebreakers.length);
  for (let i = 0; i < len; i++) {
    const av = a.tiebreakers[i] ?? 0;
    const bv = b.tiebreakers[i] ?? 0;
    if (av !== bv) return av - bv;
  }
  return 0;
}
