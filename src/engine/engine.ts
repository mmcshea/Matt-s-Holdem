import { freshDeck, shuffle } from './deck';
import { compareRankedHands, evaluateBest } from './handEvaluator';
import type { Card, HandResult, PlayerAction, PlayerState, TableState } from './types';

export interface GameSession {
  table: TableState;
  deck: Card[]; // remaining undealt cards; host-only, never synced
  holeCards: Record<string, Card[]>; // playerId -> 2 cards; host-only, never synced
  toAct: string[]; // playerIds still needing to act this street; host-only
}

export interface NewPlayerInput {
  id: string;
  name: string;
  seat: number;
  stack: number;
}

export function createInitialTable(
  roomCode: string,
  hostId: string,
  players: NewPlayerInput[],
  smallBlind: number,
  bigBlind: number,
): TableState {
  return {
    roomCode,
    hostId,
    phase: 'lobby',
    street: 'preflop',
    deckSeed: '',
    communityCards: [],
    pot: 0,
    sidePots: [],
    currentBet: 0,
    minRaise: bigBlind,
    // -1 so the first call to dealNewHand's "seat after previous dealer" rotation
    // lands on the lowest seat number instead of skipping it.
    dealerSeat: -1,
    actingPlayerId: null,
    lastAggressorId: null,
    smallBlind,
    bigBlind,
    players: players.map((p) => ({
      id: p.id,
      name: p.name,
      seat: p.seat,
      stack: p.stack,
      bet: 0,
      totalHandBet: 0,
      status: 'active',
      isHost: p.id === hostId,
    })),
    handNumber: 0,
    results: null,
    updatedAt: Date.now(),
  };
}

function seatOrder(players: PlayerState[]): PlayerState[] {
  return players.slice().sort((a, b) => a.seat - b.seat);
}

function nextSeatId(players: PlayerState[], fromSeat: number, predicate: (p: PlayerState) => boolean): string | null {
  const ordered = seatOrder(players);
  const n = ordered.length;
  const startIdx = ordered.findIndex((p) => p.seat > fromSeat);
  const rotated = startIdx === -1 ? ordered : [...ordered.slice(startIdx), ...ordered.slice(0, startIdx)];
  for (let i = 0; i < n; i++) {
    if (predicate(rotated[i])) return rotated[i].id;
  }
  return null;
}

function canAct(p: PlayerState): boolean {
  return p.status === 'active';
}

// Returns player ids still needing to act this street, in proper seat-rotation
// order starting at (and including, unless excluded) startId. Folded/all-in
// players are never included since they have no decision to make.
function turnOrderFrom(players: PlayerState[], startId: string, exclude?: string): string[] {
  const ordered = seatOrder(players).filter((p) => canAct(p) && p.id !== exclude);
  const idx = ordered.findIndex((p) => p.id === startId);
  const rotated = idx === -1 ? ordered : [...ordered.slice(idx), ...ordered.slice(0, idx)];
  return rotated.map((p) => p.id);
}

// Starts a fresh hand: rotates dealer, shuffles deck, deals hole cards, posts blinds.
export function dealNewHand(previous: TableState, stacks: Record<string, number>): GameSession {
  const eligiblePlayers = previous.players
    .filter((p) => (stacks[p.id] ?? p.stack) > 0)
    .map((p) => ({ ...p, stack: stacks[p.id] ?? p.stack, bet: 0, totalHandBet: 0, status: 'active' as const }));

  const ordered = seatOrder(eligiblePlayers);
  const prevDealerIdx = ordered.findIndex((p) => p.seat > previous.dealerSeat);
  const dealerIdx = prevDealerIdx === -1 ? 0 : prevDealerIdx;
  const dealerSeat = ordered[dealerIdx]?.seat ?? ordered[0]?.seat ?? 0;

  const deck = shuffle(freshDeck());
  const holeCards: Record<string, Card[]> = {};
  for (const p of ordered) {
    holeCards[p.id] = [deck.pop()!, deck.pop()!];
  }

  const heads2 = ordered.length === 2;
  const sbSeatId = heads2
    ? ordered[dealerIdx].id
    : nextSeatId(ordered, dealerSeat, () => true)!;
  const bbSeatId = heads2
    ? nextSeatId(ordered, dealerSeat, () => true)!
    : nextSeatId(
        ordered,
        ordered.find((p) => p.id === sbSeatId)!.seat,
        () => true,
      )!;

  const players = ordered.map((p) => {
    if (p.id === sbSeatId) {
      const amount = Math.min(previous.smallBlind, p.stack);
      return { ...p, bet: amount, totalHandBet: amount, stack: p.stack - amount };
    }
    if (p.id === bbSeatId) {
      const amount = Math.min(previous.bigBlind, p.stack);
      return { ...p, bet: amount, totalHandBet: amount, stack: p.stack - amount };
    }
    return p;
  });

  const bbSeat = players.find((p) => p.id === bbSeatId)!.seat;
  const firstActor = heads2
    ? sbSeatId
    : nextSeatId(players, bbSeat, (p) => canAct(p))!;

  const pot = players.reduce((sum, p) => sum + p.bet, 0);

  const table: TableState = {
    ...previous,
    phase: 'hand',
    street: 'preflop',
    communityCards: [],
    pot,
    sidePots: [],
    currentBet: previous.bigBlind,
    minRaise: previous.bigBlind,
    dealerSeat,
    actingPlayerId: firstActor,
    lastAggressorId: bbSeatId,
    players,
    handNumber: previous.handNumber + 1,
    results: null,
    updatedAt: Date.now(),
  };

  const toAct = turnOrderFrom(players, firstActor);

  return { table, deck, holeCards, toAct };
}

