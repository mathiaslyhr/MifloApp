-- Miflo: no two players in the same party share a name.
--
-- Names are generated client-side and can collide (the curated pun list is
-- small). A joining player can't read the roster first (RLS blocks non-members),
-- so uniqueness is enforced server-side with a BEFORE INSERT trigger on players:
-- if the chosen name is already taken in that party, append " 2", " 3", …
--
-- Scope: INSERT only (the random name assigned on create/join). Manual renames
-- (rename_player, an UPDATE) are left as-is.

create or replace function public.dedupe_player_name()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_base text := btrim(coalesce(new.name, ''));
  v_name text;
  v_n int := 1;
begin
  if v_base = '' then
    v_base := 'Player';
  end if;

  v_name := v_base;
  while exists (
    select 1 from public.players
    where room_id = new.room_id
      and name = v_name
      and user_id <> new.user_id
  ) loop
    v_n := v_n + 1;
    v_name := v_base || ' ' || v_n;
  end loop;

  new.name := v_name;
  return new;
end;
$$;

drop trigger if exists players_dedupe_name on public.players;
create trigger players_dedupe_name
  before insert on public.players
  for each row execute function public.dedupe_player_name();
