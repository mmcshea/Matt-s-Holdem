-- Hold'em multiplayer schema for Supabase.
-- Run this once in your project's SQL Editor (Supabase dashboard ->
-- SQL Editor -> New query -> paste this whole file -> Run).

create table if not exists rooms (
  room_code text primary key,
  host_id text not null,
  state jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists private_hands (
  room_code text not null references rooms (room_code) on delete cascade,
  player_id text not null,
  cards jsonb not null,
  primary key (room_code, player_id)
);

create table if not exists actions (
  id text primary key,
  room_code text not null references rooms (room_code) on delete cascade,
  player_id text not null,
  type text not null,
  amount int,
  hand_number int not null,
  created_at bigint not null
);

alter table rooms enable row level security;
alter table private_hands enable row level security;
alter table actions enable row level security;

-- rooms: public table state is readable by anyone signed in (including
-- anonymous sessions); only the room's creator can create/update it.
create policy "rooms readable by signed-in users" on rooms
  for select using (auth.uid() is not null);

create policy "only creator can insert their room" on rooms
  for insert with check (host_id = auth.uid()::text);

create policy "only host can update their room" on rooms
  for update using (host_id = auth.uid()::text);

-- private_hands: a player can read only their own hole cards; only the
-- room's host (the device running the dealer logic) may write them.
create policy "players read only their own hand" on private_hands
  for select using (player_id = auth.uid()::text);

create policy "only host writes hole cards" on private_hands
  for insert with check (
    exists (
      select 1 from rooms r
      where r.room_code = private_hands.room_code
        and r.host_id = auth.uid()::text
    )
  );

create policy "only host updates hole cards" on private_hands
  for update using (
    exists (
      select 1 from rooms r
      where r.room_code = private_hands.room_code
        and r.host_id = auth.uid()::text
    )
  );

-- actions: anyone signed in can read the queue; a player can only submit
-- their own action; only the host can delete (consume) processed actions.
create policy "actions readable by signed-in users" on actions
  for select using (auth.uid() is not null);

create policy "players submit only their own action" on actions
  for insert with check (player_id = auth.uid()::text);

create policy "only host deletes processed actions" on actions
  for delete using (
    exists (
      select 1 from rooms r
      where r.room_code = actions.room_code
        and r.host_id = auth.uid()::text
    )
  );

-- Realtime: let clients subscribe to changes on these tables.
alter publication supabase_realtime add table rooms;
alter publication supabase_realtime add table private_hands;
alter publication supabase_realtime add table actions;

-- Atomic "join a room" - runs as a single server-side transaction so two
-- players joining at the same instant can't grab the same seat or race
-- each other's writes (the client can't safely read-modify-write JSON
-- columns directly under concurrency).
create or replace function join_room(
  p_room_code text,
  p_uid text,
  p_name text,
  p_starting_stack int
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_state jsonb;
  v_players jsonb;
  v_next_seat int;
  v_already boolean;
begin
  select state into v_state from rooms where room_code = p_room_code for update;
  if v_state is null then
    raise exception 'Room not found';
  end if;
  if (v_state ->> 'phase') <> 'lobby' then
    raise exception 'Hand already in progress, cannot join mid-hand';
  end if;

  v_players := coalesce(v_state -> 'players', '[]'::jsonb);
  v_already := exists (select 1 from jsonb_array_elements(v_players) p where p ->> 'id' = p_uid);

  if not v_already then
    select coalesce(max((p ->> 'seat')::int), -1) + 1 into v_next_seat
    from jsonb_array_elements(v_players) p;

    v_players := v_players || jsonb_build_array(jsonb_build_object(
      'id', p_uid,
      'name', p_name,
      'seat', v_next_seat,
      'stack', p_starting_stack,
      'bet', 0,
      'totalHandBet', 0,
      'status', 'active',
      'isHost', false
    ));

    v_state := jsonb_set(v_state, '{players}', v_players);
    v_state := jsonb_set(v_state, '{updatedAt}', to_jsonb(extract(epoch from now()) * 1000));

    update rooms set state = v_state, updated_at = now() where room_code = p_room_code;
  end if;

  return v_state;
end;
$$;

grant execute on function join_room(text, text, text, int) to authenticated, anon;