export function applyAction(session: GameSession, action: PlayerAction): GameSession {
  const { table } = session;
  if (table.actingPlayerId !== action.playerId) {
    throw new Error('Not this player\'s turn');
  }
  const playerIdx = table.players.findIndex((p) => p.id === action.playerId);
  if (playerIdx === -1) throw new Error('Player not found');
  const player = table.players[playerIdx];
  const players = table.players.slice();
  let toAct = session.toAct.filter((id) => id !== action.playerId);
  let currentBet = table.currentBet;
  let minRaise = table.minRaise;
  let lastAggressorId = table.lastAggressorId;
  let potContribution = 0; // chips this action adds to the pot

  switch (action.type) {
    case 'fold': {
      players[playerIdx] = { ...player, status: 'folded' };
      break;
    }
    case 'check': {
      if (player.bet !== currentBet) throw new Error('Cannot check, facing a bet');
      break;
    }
    case 'call': {
      const owed = Math.min(currentBet - player.bet, player.stack);
      players[playerIdx] = {
        ...player,
        bet: player.bet + owed,
        totalHandBet: player.totalHandBet + owed,
        stack: player.stack - owed,
        status: player.stack - owed === 0 ? 'all-in' : player.status,
      };
      potContribution = owed;
      break;
    }
    case 'bet':
    case 'raise': {
      const target = action.amount ?? currentBet;
      if (target <= currentBet) throw new Error('Bet/raise must exceed current bet');
      const delta = Math.min(target - player.bet, player.stack);
      const newBet = player.bet + delta;
      players[playerIdx] = {
        ...player,
        bet: newBet,
        totalHandBet: player.totalHandBet + delta,
        stack: player.stack - delta,
        status: player.stack - delta === 0 ? 'all-in' : player.status,
      };
      potContribution = delta;
      if (newBet > currentBet) {
        minRaise = Math.max(minRaise, newBet - currentBet);
        currentBet = newBet;
        lastAggressorId = action.playerId;
        const nextId = nextSeatId(players, player.seat, (p) => canAct(p) && p.id !== action.playerId);
        toAct = nextId ? turnOrderFrom(players, nextId, action.playerId) : [];
      }
      break;
    }
    default:
      throw new Error(`Unsupported action type: ${action.type}`);
  }

  const pot = table.pot + potContribution;

  const stillIn = players.filter((p) => p.status !== 'folded');
  if (stillIn.length === 1) {
    return finishHandByFold(session, players, stillIn[0].id, pot);
  }

  const nextTable: TableState = {
    ...table,
    players,
    pot,
    currentBet,
    minRaise,
    lastAggressorId,
    updatedAt: Date.now(),
  };

  if (toAct.length === 0) {
    return advanceStreet({ table: nextTable, deck: session.deck, holeCards: session.holeCards, toAct });
  }

  const nextActorId = toAct[0];
  return {
    table: { ...nextTable, actingPlayerId: nextActorId },
    deck: session.deck,
    holeCards: session.holeCards,
    toAct,
  };
}

function finishHandByFold(session: GameSession, players: PlayerState[], winnerId: string, pot: number): GameSession {
  const { table } = session;
  const finalPlayers = players.map((p) =>
    p.id === winnerId ? { ...p, stack: p.stack + pot, bet: 0 } : { ...p, bet: 0 },
  );
  const results: HandResult[] = [
    { playerId: winnerId, handRankName: 'Won uncontested (others folded)', bestFive: [], amountWon: pot },
  ];
  return {
    table: {
      ...table,
      players: finalPlayers,
      pot: 0,
      street: 'showdown',
      actingPlayerId: null,
      results,
      updatedAt: Date.now(),
    },
    deck: session.deck,
    holeCards: session.holeCards,
    toAct: [],
  };
}

