# Hold'em

A mobile-first Texas Hold'em PWA with two ways to play:

- **Pass & Play** - everyone shares one phone, taking turns; hole cards stay
  hidden behind a "tap to reveal" gate between turns. Works immediately,
  zero setup.
- **Online multiplayer** - each player uses their own phone; a room creator
  shares a code/link, everyone joins, hole cards are private to each
  player. Needs a one-time Supabase project (below).

Live at: **https://mmcshea.github.io/Matt-s-Holdem/**
(auto-deployed by GitHub Actions on every push to `main` - see
`.github/workflows/deploy-pages.yml`.)

- **Engine**: full hold'em rules (blinds, betting rounds, side pots, hand
  evaluation, showdown) - `src/engine/`, covered by 20 unit tests
  (`npm test`).
- **Sync**: [Supabase](https://supabase.com) (Postgres + Realtime +
  Anonymous Auth). The room creator's device runs the authoritative game
  engine and publishes state; other phones just read state and submit
  actions. Row Level Security policies keep each player's hole cards
  visible only to them.
- **Install on phones**: it's a PWA - open the URL on a phone and
  "Add to Home Screen" for an app-like icon with no app store involved.

## 1. Run it locally

```bash
npm install
npm test        # engine + hand-evaluator unit tests
npm run dev      # http://localhost:5173
```

Pass & Play works immediately with no setup. Online multiplayer needs a
Supabase project (see below) - until `.env.local` is filled in, picking
"Online multiplayer" will show a sign-in error, which is expected.

## 2. Create a Supabase project (one-time, ~5 minutes)

This part needs your own account - it can't be done from here.

1. Go to [supabase.com](https://supabase.com/dashboard) and sign in
   (GitHub sign-in is the fastest option).
2. **New project** - pick an org, name it anything, set a database
   password (save it somewhere, though this app never needs it again),
   pick any region, create.
3. Once the project's ready, open the **SQL Editor** (left sidebar),
   **New query**, paste in the entire contents of `supabase-schema.sql`
   from this repo, and click **Run**. This creates all the tables,
   security policies, realtime subscriptions, and one helper function -
   one paste, one click, nothing else to configure by hand.
4. **Authentication > Sign In / Providers > Anonymous Sign-Ins** - toggle
   this **on** (this is the one setting that can't be done via SQL). Save.
5. **Project Settings > API** - copy the **Project URL** and the
   **anon / public** API key.
6. Create `.env.local` in the project root (copy `.env.example`) and paste
   those two values in:

   ```
   VITE_SUPABASE_URL=...
   VITE_SUPABASE_ANON_KEY=...
   ```

   This makes online mode work when running locally (`npm run dev`).

## 3. Make the deployed site use it too

`.env.local` only affects your own machine - it's gitignored and never
reaches GitHub Actions. For the **live** site (the URL at the top of this
file) to pick up your Supabase project, add the same two values as
**repository secrets**:

**Settings > Secrets and variables > Actions > New repository secret**,
add both `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` with the same
values as in `.env.local`.

The next push to `main` (or re-running the workflow from the **Actions**
tab) will rebuild with those values baked in, and online multiplayer will
work at the live URL. Until this step, the deployed site's "Online
multiplayer" option will show a sign-in error - that's expected, and
Pass & Play is unaffected either way.

## 4. Get it on phones

Send the deployed URL (or a room's invite link, which is the same URL with
`?room=CODE`) to each player. On phone, open it and use the browser's
"Add to Home Screen" / "Install app" option for a real app icon - no App
Store or Play Store needed, works on iOS and Android.

## How a game works

**Pass & Play**: enter everyone's names on one phone, deal, and pass the
phone around - each turn shows a "pass to \<name\>" gate before revealing
that player's cards.

**Online multiplayer**:
1. One person opens the site, picks **Online multiplayer**, enters a name,
   and **Create a table** (sets blinds and starting chip stack). They
   become the host.
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
- Pass & Play state is saved to the browser's local storage so a reload
  doesn't lose the game, but it's per-device only (not shared/backed up).
