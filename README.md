# Hold'em

A mobile-first Texas Hold'em PWA. One player creates a table and shares a room
code / link; everyone else opens it on their own phone, sees their own hole
cards privately, and plays a normal hand of hold'em together in real time.

- **Engine**: full hold'em rules (blinds, betting rounds, side pots, hand
  evaluation, showdown) - `src/engine/`, covered by 20 unit tests
  (`npm test`).
- **Sync**: Firebase Firestore + Anonymous Auth. The room creator's device
  runs the authoritative game engine and publishes state; other phones just
  read state and submit actions. Firestore security rules keep each
  player's hole cards visible only to them.
- **Install on phones**: it's a PWA - open the URL on a phone and
  "Add to Home Screen" for an app-like icon with no app store involved.

## 1. Run it locally

```bash
npm install
npm test        # engine + hand-evaluator unit tests
npm run dev      # http://localhost:5173
```

The app won't fully work yet without a Firebase project (see below) - it
will show a sign-in error until `.env.local` is filled in.

## 2. Create a Firebase project (one-time, ~5 minutes)

This part needs your Google account - it can't be done from here.

1. Go to the [Firebase console](https://console.firebase.google.com/) and
   create a new project (free "Spark" plan is enough).
2. **Build > Authentication > Get started > Sign-in method > Anonymous >
   Enable.**
3. **Build > Firestore Database > Create database** (start in production
   mode; any region is fine).
4. **Project settings (gear icon) > General > Your apps > Add app > Web
   (`</>`)**. Register the app (no hosting setup needed there), then copy
   the `firebaseConfig` values shown.
5. Create `.env.local` in the project root (copy `.env.example`) and paste
   those values in:

   ```
   VITE_FIREBASE_API_KEY=...
   VITE_FIREBASE_AUTH_DOMAIN=...
   VITE_FIREBASE_PROJECT_ID=...
   VITE_FIREBASE_STORAGE_BUCKET=...
   VITE_FIREBASE_MESSAGING_SENDER_ID=...
   VITE_FIREBASE_APP_ID=...
   ```

6. Deploy the security rules in `firestore.rules` (they're what keeps hole
   cards private) - either paste `firestore.rules`'s contents into
   **Firestore Database > Rules** in the console and hit Publish, or via
   CLI:

   ```bash
   npm install -g firebase-tools
   firebase login
   firebase use --add        # pick the project you just created
   firebase deploy --only firestore:rules
   ```

## 3. Deploy so phones can reach it

Any static host works since this is a plain Vite build. Two easy options:

**Firebase Hosting** (same project, no extra account):

```bash
npm run build
firebase deploy --only hosting
```

You'll get a `https://<project-id>.web.app` URL.

**Vercel** (equally easy, sometimes faster):

```bash
npm install -g vercel
vercel --prod
```

Add the six `VITE_FIREBASE_*` variables from `.env.local` in the Vercel
project's Environment Variables settings first (or pass with `vercel env`),
since `.env.local` itself is gitignored and never uploaded.

## 4. Get it on phones

Send the deployed URL (or a room's invite link, which is the same URL with
`?room=CODE`) to each player. On phone, open it and use the browser's
"Add to Home Screen" / "Install app" option for a real app icon - no App
Store or Play Store needed, works on iOS and Android.

## How a game works

1. One person opens the site, enters a name, and **Create a table** (sets
   blinds and starting chip stack). They become the host.
2. They share the room code or invite link with the others, who **Join with
   a code**.
3. Once 2+ players have joined, the host taps **Deal first hand**.
4. Everyone plays from their own phone - hole cards are private, action bar
   appears when it's your turn.
5. After showdown, the host taps **Deal next hand** to continue.

## Known limitations (MVP)

- **The host's device is authoritative.** If the host closes the tab or
  loses connection mid-hand, that hand's in-progress state (whose turn,
  the deck, private cards) can't be recovered - start a new hand once
  they're back. Between hands there's no issue.
- No reconnect/rejoin mid-hand for a dropped non-host player either; they
  can still rejoin the room, just not mid-hand.
- Single table per room code; no lobby list of open tables, no persistent
  accounts/chip history across sessions - it's built for "friends starting
  a game together right now."