function advanceStreet(session: GameSession): GameSession {
  const { table, deck, holeCards } = session;
  const players = table.players.map((p) => ({ ...p, bet: 0 }));
  const nonFolded = players.filter((p) => p.status !== 'folded');
  const canStillBet = nonFolded.filter((p) => p.status === 'active');

  let communityCards = table.communityCards.slice();
  let nextDeck = deck.slice();
  let street = table.street;

  function burnAndDeal(n: number) {
    nextDeck.pop(); // burn
    for (let i = 0; i < n; i++) communityCards.push(nextDeck.pop()!);
  }

  if (street === 'preflop') {
    burnAndDeal(3);
    street = 'flop';
  } else if (street === 'flop') {
    burnAndDeal(1);
    street = 'turn';
  } else if (street === 'turn') {
    burnAndDeal(1);
    street = 'river';
  } else if (street === 'river') {
    return runShowdown({ table: { ...table, players, communityCards }, deck: nextDeck, holeCards, toAct: [] });
  }

  // If fewer than 2 players can still bet, run remaining streets out automatically.
  if (canStillBet.length < 2) {
    if (street === 'river') {
      return runShowdown({ table: { ...table, street, players, communityCards }, deck: nextDeck, holeCards, toAct: [] });
    }
    return advanceStreet({
      table: { ...table, street, players, communityCards, updatedAt: Date.now() },
      deck: nextDeck,
      holeCards,
      toAct: [],
    });
  }

  const dealerSeat = table.dealerSeat;
  const firstActor = nextSeatId(players, dealerSeat, (p) => canAct(p))!;
  const toAct = turnOrderFrom(players, firstActor);

  return {
    table: {
      ...table,
      street,
      players,
      communityCards,
      currentBet: 0,
      minRaise: table.bigBlind,
      actingPlayerId: firstActor,
      lastAggressorId: null,
      updatedAt: Date.now(),
    },
    deck: nextDeck,
    holeCards,
    toAct,
  };
}

interface Pot {
  amount: number;
  eligiblePlayerIds: string[];
}

function computeSidePots(players: PlayerState[]): Pot[] {
  const contributors = players.filter((p) => p.totalHandBet > 0);
  const levels = Array.from(new Set(contributors.map((p) => p.totalHandBet))).sort((a, b) => a - b);
  const pots: Pot[] = [];
  let prevLevel = 0;
  for (const level of levels) {
    const layerSize = level - prevLevel;
    const payingPlayers = contributors.filter((p) => p.totalHandBet >= level);
    const amount = layerSize * payingPlayers.length;
    const eligiblePlayerIds = players
      .filter((p) => p.status !== 'folded' && p.totalHandBet >= level)
      .map((p) => p.id);
    if (amount > 0 && eligiblePlayerIds.length > 0) {
      pots.push({ amount, eligiblePlayerIds });
    }
    prevLevel = level;
  }
  return pots;
}

function runShowdown(session: GameSession): GameSession {
  const { table, holeCards } = session;
  const pots = computeSidePots(table.players);
  const stackDeltas: Record<string, number> = {};
  const results: HandResult[] = [];

  for (const pot of pots) {
    const contenders = pot.eligiblePlayerIds.map((id) => {
      const hand = evaluateBest([...holeCards[id], ...table.communityCards]);
      return { id, hand };
    });
    let winners = [contenders[0]];
    for (const c of contenders.slice(1)) {
      const cmp = compareRankedHands(c.hand, winners[0].hand);
      if (cmp > 0) winners = [c];
      else if (cmp === 0) winners.push(c);
    }
    const share = Math.floor(pot.amount / winners.length);
    let remainder = pot.amount - share * winners.length;
    for (const w of winners) {
      const amount = share + (remainder > 0 ? 1 : 0);
      if (remainder > 0) remainder--;
      stackDeltas[w.id] = (stackDeltas[w.id] ?? 0) + amount;
      results.push({
        playerId: w.id,
        handRankName: w.hand.categoryName,
        bestFive: w.hand.cards,
        amountWon: amount,
      });
    }
  }

  const players = table.players.map((p) => ({
    ...p,
    stack: p.stack + (stackDeltas[p.id] ?? 0),
    bet: 0,
  }));

  return {
    table: {
      ...table,
      street: 'showdown',
      players,
      pot: 0,
      sidePots: [],
      actingPlayerId: null,
      results,
      updatedAt: Date.now(),
    },
    deck: session.deck,
    holeCards,
    toAct: [],
  };
}

export function legalActions(table: TableState, playerId: string): { canCheck: boolean; canCall: boolean; callAmount: number; minRaiseTo: number } {
  const player = table.players.find((p) => p.id === playerId);
  if (!player) return { canCheck: false, canCall: false, callAmount: 0, minRaiseTo: 0 };
  const owed = table.currentBet - player.bet;
  return {
    canCheck: owed === 0,
    canCall: owed > 0,
    callAmount: Math.min(owed, player.stack),
    minRaiseTo: table.currentBet + table.minRaise,
  };
}
