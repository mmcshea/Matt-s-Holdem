import { beforeEach, describe, expect, it } from 'vitest';
import { applyAction, createInitialTable, dealNewHand, legalActions, type GameSession } from './engine';
import type { PlayerAction } from './types';

function act(session: GameSession, playerId: string, type: PlayerAction['type'], amount?: number): GameSession {
  return applyAction(session, {
    id: `${playerId}-${type}-${Date.now()}-${Math.random()}`,
    playerId,
    type,
    amount,
    handNumber: session.table.handNumber,
    createdAt: Date.now(),
  });
}

describe('dealNewHand', () => {
  it('posts blinds and sets pot correctly for 3 players', () => {
    const initial = createInitialTable(
      'ROOM1',
      'a',
      [
        { id: 'a', name: 'Alice', seat: 0, stack: 1000 },
        { id: 'b', name: 'Bob', seat: 1, stack: 1000 },
        { id: 'c', name: 'Carol', seat: 2, stack: 1000 },
      ],
      10,
      20,
    );
    const session = dealNewHand(initial, { a: 1000, b: 1000, c: 1000 });
    expect(session.table.pot).toBe(30); // SB 10 + BB 20
    expect(session.table.currentBet).toBe(20);
    for (const p of session.table.players) {
      expect(session.holeCards[p.id]).toHaveLength(2);
    }
    // 3-handed: dealer posts nothing, next is SB, next is BB, UTG (dealer) acts first
    expect(session.table.actingPlayerId).toBe('a');
  });

  it('heads-up: dealer posts small blind and acts first preflop', () => {
    const initial = createInitialTable(
      'ROOM2',
      'a',
      [
        { id: 'a', name: 'Alice', seat: 0, stack: 1000 },
        { id: 'b', name: 'Bob', seat: 1, stack: 1000 },
      ],
      10,
      20,
    );
    const session = dealNewHand(initial, { a: 1000, b: 1000 });
    expect(session.table.actingPlayerId).toBe('a');
    expect(session.table.pot).toBe(30);
  });
});

describe('applyAction pot tracking across streets', () => {
  let session: GameSession;

  beforeEach(() => {
    const initial = createInitialTable(
      'ROOM3',
      'a',
      [
        { id: 'a', name: 'Alice', seat: 0, stack: 1000 },
        { id: 'b', name: 'Bob', seat: 1, stack: 1000 },
        { id: 'c', name: 'Carol', seat: 2, stack: 1000 },
      ],
      10,
      20,
    );
    session = dealNewHand(initial, { a: 1000, b: 1000, c: 1000 });
  });

  it('keeps pot cumulative into the flop instead of resetting', () => {
    // preflop: a calls 20, b (SB) calls 10 more, c (BB) checks
    session = act(session, 'a', 'call');
    expect(session.table.pot).toBe(50); // 30 + 20
    session = act(session, 'b', 'call');
    expect(session.table.pot).toBe(60); // + 10 to match 20
    session = act(session, 'c', 'check');
    expect(session.table.street).toBe('flop');
    expect(session.table.pot).toBe(60); // must NOT drop back to 0

    // flop: everyone checks
    session = act(session, 'b', 'check');
    session = act(session, 'c', 'check');
    session = act(session, 'a', 'check');
    expect(session.table.street).toBe('turn');
    expect(session.table.pot).toBe(60); // still must be 60, not reset
  });

  it('handles a bet and calls on the flop, accumulating pot correctly', () => {
    session = act(session, 'a', 'call');
    session = act(session, 'b', 'call');
    session = act(session, 'c', 'check');
    expect(session.table.pot).toBe(60);

    session = act(session, 'b', 'bet', 20);
    expect(session.table.pot).toBe(80);
    session = act(session, 'c', 'call');
    expect(session.table.pot).toBe(100);
    session = act(session, 'a', 'call');
    expect(session.table.pot).toBe(120);
    expect(session.table.street).toBe('turn');
  });
});

