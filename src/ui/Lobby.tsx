import { useState } from 'react';
import './Lobby.css';

interface LobbyProps {
  defaultName: string;
  onCreate: (name: string, smallBlind: number, bigBlind: number, startingStack: number) => Promise<void>;
  onJoin: (name: string, roomCode: string) => Promise<void>;
  initialRoomCode?: string;
  error: string | null;
}

export function Lobby({ defaultName, onCreate, onJoin, initialRoomCode, error }: LobbyProps) {
  const [name, setName] = useState(defaultName);
  const [roomCode, setRoomCode] = useState(initialRoomCode ?? '');
  const [mode, setMode] = useState<'choose' | 'create' | 'join'>(initialRoomCode ? 'join' : 'choose');
  const [smallBlind, setSmallBlind] = useState(5);
  const [bigBlind, setBigBlind] = useState(10);
  const [startingStack, setStartingStack] = useState(1000);
  const [busy, setBusy] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      await onCreate(name.trim(), smallBlind, bigBlind, startingStack);
    } finally {
      setBusy(false);
    }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !roomCode.trim()) return;
    setBusy(true);
    try {
      await onJoin(name.trim(), roomCode.trim().toUpperCase());
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="lobby">
      <h1>Hold&rsquo;em</h1>
      {error && <p className="lobby-error">{error}</p>}

      {mode === 'choose' && (
        <div className="lobby-choices">
          <button className="btn btn-primary" onClick={() => setMode('create')}>
            Create a table
          </button>
          <button className="btn" onClick={() => setMode('join')}>
            Join with a code
          </button>
        </div>
      )}

      {mode === 'create' && (
        <form className="lobby-form" onSubmit={handleCreate}>
          <label>
            Your name
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={20} required />
          </label>
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
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? 'Creating…' : 'Create table'}
          </button>
          <button className="btn btn-link" type="button" onClick={() => setMode('choose')}>
            Back
          </button>
        </form>
      )}

      {mode === 'join' && (
        <form className="lobby-form" onSubmit={handleJoin}>
          <label>
            Your name
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={20} required />
          </label>
          <label>
            Room code
            <input
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              maxLength={8}
              placeholder="e.g. AB3XZ"
              required
              autoCapitalize="characters"
            />
          </label>
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? 'Joining…' : 'Join table'}
          </button>
          <button className="btn btn-link" type="button" onClick={() => setMode('choose')}>
            Back
          </button>
        </form>
      )}
    </div>
  );
}
