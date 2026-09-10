import type { Card } from '../engine/types';
import './PlayingCard.css';

const RANK_LABELS: Record<number, string> = {
  11: 'J',
  12: 'Q',
  13: 'K',
  14: 'A',
};

const SUIT_SYMBOLS: Record<Card['suit'], string> = {
  s: '♠',
  h: '♥',
  d: '♦',
  c: '♣',
};

export function PlayingCard({ card, faceDown }: { card?: Card; faceDown?: boolean }) {
  if (faceDown || !card) {
    return <div className="card card-back" aria-label="face-down card" />;
  }
  const rankLabel = RANK_LABELS[card.rank] ?? String(card.rank);
  const isRed = card.suit === 'h' || card.suit === 'd';
  return (
    <div className={`card ${isRed ? 'card-red' : 'card-black'}`}>
      <span className="card-rank">{rankLabel}</span>
      <span className="card-suit">{SUIT_SYMBOLS[card.suit]}</span>
    </div>
  );
}
