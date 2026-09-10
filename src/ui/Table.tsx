import type { Card, TableState } from '../engine/types';
import { PlayingCard } from './PlayingCard';
import { PlayerSeat } from './PlayerSeat';
import { ActionBar } from './ActionBar';
import './Table.css';

interface TableProps {
  table: TableState;
  uid: string;
  myCards: Card[] | null;
  isHost: boolean;
  onStartHand: () => void;
  onAction: (type: 'fold' | 'check' | 'call' | 'bet' | 'raise', amount?: number) => void;
}

export function Table({ table, uid, myCards, isHost, onStartHand, onAction }: TableProps) {
  const seated = [...table.players].sort((a, b) => a.seat - b.seat);
  const myTurn = table.actingPlayerId === uid;
  const shareUrl = `${window.location.origin}${window.location.pathname}?room=${table.roomCode}`;

  return (
    <div className="table-screen">
      <header className="table-header">
        <div>
          Room <strong>{table.roomCode}</strong>
        </div>
        <button
          className="share-btn"
          onClick={() => {
            navigator.clipboard?.writeText(shareUrl).catch(() => {});
          }}
        >
          Copy invite link
        </button>
      </header>

      <div className="seats-row">
        {seated.map((p) => (
          <PlayerSeat
            key={p.id}
            player={p}
            isActing={table.actingPlayerId === p.id}
            isMe={p.id === uid}
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

        {table.phase === 'lobby' && (
          <div className="lobby-panel">
            <p>Waiting for players ({seated.length} joined)</p>
            {isHost ? (
              <button className="btn btn-primary" onClick={onStartHand} disabled={seated.length < 2}>
                {seated.length < 2 ? 'Need 2+ players' : 'Deal first hand'}
              </button>
            ) : (
              <p>Waiting for host to start the hand…</p>
            )}
          </div>
        )}

        {table.street === 'showdown' && table.results && (
          <div className="showdown-panel">
            {table.results.map((r, i) => (
              <div key={i} className="showdown-result">
                {seated.find((p) => p.id === r.playerId)?.name} won {r.amountWon} ({r.handRankName})
              </div>
            ))}
            {isHost && (
              <button className="btn btn-primary" onClick={onStartHand}>
                Deal next hand
              </button>
            )}
          </div>
        )}
      </div>

      {myCards && table.phase === 'hand' && (
        <div className="my-hand">
          {myCards.map((c, i) => (
            <PlayingCard key={i} card={c} />
          ))}
        </div>
      )}

      {myTurn && table.street !== 'showdown' && <ActionBar table={table} uid={uid} onAction={onAction} />}
    </div>
  );
}
