import { useEffect, useRef } from 'react';
import { applyAction, dealNewHand, type GameSession } from '../engine/engine';
import type { TableState } from '../engine/types';
import {
  consumeAction,
  hostPublishTable,
  hostPublishTableAndHands,
  subscribeActionQueue,
} from '../firebase/roomService';

// Runs only on the host's device. Owns the authoritative GameSession
// (including the deck and everyone's hole cards, which never touch
// Firestore in plaintext-to-everyone form) and drives it forward as
// player actions arrive in the room's action queue.
//
// Known limitation: the deck/hole-card state lives only in this device's
// memory. If the host reloads mid-hand, that in-memory state is lost and
// the hand cannot be resumed correctly - start a new hand instead.
export function useHostController(roomCode: string | null, isHost: boolean, table: TableState | null) {
  const sessionRef = useRef<GameSession | null>(null);
  const processingRef = useRef(false);

  // Keep the host's authoritative session's table pointer in sync with the
  // latest published state (covers the host's own optimistic local writes).
  useEffect(() => {
    if (sessionRef.current && table) {
      sessionRef.current = { ...sessionRef.current, table };
    }
  }, [table]);

  useEffect(() => {
    if (!roomCode || !isHost) return;

    const unsubscribe = subscribeActionQueue(roomCode, async (actions) => {
      if (processingRef.current) return;
      const session = sessionRef.current;
      if (!session) return;

      const next = actions.find((a) => a.playerId === session.table.actingPlayerId);
      if (!next) return;

      processingRef.current = true;
      try {
        const updated = applyAction(session, next);
        sessionRef.current = updated;
        await hostPublishTable(roomCode, updated.table);
        await consumeAction(roomCode, next.id);
      } catch (err) {
        // Stale or invalid action (e.g. duplicate submit) - drop it so the
        // queue doesn't jam.
        console.error('Failed to apply action, dropping it', err);
        await consumeAction(roomCode, next.id);
      } finally {
        processingRef.current = false;
      }
    });

    return unsubscribe;
  }, [roomCode, isHost]);

  async function startHand() {
    if (!roomCode || !isHost || !table) return;
    const stacks = Object.fromEntries(table.players.map((p) => [p.id, p.stack]));
    const session = dealNewHand(table, stacks);
    sessionRef.current = session;
    await hostPublishTableAndHands(roomCode, session.table, session.holeCards);
  }

  return { startHand };
}
