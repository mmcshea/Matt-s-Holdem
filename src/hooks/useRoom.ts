import { useEffect, useState } from 'react';
import type { Card, TableState } from '../engine/types';
import { subscribeMyHoleCards, subscribeRoom } from '../firebase/roomService';

export function useRoom(roomCode: string | null, uid: string | null) {
  const [table, setTable] = useState<TableState | null>(null);
  const [myCards, setMyCards] = useState<Card[] | null>(null);

  useEffect(() => {
    if (!roomCode) return;
    const unsubscribe = subscribeRoom(roomCode, setTable);
    return unsubscribe;
  }, [roomCode]);

  useEffect(() => {
    if (!roomCode || !uid) return;
    const unsubscribe = subscribeMyHoleCards(roomCode, uid, setMyCards);
    return unsubscribe;
  }, [roomCode, uid]);

  return { table, myCards };
}
