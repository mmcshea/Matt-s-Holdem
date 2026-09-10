import { describe, expect, it } from 'vitest';
import type { Card } from './types';
import { compareRankedHands, evaluateBest, evaluateFive } from './handEvaluator';

function cards(spec: string): Card[] {
  // spec like "As Kd 2h 3c 4s"
  return spec.split(' ').map((s) => {
    const suit = s.slice(-1) as Card['suit'];
    const rankStr = s.slice(0, -1);
    const rankMap: Record<string, number> = { A: 14, K: 13, Q: 12, J: 11, T: 10 };
    const rank = (rankMap[rankStr] ?? parseInt(rankStr, 10)) as Card['rank'];
    return { rank, suit };
  });
}

describe('evaluateFive', () => {
  it('detects straight flush', () => {
    const h = evaluateFive(cards('9s 8s 7s 6s 5s'));
    expect(h.categoryName).toBe('Straight Flush');
    expect(h.tiebreakers[0]).toBe(9);
  });

  it('detects wheel straight flush (A-2-3-4-5)', () => {
    const h = evaluateFive(cards('As 2s 3s 4s 5s'));
    expect(h.categoryName).toBe('Straight Flush');
    expect(h.tiebreakers[0]).toBe(5);
  });

  it('detects four of a kind', () => {
    const h = evaluateFive(cards('Kh Kd Ks Kc 2h'));
    expect(h.categoryName).toBe('Four of a Kind');
    expect(h.tiebreakers).toEqual([13, 2]);
  });

  it('detects full house', () => {
    const h = evaluateFive(cards('Kh Kd Ks 2c 2h'));
    expect(h.categoryName).toBe('Full House');
    expect(h.tiebreakers).toEqual([13, 2]);
  });

  it('detects flush', () => {
    const h = evaluateFive(cards('Kh 9h 7h 4h 2h'));
    expect(h.categoryName).toBe('Flush');
  });

  it('detects straight', () => {
    const h = evaluateFive(cards('9s 8h 7d 6c 5s'));
    expect(h.categoryName).toBe('Straight');
    expect(h.tiebreakers[0]).toBe(9);
  });

  it('detects two pair over one pair', () => {
    const twoPair = evaluateFive(cards('Kh Kd 2s 2c 4h'));
    const onePair = evaluateFive(cards('Kh Kd 5s 3c 4h'));
    expect(compareRankedHands(twoPair, onePair)).toBeGreaterThan(0);
  });

  it('high card kicker order', () => {
    const h = evaluateFive(cards('Ah Kd 9s 5c 2h'));
    expect(h.categoryName).toBe('High Card');
    expect(h.tiebreakers).toEqual([14, 13, 9, 5, 2]);
  });
});

describe('evaluateBest (7 cards)', () => {
  it('picks best 5 of 7', () => {
    const seven = cards('As Ks Qs Js Ts 2h 3d'); // royal flush hidden among 7
    const h = evaluateBest(seven);
    expect(h.categoryName).toBe('Straight Flush');
    expect(h.tiebreakers[0]).toBe(14);
  });

  it('board plays as straight for all when best hand is on board', () => {
    const seven = cards('2h 3d 4s 5c 6h 9s 9d'); // straight on the board
    const h = evaluateBest(seven);
    expect(h.categoryName).toBe('Straight');
    expect(h.tiebreakers[0]).toBe(6);
  });

  it('compares two 7-card hands correctly', () => {
    const flush = evaluateBest(cards('Ah Kh Qh 2s 3d 9h 4h'));
    const straight = evaluateBest(cards('9s 8h 7d 6c 5s 2h 3d'));
    expect(compareRankedHands(flush, straight)).toBeGreaterThan(0);
  });

  it('splits pot on identical hand strength', () => {
    const a = evaluateBest(cards('2h 3d 4s 5c 6h Kd Qd'));
    const b = evaluateBest(cards('2s 3s 4h 5h 6s Kc Qc'));
    expect(compareRankedHands(a, b)).toBe(0);
  });
});
