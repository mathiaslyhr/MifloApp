-- 0047: the bell hears things as they happen.
--
-- The dot was dead while the app was open. Both stores only refetch on launch
-- and on foreground (startRequestsRefresh, startNotificationsRefresh), and
-- neither fires when you're already looking at Home — so an invite or a request
-- sat on the server and Home said nothing until you happened to background the
-- app and come back. The old Profile-tab dot had the same hole; it was never
-- noticed because nobody watched for it.
--
-- The obvious patch was to refresh when the push ARRIVES, but notifee documents
-- EventType.DELIVERED for TRIGGER notifications and it does not fire for a
-- remote APNs push in the iOS foreground. Tried; the bell stayed dotless.
--
-- Polling was the other option and was rejected: my_party_invites (0046) sweeps
-- expired rows on read, so a 1s poll would mean one DELETE per second per user
-- to keep a badge fresh. Realtime is what this actually is — the server already
-- knows, so let it say so. Rooms (0001) and the ranked queue (0034) have worked
-- this way for a while; this is the same shape.
--
-- No new policy is needed. postgres_changes honours RLS, and both tables already
-- restrict SELECT to the people involved:
--   party_invites   → party_invites_select_own (0046): auth.uid() = to_user_id
--   friend_requests → friend_requests_select   (0024): auth.uid() in (requester, addressee)
-- So a subscriber can only ever be told about rows it could already read.

do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public'
      and tablename = 'party_invites'
  ) then
    alter publication supabase_realtime add table public.party_invites;
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public'
      and tablename = 'friend_requests'
  ) then
    alter publication supabase_realtime add table public.friend_requests;
  end if;
end $$;
