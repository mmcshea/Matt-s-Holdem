import { useState } from 'react';
import './Lobby.css';

interface SetupProps {
  onStart: (names: string[], smallBlind: number, bigBlind: number, startingStack: number) => void;
}

export function PassAndPlaySetup({ onStart }: SetupProps) {
  const [names, setNames] = useState<string[]>(['', '']);
  const [smallBlind, setSmallBlind] = useState(5);
  const [bigBlind, setBigBlind] = useState(10);
  const [startingStack, setStartingStack] = useState(1000);

  function updateName(i: number, value: string) {
    setNames((prev) => prev.map((n, idx) => (idx === i ? value : n)));
  }

  function addPlayer() {
    if (names.length < 9) setNames((prev) => [...prev, '']);
  }

  function removePlayer(i: number) {
    setNames((prev) => prev.filter((_, idx) => idx !== i));
  }

  const cleanNames = names.map((n) => n.trim());
  const canStart = cleanNames.filter(Boolean).length >= 2 && cleanNames.every((n) => n);

  return (
    <div className="lobby">
      <h1>Hold&rsquo;em</h1>
      <p style={{ opacity: 0.85, textAlign: 'center', maxWidth: '22rem' }}>
        Pass-and-play: everyone shares this phone. Cards stay hidden until it&rsquo;s your turn.
      </p>
      <form
        className="lobby-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (canStart) onStart(cleanNames, smallBlind, bigBlind, startingStack);
        }}
      >
        {names.map((name, i) => (
          <label key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}>
            <input
              value={name}
              onChange={(e) => updateName(i, e.target.value)}
              placeholder={`Player ${i + 1} name`}
              maxLength={16}
              style={{ flex: 1 }}
            />
            {names.length > 2 && (
              <button
                type="button"
                className="btn btn-link"
                onClick={() => removePlayer(i)}
                aria-label={`Remove player ${i + 1}`}
              >
                ✕
              </button>
            )}
          </label>
        ))}
        {names.length < 9 && (
          <button type="button" className="btn" onClick={addPlayer}>
            + Add player
          </button>
        )}

        <label>
          Starting stack
          <input
            type="number"
            min={bigBlind}
            value={startingStack}
            onChange={(e) => setStartingStack(Number(e.target.value))}
          />
        </label>
        <div className="blind-row">
          <label>
            Small blind
            <input type="number" min={1} value={smallBlind} onChange={(e) => setSmallBlind(Number(e.target.value))} />
          </label>
          <label>
            Big blind
            <input type="number" min={2} value={bigBlind} onChange={(e) => setBigBlind(Number(e.target.value))} />
          </label>
        </div>

        <button className="btn btn-primary" type="submit" disabled={!canStart}>
          Deal first hand
        </button>
      </form>
    </div>
  );
}
