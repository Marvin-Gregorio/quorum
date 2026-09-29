-- supabase/migrations/0009_voting_starts_at_lock.sql
--
-- I2: owner can push pages.voting_starts_at later even after voting has
-- already started, reopening the structural edit window mid-election
-- (positions/candidates insert and delete policies gate on
-- now() < pages.voting_starts_at). Forbid moving voting_starts_at to a
-- later value once voting has already started per the row's *current*
-- voting_starts_at. Before that point, moving it around freely (earlier or
-- later) stays allowed.

create function prevent_reopening_edit_window()
returns trigger
language plpgsql
as $$
begin
  if now() >= old.voting_starts_at and new.voting_starts_at > old.voting_starts_at then
    raise exception 'voting_starts_at cannot be moved later once voting has started';
  end if;
  return new;
end;
$$;

create trigger on_pages_voting_starts_at_update
  before update on pages
  for each row execute procedure prevent_reopening_edit_window();
