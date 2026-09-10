import { useState } from 'react';
import type { TableState } from '../engine/types';
import { legalActions } from '../engine/engine';
import './ActionBar.css';

interface ActionBarProps {
  table: TableState;
  uid: string;
  onAction: (type: 'fold' | 'check' | 'call' | 'bet' | 'raise', amount?: number) => void;
}

export function ActionBar({ table, uid, onAction }: ActionBarProps) {
  const me = table.players.find((p) => p.id === uid);
  const { canCheck, canCall, callAmount, minRaiseTo } = legalActions(table, uid);
  const maxRaiseTo = me ? me.bet + me.stack : minRaiseTo;
  const [raiseTo, setRaiseTo] = useState(minRaiseTo);

  if (!me || me.status !== 'active') return null;

  const effectiveRaiseTo = Math.min(Math.max(raiseTo, minRaiseTo), maxRaiseTo);
  const raiseLabel = table.currentBet === 0 ? 'Bet' : 'Raise to';
  const raiseType = table.currentBet === 0 ? 'bet' : 'raise';

  return (
    <div className="action-bar">
      <div className="action-buttons">
        <button className="action-btn fold" onClick={() => onAction('fold')}>
          Fold
        </button>
        {canCheck && (
          <button className="action-btn check" onClick={() => onAction('check')}>
            Check
          </button>
        )}
        {canCall && (
          <button className="action-btn call" onClick={() => onAction('call')}>
            Call {callAmount}
          </button>
        )}
      </div>
      {maxRaiseTo > minRaiseTo && (
        <div className="raise-row">
          <input
            type="range"
            min={minRaiseTo}
            max={maxRaiseTo}
            value={effectiveRaiseTo}
            onChange={(e) => setRaiseTo(Number(e.target.value))}
          />
          <button
            className="action-btn raise"
            onClick={() => onAction(raiseType, effectiveRaiseTo)}
          >
            {raiseLabel} {effectiveRaiseTo}
          </button>
        </div>
      )}
      {maxRaiseTo <= minRaiseTo && me.stack > 0 && (
        <button className="action-btn raise" onClick={() => onAction(raiseType, maxRaiseTo)}>
          All-in {maxRaiseTo}
        </button>
      )}
    </div>
  );
}
