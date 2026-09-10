export type Suit = 's' | 'h' | 'd' | 'c';
// 2-10, 11=J, 12=Q, 13=K, 14=A
export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;

export interface Card {
  rank: Rank;
  suit: Suit;
}

export type Street = 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';

export type PlayerStatus = 'active' | 'folded' | 'all-in' | 'sitting-out';

export interface PlayerState {
  id: string; // firebase auth uid
  name: string;
  seat: number;
  stack: number; // chips not in the pot
  bet: number; // chips committed this street
  totalHandBet: number; // chips committed this hand (for side pots)
  status: PlayerStatus;
  isHost: boolean;
}

export interface PotShare {
  amount: number;
  eligiblePlayerIds: string[];
}

export interface HandResult {
  playerId: string;
  handRankName: string;
  bestFive: Card[];
  amountWon: number;
}

export type RoomPhase = 'lobby' | 'hand';

export interface TableState {
  roomCode: string;
  hostId: string; // uid of the player whose device runs the authoritative engine
  phase: RoomPhase;
  street: Street;
  deckSeed: string; // for reproducibility/debugging only, not security
  communityCards: Card[];
  pot: number;
  sidePots: PotShare[];
  currentBet: number; // highest bet this street
  minRaise: number;
  dealerSeat: number;
  actingPlayerId: string | null;
  lastAggressorId: string | null;
  smallBlind: number;
  bigBlind: number;
  players: PlayerState[];
  handNumber: number;
  results: HandResult[] | null; // set during showdown
  updatedAt: number;
}

export type ActionType = 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'post-blind';

export interface PlayerAction {
  id: string; // unique action id
  playerId: string;
  type: ActionType;
  amount?: number; // for bet/raise: total bet-to amount, not delta
  handNumber: number;
  createdAt: number;
  consumed?: boolean;
}
