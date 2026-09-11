import { getClient } from './supabaseClient';
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
  const { error } = await getClient()
    .from('rooms')
    .insert({ room_code: roomCode, host_id: hostUid, state: table });
  if (error) throw error;
  return roomCode;
}

// Atomic add-a-player via a Postgres function (see supabase-schema.sql) so
// two friends joining at the same instant can't stomp on each other's seat.
export async function joinRoom(roomCode: string, uid: string, name: string, startingStack: number): Promise<void> {
  const { error } = await getClient().rpc('join_room', {
    p_room_code: roomCode.toUpperCase(),
    p_uid: uid,
    p_name: name,
    p_starting_stack: startingStack,
  });
  if (error) throw error;
}

export function subscribeRoom(roomCode: string, onChange: (table: TableState | null) => void): () => void {
  const client = getClient();
  const code = roomCode.toUpperCase();

  client
    .from('rooms')
    .select('state')
    .eq('room_code', code)
    .maybeSingle()
    .then(({ data }) => onChange(data ? (data.state as TableState) : null));

  const channel = client
    .channel(`room:${code}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'rooms', filter: `room_code=eq.${code}` },
      (payload) => {
        if (payload.eventType === 'DELETE') onChange(null);
        else onChange((payload.new as { state: TableState }).state);
      },
    )
    .subscribe();

  return () => {
    client.removeChannel(channel);
  };
}

export function subscribeMyHoleCards(
  roomCode: string,
  uid: string,
  onChange: (cards: Card[] | null) => void,
): () => void {
  const client = getClient();
  const code = roomCode.toUpperCase();

  client
    .from('private_hands')
    .select('cards')
    .eq('room_code', code)
    .eq('player_id', uid)
    .maybeSingle()
    .then(({ data }) => onChange(data ? (data.cards as Card[]) : null));

  // RLS restricts delivered rows to this player's own hand, so filtering by
  // room_code alone is enough - Postgres changes only accepts one column filter.
  const channel = client
    .channel(`hand:${code}:${uid}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'private_hands', filter: `room_code=eq.${code}` },
      (payload) => {
        if (payload.eventType === 'DELETE') return;
        const row = payload.new as { player_id: string; cards: Card[] };
        if (row.player_id === uid) onChange(row.cards);
      },
    )
    .subscribe();

  return () => {
    client.removeChannel(channel);
  };
}

export function subscribeActionQueue(
  roomCode: string,
  onChange: (actions: PlayerAction[]) => void,
): () => void {
  const client = getClient();
  const code = roomCode.toUpperCase();
  let queue: PlayerAction[] = [];

  client
    .from('actions')
    .select('*')
    .eq('room_code', code)
    .order('created_at', { ascending: true })
    .then(({ data }) => {
      queue = (data ?? []).map(rowToAction);
      onChange(queue);
    });

  const channel = client
    .channel(`actions:${code}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'actions', filter: `room_code=eq.${code}` },
      (payload) => {
        queue = [...queue, rowToAction(payload.new as ActionRow)];
        onChange(queue);
      },
    )
    .on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'actions', filter: `room_code=eq.${code}` },
      (payload) => {
        const removedId = (payload.old as { id: string }).id;
        queue = queue.filter((a) => a.id !== removedId);
        onChange(queue);
      },
    )
    .subscribe();

  return () => {
    client.removeChannel(channel);
  };
}

interface ActionRow {
  id: string;
  player_id: string;
  type: PlayerAction['type'];
  amount: number | null;
  hand_number: number;
  created_at: number;
}

function rowToAction(row: ActionRow): PlayerAction {
  return {
    id: row.id,
    playerId: row.player_id,
    type: row.type,
    amount: row.amount ?? undefined,
    handNumber: row.hand_number,
    createdAt: row.created_at,
  };
}

export async function submitAction(roomCode: string, action: PlayerAction): Promise<void> {
  const { error } = await getClient().from('actions').insert({
    id: action.id,
    room_code: roomCode.toUpperCase(),
    player_id: action.playerId,
    type: action.type,
    amount: action.amount ?? null,
    hand_number: action.handNumber,
    created_at: action.createdAt,
  });
  if (error) throw error;
}

export async function consumeAction(roomCode: string, actionId: string): Promise<void> {
  const { error } = await getClient()
    .from('actions')
    .delete()
    .eq('id', actionId)
    .eq('room_code', roomCode.toUpperCase());
  if (error) throw error;
}

// Host-only: publish the new authoritative table state plus each player's
// private hole cards (called right after dealing a hand).
export async function hostPublishTableAndHands(
  roomCode: string,
  table: TableState,
  holeCards: Record<string, Card[]>,
): Promise<void> {
  const client = getClient();
  const code = roomCode.toUpperCase();
  const { error: roomError } = await client.from('rooms').update({ state: table }).eq('room_code', code);
  if (roomError) throw roomError;

  const rows = Object.entries(holeCards).map(([playerId, cards]) => ({
    room_code: code,
    player_id: playerId,
    cards,
  }));
  const { error: handsError } = await client.from('private_hands').upsert(rows, { onConflict: 'room_code,player_id' });
  if (handsError) throw handsError;
}

// Host-only: publish just the table state (no new cards dealt this action).
export async function hostPublishTable(roomCode: string, table: TableState): Promise<void> {
  const { error } = await getClient().from('rooms').update({ state: table }).eq('room_code', roomCode.toUpperCase());
  if (error) throw error;
}

export async function getRoomOnce(roomCode: string): Promise<TableState | null> {
  const { data } = await getClient()
    .from('rooms')
    .select('state')
    .eq('room_code', roomCode.toUpperCase())
    .maybeSingle();
  return data ? (data.state as TableState) : null;
}
