import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  setDoc,
  type DocumentData,
  type Unsubscribe,
} from 'firebase/firestore';
import { getDb } from './firebase';
import type { Card, PlayerAction, TableState } from '../engine/types';
import { createInitialTable, type NewPlayerInput } from '../engine/engine';

const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no O/0/I/1 ambiguity

export function generateRoomCode(length = 5): string {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
  }
  return code;
}

function roomRef(roomCode: string) {
  return doc(getDb(), 'rooms', roomCode.toUpperCase());
}

function privateHandRef(roomCode: string, uid: string) {
  return doc(getDb(), 'rooms', roomCode.toUpperCase(), 'private', uid);
}

function actionsCollection(roomCode: string) {
  return collection(getDb(), 'rooms', roomCode.toUpperCase(), 'actions');
}

export async function createRoom(
  hostUid: string,
  hostName: string,
  smallBlind: number,
  bigBlind: number,
  startingStack: number,
): Promise<string> {
  const roomCode = generateRoomCode();
  const players: NewPlayerInput[] = [{ id: hostUid, name: hostName, seat: 0, stack: startingStack }];
  const table = createInitialTable(roomCode, hostUid, players, smallBlind, bigBlind);
  await setDoc(roomRef(roomCode), table as unknown as DocumentData);
  return roomCode;
}

export async function joinRoom(roomCode: string, uid: string, name: string, startingStack: number): Promise<void> {
  const ref = roomRef(roomCode);
  await runTransaction(getDb(), async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Room not found');
    const table = snap.data() as TableState;
    if (table.players.some((p) => p.id === uid)) return; // already joined (reconnect)
    if (table.phase !== 'lobby') throw new Error('Hand already in progress, cannot join mid-hand');
    const nextSeat = table.players.length === 0 ? 0 : Math.max(...table.players.map((p) => p.seat)) + 1;
    const players = [
      ...table.players,
      { id: uid, name, seat: nextSeat, stack: startingStack, bet: 0, totalHandBet: 0, status: 'active' as const, isHost: false },
    ];
    tx.update(ref, { players, updatedAt: Date.now() });
  });
}

export function subscribeRoom(roomCode: string, onChange: (table: TableState | null) => void): Unsubscribe {
  return onSnapshot(roomRef(roomCode), (snap) => {
    onChange(snap.exists() ? (snap.data() as TableState) : null);
  });
}

export function subscribeMyHoleCards(
  roomCode: string,
  uid: string,
  onChange: (cards: Card[] | null) => void,
): Unsubscribe {
  return onSnapshot(privateHandRef(roomCode, uid), (snap) => {
    onChange(snap.exists() ? ((snap.data().cards as Card[]) ?? null) : null);
  });
}

export function subscribeActionQueue(
  roomCode: string,
  onChange: (actions: PlayerAction[]) => void,
): Unsubscribe {
  const q = query(actionsCollection(roomCode), orderBy('createdAt', 'asc'));
  return onSnapshot(q, (snap) => {
    onChange(snap.docs.map((d) => d.data() as PlayerAction));
  });
}

export async function submitAction(roomCode: string, action: PlayerAction): Promise<void> {
  await setDoc(doc(actionsCollection(roomCode), action.id), action as unknown as DocumentData);
}

export async function consumeAction(roomCode: string, actionId: string): Promise<void> {
  await deleteDoc(doc(actionsCollection(roomCode), actionId));
}

// Host-only: publish the new authoritative table state plus each player's
// private hole cards (called right after dealing a hand).
export async function hostPublishTableAndHands(
  roomCode: string,
  table: TableState,
  holeCards: Record<string, Card[]>,
): Promise<void> {
  await setDoc(roomRef(roomCode), table as unknown as DocumentData);
  await Promise.all(
    Object.entries(holeCards).map(([uid, cards]) =>
      setDoc(privateHandRef(roomCode, uid), { cards }),
    ),
  );
}

// Host-only: publish just the table state (no new cards dealt this action).
export async function hostPublishTable(roomCode: string, table: TableState): Promise<void> {
  await setDoc(roomRef(roomCode), table as unknown as DocumentData);
}

export async function getRoomOnce(roomCode: string): Promise<TableState | null> {
  const snap = await getDoc(roomRef(roomCode));
  return snap.exists() ? (snap.data() as TableState) : null;
}
