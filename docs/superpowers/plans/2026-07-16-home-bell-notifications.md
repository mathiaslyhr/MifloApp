# Home Bell + Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Home's `?` with a bell opening a full-screen Notifications feed of friend requests and party invites.

**Architecture:** Two server-truth sources merged into one time-sorted feed. Friend requests already exist (`friend_requests` + `useRequestsStore`). Party invites get a new `party_invites` table written by `send-party-invite`, read by one RPC that joins `rooms` and `players` so "did I join?" and "can I still join?" come back in the same query. A local `lastReadAt` drives the bell's dot.

**Tech Stack:** React Native (bare, iPhone-only), Zustand, Supabase (Postgres RPC + edge functions), notifee, i18next (en + da), Jest.

Spec: `docs/superpowers/specs/2026-07-16-home-bell-notifications-design.md`

## Global Constraints

- **Copy:** never use `—` or ` - ` as punctuation in user-facing strings; rephrase.
- **i18n:** every user-facing string lands in BOTH `src/core/i18n/en.json` and `src/core/i18n/da.json`. No literal strings in components.
- **Colour:** never hardcode hex in a component. Use `useColors()` / `useThemedStyles()`. Colour means MEANING, not identity.
- **Press:** every tappable is `Button` or `PressableScale`, never a bare `Pressable`.
- **Motion:** RN `Animated` + native driver only. Reanimated is REJECTED.
- **Typography:** max user-facing size is the wordmark at 20; headings 17, body 16, small 14.
- **No new deps.** Everything needed is already installed.
- **Migrations are applied by the USER** in the Supabase SQL editor. Never assume one is live: probe it.
- **This is app code, not football data.** `npm run data:publish` ships only the dataset; none of this reaches users without an App Store build. Do NOT run `data:publish`. Do NOT build. Do NOT push.
- Commit messages end exactly with:
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## File Structure

| File | Responsibility |
| --- | --- |
| `supabase/migrations/0046_party_invites.sql` | CREATE the table + `my_party_invites()` RPC |
| `supabase/functions/send-party-invite/index.ts` | MODIFY: insert the invite row before pushing |
| `src/core/social/types.ts` | MODIFY: add `PartyInvite` |
| `src/core/rooms/roomService.ts` | MODIFY: add `fetchMyPartyInvites()` |
| `src/core/notifications/notificationsStore.ts` | CREATE: merge + sort + unread |
| `src/core/notifications/__tests__/notificationsStore.test.ts` | CREATE: the merge/sort/unread rules |
| `src/screens/notifications/NotificationRow.tsx` | CREATE: one row, two variants |
| `src/screens/NotificationsScreen.tsx` | CREATE: the feed |
| `src/core/navigation/types.ts` + `RootNavigator.tsx` | MODIFY: the `Notifications` route |
| `src/screens/tabs/HomeTab.tsx` | MODIFY: bell replaces `?`; drop `HowToPlayModal` |
| `src/screens/tabs/ProfileTab.tsx` | MODIFY: drop `RequestsSection` |
| `src/screens/TabsScreen.tsx` | MODIFY: drop the profile badge |
| `src/core/i18n/en.json`, `da.json` | MODIFY: `notifications.*`; drop `home.help*` |

---

### Task 1: Migration 0046 — the table and the RPC

**Files:**
- Create: `supabase/migrations/0046_party_invites.sql`

**Interfaces:**
- Produces: RPC `my_party_invites(p_limit int default 30)` returning `jsonb` — an array of
  `{id, created_at, from_user_id, display_name, avatar_path, code, joined, joinable}`.

- [ ] **Step 1: Write the migration**

Read `supabase/migrations/0045_leaderboard_active_only.sql` first — match its house style: a header comment explaining WHY, `security definer`, `set search_path = public`, and an explicit `revoke ... from public, anon` + `grant ... to authenticated`.

Create `supabase/migrations/0046_party_invites.sql`:

```sql
-- 0046: a party invite leaves a trace.
--
-- Until now an invite existed ONLY as an APNs push. Dismiss the banner and it
-- was gone: no in-app record, nothing to come back to. That is the whole reason
-- the bell exists, so the row is written even when the push fails — a log that
-- depends on push delivery is not a log.
--
-- Read model: the caller's invites, joined to the host's profile for a name, to
-- rooms for status, and to players for whether the caller actually turned up.
-- `joinable` reuses join_room's own condition (status = 'lobby'), so the feed can
-- never offer a Join that join_room would reject. Nothing here guesses.

create table if not exists public.party_invites (
  id           uuid primary key default gen_random_uuid(),
  from_user_id uuid not null references auth.users(id) on delete cascade,
  to_user_id   uuid not null references auth.users(id) on delete cascade,
  room_id      uuid not null references public.rooms(id) on delete cascade,
  created_at   timestamptz not null default now()
);

-- The only read pattern: my invites, newest first.
create index if not exists party_invites_to_user_idx
  on public.party_invites (to_user_id, created_at desc);

alter table public.party_invites enable row level security;

-- Recipients read their own. Nobody writes from the client: the edge function
-- inserts with the service key, exactly like the push it sends.
drop policy if exists party_invites_select_own on public.party_invites;
create policy party_invites_select_own on public.party_invites
  for select using (auth.uid() = to_user_id);

create or replace function public.my_party_invites(p_limit int default 30)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_limit int  := least(greatest(coalesce(p_limit, 30), 1), 50);
  v_rows  jsonb;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  -- The log is a log, not an archive. Swept on read so there is no cron to own.
  delete from public.party_invites
   where to_user_id = v_uid and created_at < now() - interval '7 days';

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', i.id,
        'created_at', i.created_at,
        'from_user_id', i.from_user_id,
        'display_name', p.display_name,
        'avatar_path', p.avatar_path,
        'code', r.code,
        'joined', pl.user_id is not null,
        -- join_room accepts a code only `where status = 'lobby'`; matching that
        -- exactly is what stops the feed offering a join that would bounce.
        'joinable', r.status = 'lobby' and pl.user_id is null
      )
      order by i.created_at desc
    ),
    '[]'::jsonb
  )
  into v_rows
  from (
    select * from public.party_invites
     where to_user_id = v_uid
     order by created_at desc
     limit v_limit
  ) i
  -- INNER on rooms: an invite whose room is gone is not an invite any more.
  join public.rooms r on r.id = i.room_id
  -- LEFT on the host: a deleted account costs the row its name, not its place.
  left join public.profiles p on p.user_id = i.from_user_id
  left join public.players pl on pl.room_id = i.room_id and pl.user_id = v_uid;

  return v_rows;
end;
$$;

revoke execute on function public.my_party_invites(int) from public, anon;
grant execute on function public.my_party_invites(int) to authenticated;
```

