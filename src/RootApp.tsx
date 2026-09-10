import { lazy, Suspense, useState } from 'react';
import PassAndPlayApp from './PassAndPlayApp';
import './App.css';

// Lazy-loaded so Firebase (imported transitively by App) never initializes
// unless the user actually picks online mode - pass-and-play must work even
// with no Firebase project configured at all.
const App = lazy(() => import('./App'));

type Mode = 'choose' | 'pass-and-play' | 'online';

function hasRoomInUrl(): boolean {
  return new URLSearchParams(window.location.search).has('room');
}

export default function RootApp() {
  const [mode, setMode] = useState<Mode>(hasRoomInUrl() ? 'online' : 'choose');

  if (mode === 'pass-and-play') return <PassAndPlayApp />;
  if (mode === 'online') {
    return (
      <Suspense fallback={<div className="loading-screen">Loading…</div>}>
        <App />
      </Suspense>
    );
  }

  return (
    <div className="mode-choose">
      <h1>Hold&rsquo;em</h1>
      <button className="btn btn-primary" onClick={() => setMode('pass-and-play')}>
        Pass &amp; Play
        <span className="mode-sub">One phone, everyone takes turns — works right now</span>
      </button>
      <button className="btn" onClick={() => setMode('online')}>
        Online multiplayer
        <span className="mode-sub">Each player uses their own phone — needs Firebase setup first</span>
      </button>
    </div>
  );
}