describe('fold-out win', () => {
  it('awards full pot to last remaining player without showdown', () => {
    const initial = createInitialTable(
      'ROOM4',
      'a',
      [
        { id: 'a', name: 'Alice', seat: 0, stack: 1000 },
        { id: 'b', name: 'Bob', seat: 1, stack: 1000 },
        { id: 'c', name: 'Carol', seat: 2, stack: 1000 },
      ],
      10,
      20,
    );
    let session = dealNewHand(initial, { a: 1000, b: 1000, c: 1000 });
    session = act(session, 'a', 'fold');
    session = act(session, 'b', 'fold');
    expect(session.table.street).toBe('showdown');
    const carol = session.table.players.find((p) => p.id === 'c')!;
    // Carol posted the 20 BB herself, then won the full 30-chip pot: 1000 - 20 + 30 = 1010.
    expect(carol.stack).toBe(1010);
    expect(session.table.results).toHaveLength(1);
    expect(session.table.results![0].playerId).toBe('c');
  });
});

describe('all-in side pots', () => {
  it('continues betting when two or more players still have chips behind an all-in', () => {
    const initial = createInitialTable(
      'ROOM5',
      'a',
      [
        { id: 'a', name: 'Alice', seat: 0, stack: 100 }, // short stack
        { id: 'b', name: 'Bob', seat: 1, stack: 1000 },
        { id: 'c', name: 'Carol', seat: 2, stack: 1000 },
      ],
      10,
      20,
    );
    let session = dealNewHand(initial, { a: 100, b: 1000, c: 1000 });
    // a (UTG, first to act 3-handed) shoves all-in for 100
    session = act(session, 'a', 'raise', 100);
    session = act(session, 'b', 'call');
    session = act(session, 'c', 'call');
    // a is all-in, but b and c both still have chips behind, so they keep playing
    // the side pot against each other on the flop rather than running it out.
    expect(session.table.street).toBe('flop');
    // Hand is still in progress, so chips are split between stacks and the pot.
    const stacksTotal = session.table.players.reduce((sum, p) => sum + p.stack, 0);
    expect(stacksTotal + session.table.pot).toBe(100 + 1000 + 1000);
  });

  it('runs the board out automatically once only one player has chips left to bet', () => {
    const initial = createInitialTable(
      'ROOM5B',
      'a',
      [
        { id: 'a', name: 'Alice', seat: 0, stack: 100 },
        { id: 'b', name: 'Bob', seat: 1, stack: 100 },
        { id: 'c', name: 'Carol', seat: 2, stack: 1000 },
      ],
      10,
      20,
    );
    let session = dealNewHand(initial, { a: 100, b: 100, c: 1000 });
    // a shoves for 100, b calls all-in with exactly 100, c calls and still has chips left
    session = act(session, 'a', 'raise', 100);
    session = act(session, 'b', 'call');
    session = act(session, 'c', 'call');
    // Only c still has chips to bet; with a and b both all-in there's no more
    // betting possible, so the engine deals the rest of the board straight to showdown.
    expect(session.table.street).toBe('showdown');
    const total = session.table.players.reduce((sum, p) => sum + p.stack, 0);
    expect(total).toBe(100 + 100 + 1000); // chip conservation
    expect(session.table.results!.length).toBeGreaterThan(0);
  });
});

describe('legalActions', () => {
  it('reports check available when no bet owed, call when facing a bet', () => {
    const initial = createInitialTable(
      'ROOM6',
      'a',
      [
        { id: 'a', name: 'Alice', seat: 0, stack: 1000 },
        { id: 'b', name: 'Bob', seat: 1, stack: 1000 },
      ],
      10,
      20,
    );
    const session = dealNewHand(initial, { a: 1000, b: 1000 });
    // heads-up: a is SB/dealer and acts first, facing BB's 20 with only 10 in
    const la = legalActions(session.table, 'a');
    expect(la.canCall).toBe(true);
    expect(la.callAmount).toBe(10);
  });
});