- [ ] **Step 2: Verify the columns this leans on actually exist**

The RPC assumes `players(room_id, user_id)` and `rooms(id, code, status)`. Confirm before handing the SQL over:

Run: `grep -n -A12 "create table if not exists public.players" supabase/migrations/0001_rooms.sql`
Expected: a `room_id` and a `user_id` column.

Run: `grep -n -A10 "create table if not exists public.rooms" supabase/migrations/0001_rooms.sql`
Expected: `id`, `code`, `status`.

If either differs, FIX THE SQL to match the real schema before continuing.

- [ ] **Step 3: Hand the migration to the user**

You cannot apply it. Print the path and ask the user to run it in the Supabase SQL editor, then wait for confirmation:

> "0046 is ready at `supabase/migrations/0046_party_invites.sql`. Please run it in the Supabase SQL editor and tell me when it's applied — the next step probes it against prod."

- [ ] **Step 4: Probe the RPC against prod**

`PGRST202` fires on wrong ARG NAMES too, so probe with the app's exact arg name (`p_limit`), not a guess. Create `probe-invites.mjs` **in the repo root** (module resolution needs it there), run it, then delete it:

```js
import {createClient} from '@supabase/supabase-js';
import {readFileSync} from 'node:fs';
const src = readFileSync('src/core/config.ts', 'utf8');
const url = /SUPABASE_URL: string = '([^']+)'/.exec(src)[1];
const key = /SUPABASE_ANON_KEY: string =\s*'([^']+)'/s.exec(src)[1];
const c = createClient(url, key, {auth: {persistSession: false}});
// Probe hygiene: anonymous session ONLY. Never ensure_profile, never a profile row.
const {error: se} = await c.auth.signInAnonymously();
if (se) { console.error('signin failed:', se.message); process.exit(1); }
const {data, error} = await c.rpc('my_party_invites', {p_limit: 30});
console.log(error ? `RPC ERROR: ${error.code} ${error.message}` : `OK, rows: ${JSON.stringify(data)}`);
```

Run: `cp probe-invites.mjs . 2>/dev/null; node probe-invites.mjs; rm -f probe-invites.mjs`
Expected: `OK, rows: []` (a fresh anon user has no invites).
If you see `PGRST202`, the function isn't applied or the arg name is wrong. Do not continue until this returns `OK`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0046_party_invites.sql
git commit -m "$(cat <<'EOF'
feat(db): party invites leave a trace

An invite existed only as an APNs push: dismiss the banner and it was
gone, with no in-app record. my_party_invites joins rooms and players so
"did I join?" and "can I still join?" come back in one query, and
`joinable` reuses join_room's own status = 'lobby' condition so the feed
can never offer a join that would bounce.

Swept on read at 7 days: a log, not an archive.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: The edge function writes the row

**Files:**
- Modify: `supabase/functions/send-party-invite/index.ts`

**Interfaces:**
- Consumes: `party_invites` from Task 1.
- Produces: nothing new for the client.

- [ ] **Step 1: Read the function**

Run: `sed -n '80,180p' supabase/functions/send-party-invite/index.ts`

Note what it already has at the point the push is built: `callerId`, `friendUserId`, `code`, `admin` (a service-key client), and `hostName`. It does NOT have `room_id` — you must resolve it from `code`.

- [ ] **Step 2: Insert the row before sending the push**

Immediately BEFORE the `const payload = {` line, add:

```ts
  // The invite's in-app record. Written before the push and independently of
  // it: a log that only exists when a push lands is not a log, and "no token"
  // is exactly the case the bell is for.
  const {data: roomRow} = await admin
    .from('rooms')
    .select('id')
    .eq('code', code)
    .maybeSingle();
  if (roomRow) {
    const {error: logError} = await admin.from('party_invites').insert({
      from_user_id: callerId,
      to_user_id: friendUserId,
      room_id: roomRow.id,
    });
    // Never fail an invite because logging it failed — that would be a worse
    // bug than the one this fixes.
    if (logError) {
      console.error('party_invites insert failed', logError.message);
    }
  }
```

**Placement matters:** it must sit AFTER the `tokenRow` lookup's early `return` for `no_token`? **No — deliberately before it.** Move this block ABOVE the `if (!tokenRow) { return json(200, {ok: false, reason: 'no_token'}); }` guard, so a friend with notifications off still gets the in-app invite. That is the whole point.

- [ ] **Step 3: Typecheck the function**

