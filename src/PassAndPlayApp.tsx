import { useEffect, useState } from 'react';
import { applyAction, createInitialTable, dealNewHand, type GameSession } from './engine/engine';
import { PassAndPlaySetup } from './ui/PassAndPlaySetup';
import { PassAndPlayGame } from './ui/PassAndPlayGame';

const STORAGE_KEY = 'holdem-pass-and-play-session';

function loadSession(): GameSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as GameSession) : null;
  } catch {
    return null;
  }
}

export default function PassAndPlayApp() {
  const [session, setSession] = useState<GameSession | null>(() => loadSession());

  useEffect(() => {
    try {
      if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      // best-effort persistence only
    }
  }, [session]);

  function handleStart(names: string[], smallBlind: number, bigBlind: number, startingStack: number) {
    const players = names.map((name, i) => ({ id: `p${i}`, name, seat: i, stack: startingStack }));
    const initial = createInitialTable('LOCAL', players[0].id, players, smallBlind, bigBlind);
    setSession(dealNewHand(initial, Object.fromEntries(players.map((p) => [p.id, p.stack]))));
  }

  function handleAction(type: 'fold' | 'check' | 'call' | 'bet' | 'raise', amount?: number) {
    if (!session || !session.table.actingPlayerId) return;
    const updated = applyAction(session, {
      id: `${session.table.actingPlayerId}-${Date.now()}`,
      playerId: session.table.actingPlayerId,
      type,
      amount,
      handNumber: session.table.handNumber,
      createdAt: Date.now(),
    });
    setSession(updated);
  }

  function handleDealNext() {
    if (!session) return;
    const stacks = Object.fromEntries(session.table.players.map((p) => [p.id, p.stack]));
    setSession(dealNewHand(session.table, stacks));
  }

  if (!session) {
    return <PassAndPlaySetup onStart={handleStart} />;
  }

  return (
    <PassAndPlayGame
      session={session}
      onAction={handleAction}
      onDealNext={handleDealNext}
      onNewGame={() => setSession(null)}
    />
  );
}
