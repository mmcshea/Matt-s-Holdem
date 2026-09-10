import { useEffect, useState } from 'react';
import { useAuth } from './hooks/useAuth';
import { useRoom } from './hooks/useRoom';
import { useHostController } from './hooks/useHostController';
import { Lobby } from './ui/Lobby';
import { Table } from './ui/Table';
import { createRoom, joinRoom, submitAction } from './firebase/roomService';
import './App.css';

function readRoomFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get('room');
}

export default function App() {
  const { user, error: authError } = useAuth();
  const [roomCode, setRoomCode] = useState<string | null>(() => readRoomFromUrl());
  const [joinError, setJoinError] = useState<string | null>(null);
  const [defaultName] = useState(() => localStorage.getItem('holdem-name') ?? '');

  const { table, myCards } = useRoom(roomCode, user?.uid ?? null);
  const isHost = !!(table && user && table.hostId === user.uid);
  const { startHand } = useHostController(roomCode, isHost, table);

  useEffect(() => {
    if (!roomCode) return;
    const url = new URL(window.location.href);
    url.searchParams.set('room', roomCode);
    window.history.replaceState({}, '', url.toString());
  }, [roomCode]);

  async function handleCreate(name: string, smallBlind: number, bigBlind: number, startingStack: number) {
    if (!user) return;
    localStorage.setItem('holdem-name', name);
    setJoinError(null);
    try {
      const code = await createRoom(user.uid, name, smallBlind, bigBlind, startingStack);
      setRoomCode(code);
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : 'Failed to create table');
    }
  }

  async function handleJoin(name: string, code: string) {
    if (!user) return;
    localStorage.setItem('holdem-name', name);
    setJoinError(null);
    try {
      await joinRoom(code, user.uid, name, 1000);
      setRoomCode(code);
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : 'Failed to join table');
    }
  }

  async function handleAction(type: 'fold' | 'check' | 'call' | 'bet' | 'raise', amount?: number) {
    if (!roomCode || !user || !table) return;
    await submitAction(roomCode, {
      id: `${user.uid}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      playerId: user.uid,
      type,
      amount,
      handNumber: table.handNumber,
      createdAt: Date.now(),
    });
  }

  if (authError) {
    return <div className="fatal-error">Couldn&rsquo;t sign in: {authError}</div>;
  }
  if (!user) {
    return <div className="loading-screen">Connecting…</div>;
  }
  const hasJoined = !!table?.players.some((p) => p.id === user.uid);
  if (!roomCode || !table || !hasJoined) {
    return (
      <Lobby
        defaultName={defaultName}
        onCreate={handleCreate}
        onJoin={handleJoin}
        initialRoomCode={roomCode ?? undefined}
        error={joinError}
      />
    );
  }

  return (
    <Table
      table={table}
      uid={user.uid}
      myCards={myCards}
      isHost={isHost}
      onStartHand={startHand}
      onAction={handleAction}
    />
  );
}
