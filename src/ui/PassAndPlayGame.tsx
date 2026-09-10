import { useEffect, useState } from 'react';
import type { GameSession } from '../engine/engine';
import { PlayingCard } from './PlayingCard';
import { PlayerSeat } from './PlayerSeat';
import { ActionBar } from './ActionBar';
import './Table.css';

interface PassAndPlayGameProps {
  session: GameSession;
  onAction: (type: 'fold' | 'check' | 'call' | 'bet' | 'raise', amount?: number) => void;
  onDealNext: () => void;
  onNewGame: () => void;
}

export function PassAndPlayGame({ session, onAction, onDealNext, onNewGame }: PassAndPlayGameProps) {
  const { table } = session;
  const seated = [...table.players].sort((a, b) => a.seat - b.seat);
  const [revealedFor, setRevealedFor] = useState<string | null>(null);

  useEffect(() => {
    setRevealedFor(null);
  }, [table.actingPlayerId, table.handNumber]);

  const actingPlayer = table.actingPlayerId ? seated.find((p) => p.id === table.actingPlayerId) : null;
  const needsGate = !!actingPlayer && revealedFor !== actingPlayer.id;

  if (needsGate && actingPlayer) {
    return (
      <div className="table-screen">
        <div className="pass-gate">
          <p className="pass-gate-sub">Pass the phone to</p>
          <h1 className="pass-gate-name">{actingPlayer.name}</h1>
          <button className="btn btn-primary" onClick={() => setRevealedFor(actingPlayer.id)}>
            I&rsquo;m {actingPlayer.name} — show my cards
          </button>
          <p className="pass-gate-hint">Everyone else look away!</p>
        </div>
      </div>
    );
  }

  const myCards = actingPlayer ? session.holeCards[actingPlayer.id] : undefined;

  return (
    <div className="table-screen">
      <header className="table-header">
        <div>Pass &amp; Play</div>
        <button className="share-btn" onClick={onNewGame}>
          New game
        </button>
      </header>

      <div className="seats-row">
        {seated.map((p) => (
          <PlayerSeat
            key={p.id}
            player={p}
            isActing={table.actingPlayerId === p.id}
            isMe={false}
            wonAmount={table.results?.find((r) => r.playerId === p.id)?.amountWon}
          />
        ))}
      </div>

      <div className="felt">
        <div className="pot-display">Pot: {table.pot}</div>
        <div className="community-cards">
          {table.communityCards.map((c, i) => (
            <PlayingCard key={i} card={c} />
          ))}
          {Array.from({ length: 5 - table.communityCards.length }).map((_, i) => (
            <div key={`ph-${i}`} className="card-placeholder" />
          ))}
        </div>

        {table.street === 'showdown' && table.results && (
          <div className="showdown-panel">
            {table.results.map((r, i) => (
              <div key={i} className="showdown-result">
                {seated.find((p) => p.id === r.playerId)?.name} won {r.amountWon} ({r.handRankName})
              </div>
            ))}
            <button className="btn btn-primary" onClick={onDealNext}>
              Deal next hand
            </button>
          </div>
        )}
      </div>

      {myCards && table.street !== 'showdown' && actingPlayer && (
        <div className="my-hand">
          <span className="my-hand-label">{actingPlayer.name}&rsquo;s cards:</span>
          {myCards.map((c, i) => (
            <PlayingCard key={i} card={c} />
          ))}
        </div>
      )}

      {actingPlayer && table.street !== 'showdown' && (
        <ActionBar table={table} uid={actingPlayer.id} onAction={onAction} />
      )}
    </div>
  );
}