Run: `npx tsc --noEmit -p supabase/functions/send-party-invite 2>/dev/null || echo "no tsconfig there — skip, Deno function"`
Expected: no errors, or the skip message (these run on Deno, not the app's tsc).

- [ ] **Step 4: Tell the user it needs deploying**

The function deploys separately from the app. Print:

> "`send-party-invite` now writes the invite row. It needs redeploying (`supabase functions deploy send-party-invite`) before invites appear in the bell. Until then the feed will simply show no invites, which is the intended degradation."

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/send-party-invite/index.ts
git commit -m "$(cat <<'EOF'
feat(invites): record the invite, not just the push

Written before the token lookup on purpose: a friend with notifications
off still gets the in-app invite, which is precisely the case the bell
exists for. A failed insert logs and lets the push go — failing an invite
because logging it failed would be worse than the bug being fixed.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Client types + the RPC wrapper

**Files:**
- Modify: `src/core/social/types.ts`
- Modify: `src/core/rooms/roomService.ts`

**Interfaces:**
- Consumes: `my_party_invites` from Task 1.
- Produces:
  - `type PartyInvite = {id: string; createdAt: string; profile: {userId: string; displayName: string; avatarPath: string | null}; code: string; joined: boolean; joinable: boolean}`
  - `fetchMyPartyInvites(): Promise<PartyInvite[]>`

- [ ] **Step 1: Add the type**

In `src/core/social/types.ts`, directly after the `FriendRequests` type, add:

```ts
/**
 * One party invite, as the bell reads it. `joined` and `joinable` are derived
 * server-side (see 0046) rather than inferred here: `joinable` mirrors
 * join_room's own `status = 'lobby'` condition, so a Join button can never
 * offer what the RPC would reject.
 */
export type PartyInvite = {
  id: string;
  /** Server timestamp (ISO) — newest first. */
  createdAt: string;
  /** The host. `displayName` falls back when their account is gone. */
  profile: {
    userId: string;
    displayName: string;
    avatarPath: string | null;
  };
  /** The room code, for the Join tap. */
  code: string;
  joined: boolean;
  joinable: boolean;
};
```

- [ ] **Step 2: Write the failing test for the wrapper's mapping**

Create `src/core/rooms/__tests__/partyInvites.test.ts`:

```ts
/**
 * @format
 */
import {mapPartyInvite} from '../roomService';

describe('mapPartyInvite', () => {
  const row = {
    id: 'i1',
    created_at: '2026-07-16T10:00:00Z',
    from_user_id: 'u1',
    display_name: 'Anna',
    avatar_path: 'a/b.jpg',
    code: 'ABC123',
    joined: false,
    joinable: true,
  };

  it('maps snake_case rows to the client shape', () => {
    expect(mapPartyInvite(row)).toEqual({
      id: 'i1',
      createdAt: '2026-07-16T10:00:00Z',
      profile: {userId: 'u1', displayName: 'Anna', avatarPath: 'a/b.jpg'},
      code: 'ABC123',
      joined: false,
      joinable: true,
    });
  });

  it('names a deleted host rather than showing an empty row', () => {
    // 0046 LEFT JOINs profiles: a deleted account costs the row its name, not
    // its place — the same rule rh_match_history uses for a gone opponent.
    expect(mapPartyInvite({...row, display_name: null}).profile.displayName).toBe(
      'Someone',
    );
  });

  it('never claims joinable when already joined', () => {
    expect(mapPartyInvite({...row, joined: true, joinable: true}).joinable).toBe(
      false,
    );
  });
});
```

- [ ] **Step 3: Run it and watch it fail**

Run: `npx jest src/core/rooms/__tests__/partyInvites.test.ts`
Expected: FAIL — `mapPartyInvite is not a function`.

- [ ] **Step 4: Implement**

In `src/core/rooms/roomService.ts`, beside the other RPC wrappers (near `fetchRoom`), add:

```ts
/**
 * One `my_party_invites` row → the client shape. Exported for its test.
 *
 * `joined` wins over `joinable`: the RPC already excludes it, but the two must
 * never disagree in the UI, and a stale row must not offer to re-join a room
 * you are already in.
 */
export function mapPartyInvite(row: any): PartyInvite {
  const joined = row.joined === true;
  return {
    id: String(row.id),
    createdAt: String(row.created_at),
    profile: {
      userId: String(row.from_user_id),
      displayName: row.display_name ?? 'Someone',
      avatarPath: row.avatar_path ?? null,
    },
    code: String(row.code),
    joined,
    joinable: !joined && row.joinable === true,
  };
}

/**
 * The caller's party invites, newest first. Empty (never throws) when the
 * backend isn't configured or 0046 isn't applied yet — the bell degrades to
 * "no invites" rather than an error screen.
 */
export async function fetchMyPartyInvites(): Promise<PartyInvite[]> {
  const client = await requireClient();
  const {data, error} = await client.rpc('my_party_invites', {p_limit: 30});
  if (error) {
    throw error;
  }
  return (Array.isArray(data) ? data : []).map(mapPartyInvite);
}
```

Add `PartyInvite` to the file's existing import from `../social/types`. If `roomService.ts` doesn't already import from there, add:
`import type {PartyInvite} from '../social/types';`

- [ ] **Step 5: Run the test**

Run: `npx jest src/core/rooms/__tests__/partyInvites.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 6: Commit**

```bash
git add src/core/social/types.ts src/core/rooms/roomService.ts src/core/rooms/__tests__/partyInvites.test.ts
git commit -m "$(cat <<'EOF'
feat(invites): read my_party_invites into a client shape

joined wins over joinable so the two can never disagree in the UI, and a
deleted host costs the row its name rather than its place.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: The store — merge, sort, unread

**Files:**
- Create: `src/core/notifications/notificationsStore.ts`
- Create: `src/core/notifications/__tests__/notificationsStore.test.ts`

**Interfaces:**
- Consumes: `fetchMyPartyInvites()` (Task 3), `useRequestsStore` + `FriendRequest`.
- Produces:
  - `type NotificationItem = {kind: 'friend-request'; at: string; request: FriendRequest} | {kind: 'invite'; at: string; invite: PartyInvite}`
  - `mergeFeed(requests: FriendRequest[], invites: PartyInvite[]): NotificationItem[]`
  - `unreadCount(items: NotificationItem[], lastReadAt: string | null): number`
  - `useNotificationsStore` with `{invites, invitesError, lastReadAt, setInvites, markAllRead}`
  - `refreshInvites(): Promise<void>`, `startNotificationsRefresh(): void`

- [ ] **Step 1: Write the failing tests**

Create `src/core/notifications/__tests__/notificationsStore.test.ts`:

```ts
/**
 * @format
 */
import {mergeFeed, unreadCount} from '../notificationsStore';
import type {FriendRequest, PartyInvite} from '../../social/types';

const req = (name: string, at: string): FriendRequest => ({
  profile: {
    userId: `u-${name}`,
    displayName: name,
    friendCode: 'AAA111',
    lastSeenAt: at,
    avatarPath: null,
    favoritePlayerId: null,
    favoriteClubId: null,
    favoriteNation: null,
  },
  createdAt: at,
});

const inv = (name: string, at: string): PartyInvite => ({
  id: `i-${name}`,
  createdAt: at,
  profile: {userId: `u-${name}`, displayName: name, avatarPath: null},
  code: 'ABC123',
  joined: false,
  joinable: true,
});

describe('mergeFeed', () => {
  it('interleaves both sources newest first', () => {
    const items = mergeFeed(
      [req('Anna', '2026-07-16T09:00:00Z')],
      [inv('Lars', '2026-07-16T11:00:00Z'), inv('Sofie', '2026-07-16T08:00:00Z')],
    );
    expect(items.map(i => i.at)).toEqual([
      '2026-07-16T11:00:00Z',
      '2026-07-16T09:00:00Z',
      '2026-07-16T08:00:00Z',
    ]);
    expect(items.map(i => i.kind)).toEqual(['invite', 'friend-request', 'invite']);
  });

  it('is empty when both sources are', () => {
    expect(mergeFeed([], [])).toEqual([]);
  });

  it('survives one source being empty', () => {
    expect(mergeFeed([req('Anna', '2026-07-16T09:00:00Z')], [])).toHaveLength(1);
    expect(mergeFeed([], [inv('Lars', '2026-07-16T09:00:00Z')])).toHaveLength(1);
  });
});

describe('unreadCount', () => {
  const items = mergeFeed(
    [req('Anna', '2026-07-16T09:00:00Z')],
    [inv('Lars', '2026-07-16T11:00:00Z')],
  );

  it('counts everything when nothing has ever been read', () => {
    expect(unreadCount(items, null)).toBe(2);
  });

  it('counts only what is newer than the last read', () => {
    expect(unreadCount(items, '2026-07-16T10:00:00Z')).toBe(1);
  });

  it('counts nothing once read past the newest', () => {
    expect(unreadCount(items, '2026-07-16T12:00:00Z')).toBe(0);
  });

  it('treats an item exactly at lastReadAt as read', () => {
    // Ties go to read: reopening the screen must not resurrect a dot.
    expect(unreadCount(items, '2026-07-16T11:00:00Z')).toBe(0);
  });
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `npx jest src/core/notifications/__tests__/notificationsStore.test.ts`
Expected: FAIL — cannot find module `../notificationsStore`.

- [ ] **Step 3: Implement the store**

Create `src/core/notifications/notificationsStore.ts`:

```ts
/**
 * The bell's feed: friend requests and party invites, merged and time-sorted.
 *
 * Both sources are server truth, so the feed is either right or absent —
 * nothing here infers. Daily nudges are deliberately NOT here: they're
 * receipts you've already seen, and a TIMESTAMP trigger fires with no code
 * running, so a log could only guess (see the design doc).
 *
 * `invites === null` means "not loaded yet", the same convention requestsStore
 * uses, so the bell's dot stays off rather than flickering on stale truth.
 */
import {AppState} from 'react-native';
import {create} from 'zustand';
import {isBackendConfigured} from '../config';
import {fetchMyPartyInvites} from '../rooms/roomService';
import {getCachedProfile} from '../social/socialService';
import type {FriendRequest, PartyInvite} from '../social/types';

export type NotificationItem =
  | {kind: 'friend-request'; at: string; request: FriendRequest}
  | {kind: 'invite'; at: string; invite: PartyInvite};

/** Both sources into one list, newest first. Pure — the screen's whole model. */
export function mergeFeed(
  requests: readonly FriendRequest[],
  invites: readonly PartyInvite[],
): NotificationItem[] {
  const items: NotificationItem[] = [
    ...requests.map(request => ({
      kind: 'friend-request' as const,
      at: request.createdAt,
      request,
    })),
    ...invites.map(invite => ({
      kind: 'invite' as const,
      at: invite.createdAt,
      invite,
    })),
  ];
  return items.sort((a, b) => b.at.localeCompare(a.at));
}

/**
 * How many items are newer than the last read. A tie counts as READ: opening
 * the screen stamps `now`, and an item stamped the same instant must not
 * resurrect the dot.
 */
export function unreadCount(
  items: readonly NotificationItem[],
  lastReadAt: string | null,
): number {
  if (!lastReadAt) {
    return items.length;
  }
  return items.filter(i => i.at.localeCompare(lastReadAt) > 0).length;
}

type NotificationsState = {
  invites: PartyInvite[] | null;
  /** True when the last fetch failed — the feed shows a retry row, not a lie. */
  invitesError: boolean;
  lastReadAt: string | null;
  setInvites: (invites: PartyInvite[] | null, error?: boolean) => void;
  markAllRead: () => void;
};

export const useNotificationsStore = create<NotificationsState>(set => ({
  invites: null,
  invitesError: false,
  lastReadAt: null,
  setInvites: (invites, error = false) => set({invites, invitesError: error}),
  markAllRead: () => set({lastReadAt: new Date().toISOString()}),
}));

/**
 * Fetch invites into the store. A no-op before the device opts into Friends,
 * and never throws: an unapplied 0046 or a dropped connection must leave the
 * bell showing friend requests, not an error screen.
 */
export async function refreshInvites(): Promise<void> {
  if (!isBackendConfigured) {
    return;
  }
  try {
    if (!(await getCachedProfile())) {
      useNotificationsStore.getState().setInvites([]);
      return;
    }
    useNotificationsStore.getState().setInvites(await fetchMyPartyInvites());
  } catch {
    // Keep whatever we had; flag it so the feed can offer a retry.
    useNotificationsStore.getState().setInvites(null, true);
  }
}

let watching = false;

/**
 * App-lifetime refresh: once now, then on every foreground — an invite may
 * have arrived while the app slept and its push been dismissed, which is the
 * exact case this feed exists for. Mirrors startRequestsRefresh.
 */
export function startNotificationsRefresh(): void {
  if (watching || !isBackendConfigured) {
    return;
  }
  watching = true;
  refreshInvites();
  AppState.addEventListener('change', state => {
    if (state === 'active') {
      refreshInvites();
    }
  });
}
```

- [ ] **Step 4: Run the tests**

Run: `npx jest src/core/notifications/__tests__/notificationsStore.test.ts`
Expected: PASS, 7 tests.

If `SocialProfile` has different fields than the test's `req()` helper assumes, fix the HELPER to match `src/core/social/types.ts` — not the store.

- [ ] **Step 5: Start it from App.tsx**

In `App.tsx`, find `startRequestsRefresh();` and add directly after it:

```ts
    // The bell's other half: invites that arrived while we slept.
    startNotificationsRefresh();
```

Add to the imports:
```ts
import {startNotificationsRefresh} from './src/core/notifications/notificationsStore';
```

- [ ] **Step 6: Typecheck + commit**

Run: `npx tsc --noEmit`
Expected: clean.

```bash
git add src/core/notifications/notificationsStore.ts src/core/notifications/__tests__/notificationsStore.test.ts App.tsx
git commit -m "$(cat <<'EOF'
feat(notifications): merge requests and invites into one feed

Both sources are server truth, so the feed is either right or absent. A
failed invite fetch flags itself rather than emptying the bell: one source
blinking must not blank the screen.

Unread is a per-device lastReadAt, and a tie counts as read so reopening
the screen can't resurrect the dot.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: The row

**Files:**
- Create: `src/screens/notifications/NotificationRow.tsx`
- Modify: `src/core/i18n/en.json`, `src/core/i18n/da.json`

**Interfaces:**
- Consumes: `NotificationItem` (Task 4).
- Produces: `<NotificationRow item={NotificationItem} onJoin={(code: string) => void} onAfterAction={() => void} />`

- [ ] **Step 1: Read the pattern you're reusing**

Run: `sed -n '1,120p' src/screens/social/RequestsSection.tsx`

Reuse its accept/decline logic verbatim — `acceptFriendRequest`, `declineFriendRequest`, `sendFriendPush`, the `busyId` guard, the toasts. Do NOT invent a second way to accept a request.

Run: `grep -n -A18 "export function formatLastActive" src/screens/social/PersonCard.tsx`
Run: `grep -n -A14 "export function lastActiveParts" src/core/social/presence.ts`

The app already says "2m"/"3h"/"Yesterday" and the bell must not invent a second dialect. **Decide here, before Step 4:**

- If `formatLastActive` takes a `Presence` you can build from the item's `at`, USE IT and delete the `relativeTime` helper from the Step 4 code.
- If it's welded to presence semantics ("active X ago" ≠ "sent X ago"), keep the `relativeTime` helper in Step 4 — but note it deliberately reuses the SAME i18n keys (`profile.agoMinutes/agoHours/agoDays`), so the two can never drift into different words.

Whichever you pick, only one relative-time implementation may exist in the row.

- [ ] **Step 2: Add the copy (en)**

In `src/core/i18n/en.json`, add a `notifications` block beside the other top-level blocks:

```json
  "notifications": {
    "title": "Notifications",
    "empty": "Nothing new. When a friend invites you to a match or asks to be friends, it lands here.",
    "retry": "Couldn't load invites. Tap to try again.",
    "friendRequest": "{{name}} wants to be friends",
    "invited": "{{name}} invited you to a match",
    "joined": "You joined",
    "didNotJoin": "You didn't join",
    "join": "Join",
    "a11yBell": "Notifications",
    "a11yBellUnread": "Notifications, {{count}} new"
  },
```

- [ ] **Step 3: Add the copy (da)**

In `src/core/i18n/da.json`, the same block. Note the copy rule: no `—`, no ` - `.

```json
  "notifications": {
    "title": "Notifikationer",
    "empty": "Intet nyt. Når en ven inviterer dig til en kamp eller vil være venner, lander det her.",
    "retry": "Kunne ikke hente invitationer. Tryk for at prøve igen.",
    "friendRequest": "{{name}} vil være venner",
    "invited": "{{name}} inviterede dig til en kamp",
    "joined": "Du deltog",
    "didNotJoin": "Du deltog ikke",
    "join": "Deltag",
    "a11yBell": "Notifikationer",
    "a11yBellUnread": "Notifikationer, {{count}} nye"
  },
```

- [ ] **Step 4: Write the row**

Create `src/screens/notifications/NotificationRow.tsx`:

```tsx
/**
 * One row of the bell's feed.
 *
 * Two variants, one shape: an avatar, a sentence, a relative time, and at most
 * one action. An invite row is a LOG — it says what happened ("You joined") and
 * only offers Join while the room is still open, which the server decides, not
 * this component.
 */
import React, {useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import {Avatar, Button, PressableScale, Text, initialsFor, toast} from '../../core/ui';
import {spacing, useThemedStyles, type Palette} from '../../theme';
import {isNetworkError} from '../../core/rooms/roomService';
import {refreshFriendRequests} from '../../core/social/requestsStore';
import {
  acceptFriendRequest,
  avatarUrlFor,
  declineFriendRequest,
  sendFriendPush,
} from '../../core/social/socialService';
import type {NotificationItem} from '../../core/notifications/notificationsStore';

type Props = {
  item: NotificationItem;
  /** Tapping Join on a still-open invite. */
  onJoin: (code: string) => void;
  /** An accept/decline landed — the caller refetches. */
  onAfterAction: () => void;
};

export function NotificationRow({item, onJoin, onAfterAction}: Props) {
  const {t} = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const [busy, setBusy] = useState(false);

  const person =
    item.kind === 'friend-request' ? item.request.profile : item.invite.profile;
  const name = person.displayName;
  const when = relativeTime(item.at, t);

  async function handleAccept() {
    if (busy) {
      return;
    }
    setBusy(true);
    try {
      await acceptFriendRequest(person.userId);
      toast.success(t('social.friendAdded', {name}));
      sendFriendPush(person.userId, 'friend-accepted').catch(() => {});
      refreshFriendRequests();
      onAfterAction();
    } catch (e) {
      toast.error(isNetworkError(e) ? t('common.offline') : t('social.errorGeneric'));
    } finally {
      setBusy(false);
    }
  }

  async function handleDecline() {
    if (busy) {
      return;
    }
    setBusy(true);
    try {
      await declineFriendRequest(person.userId);
      refreshFriendRequests();
      onAfterAction();
    } catch (e) {
      toast.error(isNetworkError(e) ? t('common.offline') : t('social.errorGeneric'));
    } finally {
      setBusy(false);
    }
  }

  const body =
    item.kind === 'friend-request'
      ? t('notifications.friendRequest', {name})
      : t('notifications.invited', {name});

  return (
    <View style={styles.row}>
      <Avatar
        initials={initialsFor(name)}
        tone="soft"
        size={44}
        uri={avatarUrlFor(person.avatarPath)}
      />
      <View style={styles.body}>
        <Text variant="secondary" numberOfLines={2}>
          {body}
        </Text>
        <Text variant="caption" color="tertiary">
          {item.kind === 'invite' && !item.invite.joinable
            ? `${when} · ${
                item.invite.joined
                  ? t('notifications.joined')
                  : t('notifications.didNotJoin')
              }`
            : when}
        </Text>
      </View>
      {item.kind === 'friend-request' ? (
        <View style={styles.actions}>
          <Button size="sm" disabled={busy} onPress={handleAccept}>
            {t('social.accept')}
          </Button>
          <PressableScale
            onPress={handleDecline}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={t('social.decline')}>
            <Text variant="caption" color="tertiary">
              {t('social.decline')}
            </Text>
          </PressableScale>
        </View>
      ) : item.invite.joinable ? (
        <Button size="sm" onPress={() => onJoin(item.invite.code)}>
          {t('notifications.join')}
        </Button>
      ) : null}
    </View>
  );
}

/** "2m" / "3h" / "Yesterday", in the dialect the app already speaks. */
function relativeTime(at: string, t: (k: string, o?: object) => string): string {
  const mins = Math.max(0, Math.round((Date.now() - Date.parse(at)) / 60000));
  if (mins < 60) {
    return t('profile.agoMinutes', {count: mins});
  }
  if (mins < 60 * 24) {
    return t('profile.agoHours', {count: Math.round(mins / 60)});
  }
  return t('profile.agoDays', {count: Math.round(mins / (60 * 24))});
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.md,
    },
    body: {flex: 1, gap: 2},
    actions: {flexDirection: 'row', alignItems: 'center', gap: spacing.sm},
  });
```

**Before using them, VERIFY these exist** — if a name differs, use the real one:

Run: `grep -rn "accept\|decline\|errorGeneric\|offline" src/core/i18n/en.json | grep -iE "social|common" | head`
Run: `grep -n "size=\"sm\"\|size?:" src/core/ui/Button.tsx | head -3`
Run: `grep -n "agoMinutes\|agoHours\|agoDays" src/core/i18n/en.json`

If `Button` has no `sm` size or `Text` has no `caption` variant, match what the codebase actually offers.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean. Fix any signature mismatch against the REAL components.

- [ ] **Step 6: Commit**

```bash
git add src/screens/notifications/NotificationRow.tsx src/core/i18n/en.json src/core/i18n/da.json
git commit -m "$(cat <<'EOF'
feat(notifications): one row, two variants

An invite row is a log: it says what happened, and only offers Join while
the server still says the room is open. Accept/decline reuse the existing
calls rather than inventing a second way to answer a request.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: The screen and its route

**Files:**
- Create: `src/screens/NotificationsScreen.tsx`
- Modify: `src/core/navigation/types.ts`
- Modify: `src/core/navigation/RootNavigator.tsx`

**Interfaces:**
- Consumes: `NotificationRow` (Task 5), the store (Task 4).
- Produces: the `Notifications` route, `navigation.navigate('Notifications')`.

- [ ] **Step 1: Read a pushed screen to copy its chrome**

Run: `sed -n '1,60p' src/screens/profile/FriendsListScreen.tsx`

Match its back-button/header pattern exactly. Do not invent new chrome.

- [ ] **Step 2: Add the route type**

In `src/core/navigation/types.ts`, beside `FriendsList`:

```ts
  Notifications: undefined;
```

- [ ] **Step 3: Register the screen**

In `src/core/navigation/RootNavigator.tsx`, add the import beside the other screens and, next to `<Stack.Screen name="FriendsList" .../>`:

```tsx
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
```

- [ ] **Step 4: Write the screen**

Create `src/screens/NotificationsScreen.tsx`:

```tsx
/**
 * The bell's feed: friend requests and party invites, newest first.
 *
 * Marks everything read on mount — opening the bell IS reading it, so the dot
 * clears without a second gesture. An empty bell is honest: nothing needs you.
 */
import React, {useEffect, useMemo, useState} from 'react';
import {RefreshControl, ScrollView, StyleSheet, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {PressableScale, Text} from '../core/ui';
import {screenPadding, spacing, useThemedStyles, type Palette} from '../theme';
import {
  mergeFeed,
  refreshInvites,
  useNotificationsStore,
} from '../core/notifications/notificationsStore';
import {refreshFriendRequests, useRequestsStore} from '../core/social/requestsStore';
import {NotificationRow} from './notifications/NotificationRow';
import type {RootStackParamList} from '../core/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Notifications'>;

export function NotificationsScreen({navigation}: Props) {
  const {t} = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const requests = useRequestsStore(s => s.requests);
  const invites = useNotificationsStore(s => s.invites);
  const invitesError = useNotificationsStore(s => s.invitesError);
  const markAllRead = useNotificationsStore(s => s.markAllRead);
  const [refreshing, setRefreshing] = useState(false);

  // Opening the bell is reading it.
  useEffect(() => {
    refreshFriendRequests();
    refreshInvites();
    markAllRead();
  }, [markAllRead]);

  const items = useMemo(
    () => mergeFeed(requests?.incoming ?? [], invites ?? []),
    [requests, invites],
  );

  async function onRefresh() {
    setRefreshing(true);
    await Promise.all([refreshFriendRequests(), refreshInvites()]);
    setRefreshing(false);
    markAllRead();
  }

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }>
      <Text variant="title">{t('notifications.title')}</Text>

      {invitesError ? (
        <PressableScale
          onPress={onRefresh}
          accessibilityRole="button"
          accessibilityLabel={t('notifications.retry')}>
          <Text variant="secondary" color="tertiary" style={styles.retry}>
            {t('notifications.retry')}
          </Text>
        </PressableScale>
      ) : null}

      {items.length === 0 ? (
        <Text variant="secondary" color="secondary" style={styles.empty}>
          {t('notifications.empty')}
        </Text>
      ) : (
        <View>
          {items.map(item => (
            <NotificationRow
              key={`${item.kind}-${
                item.kind === 'invite' ? item.invite.id : item.request.profile.userId
              }`}
              item={item}
              onJoin={code => navigation.navigate('Join', {code})}
              onAfterAction={() => {
                refreshFriendRequests();
                refreshInvites();
              }}
            />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    flex: {flex: 1, backgroundColor: c.background},
    content: {padding: screenPadding, gap: spacing.md},
    empty: {paddingVertical: spacing.xl},
    retry: {paddingVertical: spacing.sm},
  });
```

**VERIFY the Join route's params before wiring it:**

Run: `grep -n "Join:" src/core/navigation/types.ts`
If `Join` takes `{code: string}`, the above is right. If it takes something else, match it.

The screen needs the app's standard back chrome. Check how `FriendsListScreen` renders its header/back button and MIRROR it — if it uses a shared page component, use that instead of a bare `ScrollView`.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/screens/NotificationsScreen.tsx src/core/navigation/types.ts src/core/navigation/RootNavigator.tsx
git commit -m "$(cat <<'EOF'
feat(notifications): the feed screen

Opening the bell is reading it, so the dot clears on mount without a
second gesture. A failed invite fetch offers a retry row instead of
blanking the list.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: The bell replaces the `?`

**Files:**
- Modify: `src/screens/tabs/HomeTab.tsx`
- Modify: `src/core/i18n/en.json`, `src/core/i18n/da.json`
- Modify: `src/screens/menu/HowToPlayScreen.tsx` (stale docstring)

**Interfaces:**
- Consumes: the `Notifications` route (Task 6), the store (Task 4).

- [ ] **Step 1: Swap the button**

In `src/screens/tabs/HomeTab.tsx`, replace the `?` `CircleButton` in `TabPage`'s `right` prop with a bell carrying the unread dot:

```tsx
      right={
        <View>
          <CircleButton
            size={30}
            accessibilityLabel={
              unread > 0
                ? t('notifications.a11yBellUnread', {count: unread})
                : t('notifications.a11yBell')
            }
            onPress={() => navigation.navigate('Notifications')}>
            <Bell size={15} color={colors.textSecondary} strokeWidth={2.25} />
          </CircleButton>
          {unread > 0 ? <View style={styles.bellDot} /> : null}
        </View>
      }>
```

Add above the `return`:

```tsx
  const requests = useRequestsStore(s => s.requests);
  const invites = useNotificationsStore(s => s.invites);
  const lastReadAt = useNotificationsStore(s => s.lastReadAt);
  // The bell's dot: anything the feed would show that's newer than the last
  // time this device opened it.
  const unread = unreadCount(
    mergeFeed(requests?.incoming ?? [], invites ?? []),
    lastReadAt,
  );
```

Imports:

```tsx
import {Bell} from 'lucide-react-native';
import {
  mergeFeed,
  unreadCount,
  useNotificationsStore,
} from '../../core/notifications/notificationsStore';
import {useRequestsStore} from '../../core/social/requestsStore';
```

And the dot style, mirroring `IslandTabBar`'s `badgeDot` exactly:

```tsx
  // "Something new" marker, same recipe as the tab bar's.
  bellDot: {
    position: 'absolute',
    top: -1,
    right: -1,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: c.primary,
    borderWidth: 1.5,
    borderColor: c.background,
  },
```

- [ ] **Step 2: Remove the help modal**

Delete from `HomeTab.tsx`: the `showHelp` state, the `<HowToPlayModal .../>` block at the bottom, and the `HowToPlayModal` import **if unused elsewhere in this file**.

Do NOT delete `src/core/ui/HowToPlayModal.tsx` — `PlayTab` still uses it.

Run: `grep -rn "HowToPlayModal" src/ | grep -v "core/ui/HowToPlayModal.tsx"`
Expected: only `PlayTab.tsx` remains.

- [ ] **Step 3: Remove the dead copy**

Find the keys the deleted modal used (`home.help`, `home.helpTitle`, and its `lines` keys).

Run: `grep -rn "home\.help" src/ | grep -v i18n`
Expected: no hits (nothing references them any more).

Delete those keys from BOTH `en.json` and `da.json`. Leave any key still referenced.

- [ ] **Step 4: Fix the stale docstring**

`src/screens/menu/HowToPlayScreen.tsx` says "also reached from the Home '?' help button". That was already untrue and is now doubly so. Change to:

```tsx
/** How to play — the rules. The app's only how-to-play; Home's corner is the bell. */
```

- [ ] **Step 5: Typecheck + lint**

Run: `npx tsc --noEmit && npx eslint src/screens/tabs/HomeTab.tsx`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/screens/tabs/HomeTab.tsx src/core/i18n/en.json src/core/i18n/da.json src/screens/menu/HowToPlayScreen.tsx
git commit -m "$(cat <<'EOF'
feat(home): the corner holds a bell, not a question mark

The "?" opened orientation copy you read once. HowToPlayScreen already
carries fuller per-game rules and becomes the only how-to-play, so the
corner now holds the thing worth checking often.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Requests move out of Profile

**Files:**
- Modify: `src/screens/tabs/ProfileTab.tsx`
- Modify: `src/screens/TabsScreen.tsx`
- Delete: `src/screens/social/RequestsSection.tsx` (only if nothing else imports it)

- [ ] **Step 1: Check what still uses it**

Run: `grep -rn "RequestsSection" src/`
Expected: only `ProfileTab.tsx` and the file itself. If anything else imports it, KEEP the file and only remove ProfileTab's usage.

- [ ] **Step 2: Remove from ProfileTab**

Delete the `<RequestsSection ... />` render, its import, and any `requests`-only state that becomes unused. Keep `refreshFriendRequests` calls if the tab still needs them for anything else — check before deleting.

Run: `grep -n "requests\|RequestsSection" src/screens/tabs/ProfileTab.tsx`
Use the output to remove only what's now dead. Update the file's docstring: it currently advertises "the pending-requests block" as what stays.

- [ ] **Step 3: Remove the tab badge**

In `src/screens/TabsScreen.tsx` remove `badge={{profile: hasRequests}}` (and the now-unused `hasRequests` / `requests` lines), leaving:

```tsx
        <IslandTabBar active={tab} onSelect={setTab} />
```

The bell's dot is now the single "you have something" signal. A dot pointing at a tab that no longer shows requests would be a dead end.

`IslandTabBar`'s `badge` prop stays — it's optional and still typed for future use.

- [ ] **Step 4: Delete the component if orphaned**

If Step 1 showed only `ProfileTab` used it:

```bash
git rm src/screens/social/RequestsSection.tsx
```

- [ ] **Step 5: Verify nothing dangles**

Run: `npx tsc --noEmit && npx jest src/core src/screens 2>&1 | tail -5`
Expected: clean; tests pass.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
refactor(profile): friend requests live in the bell now

Two places to accept the same request is two places to keep in sync. The
Profile tab's dot goes with it: a dot pointing at a tab that no longer
shows requests is a dead end.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: See it before believing it

**Files:** none (verification only)

The rule here is absolute: **screenshot your own UI before asking anyone to look at it.** tsc, jest and lint have all been green on a build with doubled padding and every string truncated.

- [ ] **Step 1: Route the Simulator to the screen**

Two temporary edits, both reverted in Step 4:

In `src/core/navigation/RootNavigator.tsx`:
```tsx
    <Stack.Navigator
      initialRouteName="Notifications"
      screenOptions={{headerShown: false, gestureEnabled: false}}>
```

In `App.tsx`, force the profile gate open:
```ts
      .then(() => alive && setGate('app'))
      .catch(() => alive && setGate('app'));
```

- [ ] **Step 2: Build and install**

Run:
```bash
cd ios && xcodebuild -workspace Miflo.xcworkspace -scheme Miflo -configuration Release \
  -destination 'generic/platform=iOS Simulator' -derivedDataPath build/sim \
  CODE_SIGNING_ALLOWED=NO build
```
Expected: `** BUILD SUCCEEDED **` (background it; a cold build is 5-10 min).

Then:
```bash
xcrun simctl install booted ios/build/sim/Build/Products/Release-iphonesimulator/Miflo.app
xcrun simctl launch booted com.mathiaslyhr.miflo
```

NEVER `npx react-native run-ios` — it spawns Metro, and the bundle stops working when Metro does.

- [ ] **Step 3: Look at it**

```bash
xcrun simctl io booted screenshot /tmp/notifications.png
```
Write to `/tmp`, NOT the scratchpad — simctl silently no-ops there. Then Read the png.

Check: the empty state reads well; the title isn't truncated; padding matches other screens; nothing overlaps the tab bar. You can look but NOT tap (no idb; AppleScript clicks fail with -25204).

- [ ] **Step 4: Revert both hacks**

```bash
git diff --stat
```
Expected: only `RootNavigator.tsx` and `App.tsx`, both revertible. Revert them, then:

Run: `grep -n "initialRouteName" src/core/navigation/RootNavigator.tsx`
Expected: no output.

- [ ] **Step 5: Report**

Post the screenshot's findings and the full suite:

Run: `npx jest 2>&1 | tail -5 && npx tsc --noEmit && npx eslint src/ 2>&1 | tail -3`
Expected: all green.

Do NOT build for the device, archive, or `data:publish` — the release train is the user's call and carries other work.

---

## What this plan does NOT verify

Be honest about the hole rather than discovering it later.

**The RPC's `joined`/`joinable` derivation is not unit-tested.** There is no test
database here, and `my_party_invites` can only be exercised against prod, where a
fresh anonymous probe has no invites and no rooms — so the probe in Task 1 proves
the function EXISTS and its arg name is right, not that its logic is correct.

Two things stand in for a test:

1. `joinable` is `r.status = 'lobby' and pl.user_id is null` — copied from
   `join_room`'s own `where code = upper(p_code) and status = 'lobby'`. The
   equivalence is by construction, and Task 3's `mapPartyInvite` test pins the
   client half (`joined` always beats `joinable`).
2. The first REAL invite between two devices is the actual test. When the release
   train runs a 2-device play test, send an invite and check the bell shows it,
   that joining flips the row to "You joined", and that a finished room stops
   offering Join.

If that check fails, suspect the `players`/`rooms` column names first — Task 1
Step 2 verifies them, and everything downstream assumes them.

## Notes for the implementer

- **0046 must be applied before this ships.** The client degrades to "no invites" if it isn't, but the feature is inert. Task 1 Step 3 hands it to the user; don't skip the probe.
- **The edge function deploys separately.** Until it's redeployed, no invite rows are written and the feed shows only friend requests. That's the intended degradation, not a bug to chase.
- **Don't add daily reminders.** They were considered and cut for cause; see the design doc's "Daily reminders are deliberately OUT".
