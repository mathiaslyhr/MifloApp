-- Miflo: party codes always mix letters and numbers.
--
-- gen_code already draws from an alphabet that includes digits (2-9, minus the
-- look-alikes 0/1/I/O), but a random 4-char draw is all-letters ~32% of the
-- time. This redefinition keeps looping until the code has at least one letter
-- AND at least one digit (and is unique), so every code reads as a clear mix.

create or replace function public.gen_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  candidate text;
  i int;
begin
  loop
    candidate := '';
    for i in 1..4 loop
      candidate := candidate ||
        substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    -- Require a mix (>=1 letter and >=1 digit) and uniqueness.
    exit when candidate ~ '[A-Z]'
          and candidate ~ '[0-9]'
          and not exists (select 1 from public.rooms where code = candidate);
  end loop;
  return candidate;
end;
$$;
