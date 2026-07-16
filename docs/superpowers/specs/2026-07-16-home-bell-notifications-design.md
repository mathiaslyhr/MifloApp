# Home bell + notifications

2026-07-16

## The problem

Home's top-right corner is a `?` that opens `HowToPlayModal` — orientation copy
you read once and never again. Meanwhile the things you'd actually want to check
are scattered or invisible:

- **Friend requests** live in Profile (`RequestsSection`) and dot the Profile tab.
- **Party invites** exist ONLY as an APNs push. Dismiss the banner and the invite
  is gone — there is no in-app record of it at all.
- **Daily reminders** fire and vanish — but they are receipts, not actions, and
  are out of scope (see the decision below).

The corner should hold the thing you check often, not the thing you read once.

## What we're building

A bell in Home's header opening a full-screen `Notifications` feed: an activity
log, newest first, of friend requests and party invites — the two things that are
actionable and genuinely invisible today. Daily reminders are deliberately out;
see below.

`HowToPlayScreen` (Profile → menu → How to play) already carries fuller per-game
rules and becomes the only how-to-play. Home's `?` and `HowToPlayModal` usage go.

## Decisions, and why

### Invites are a LOG, not an inbox

The row records what happened — "Lars invited you · 2h ago · You joined" — rather
than presenting a live queue. It stays actionable in the one case that matters:
if the room is still in `lobby` and you never joined, the row offers **Join**. A
five-minute-old invite you missed is exactly the dead end a dismissed push
creates today.

"Did I join?" is not guesswork: you joined a room iff you have a `players` row
for it. The RPC reads that directly.

### The server is the truth for invites

A push-only record is only as good as push delivery. Notifications off, a dropped
push, or a reinstall and the invite silently never existed — the bell would sit
empty and lie. So `send-party-invite` writes a row, and **writes it even when the
push fails** (`no_token`). That is the entire point: the bell works when
notifications don't.

### Daily reminders are deliberately OUT

The bell earns its place by showing things you can ACT on that you'd otherwise
miss. A nudge is the opposite: you already saw it on the lock screen, and there
is nothing to do about it — the row would be a receipt.

It is also the only part that could be WRONG. A nudge is a
`createTriggerNotification` with a `TIMESTAMP` trigger scheduled up to 14 days
ahead; no code runs when it fires, and iOS gives notifee no reliable DELIVERED
event. A log could only infer "scheduled, not cancelled, time passed" — and would
claim reminders the OS had suppressed. A notifications screen that lies about
what it sent you is worse than one that stays quiet.

Requests and invites are read from the server: either true or absent.

Adding reminders later is a small, additive change, independent of this
plumbing. Doing it in the other order is not. If the bell is often empty, that is
honest — nothing needs you.

### Unread is per-device

A local `lastReadAt`. The bell dots when anything is newer; opening the screen
clears it. No server read-state — the bell is a per-device thing, and syncing it
would cost a table to solve a problem nobody has.

## Architecture

| Source | Truth | Read via |
| --- | --- | --- |
| Friend requests | `friend_requests` (exists) | `useRequestsStore` (exists) |
| Party invites | **new** `party_invites` | **new** `my_party_invites()` RPC |

### Migration 0046

`party_invites`: `id`, `from_user_id`, `to_user_id`, `room_id` (FK `rooms`),
`created_at`. RLS: only `to_user_id` reads. Index on `(to_user_id, created_at desc)`.

`my_party_invites(p_limit int default 30)` returns, for the caller, each invite
joined to:

- `profiles` → host `display_name`, `avatar_path`
- `rooms` → `status`, `code`
- `players` → whether the caller has a row for that room

and derives:

- `joined` = a `players` row exists for (room, caller)
- `joinable` = `rooms.status = 'lobby'` AND NOT `joined`

`joinable` uses exactly the condition `join_room` already enforces
(`where code = upper(p_code) and status = 'lobby'`), so the log can never offer a
Join that `join_room` would reject. `close_stale_room` (0019) already flips
abandoned rooms via the host heartbeat, so dead rooms fall out on their own.

Rows older than 7 days are deleted by the RPC on read — no cron, and the log
stays a log rather than an archive.

### Edge function

`send-party-invite` resolves `room_id` from the code it already has and inserts
the `party_invites` row **before** the APNs send, then pushes as today.

If the insert fails, **the push still goes** — log and continue. Failing an invite
because its logging failed would be a worse bug than the one this fixes.

### Client

- `src/core/notifications/notificationsStore.ts` — zustand, mirroring
  `requestsStore`'s shape. Merges the two sources into one `NotificationItem[]`
  sorted by time desc, and owns `lastReadAt` + `unreadCount`.
- `src/screens/NotificationsScreen.tsx` — the feed, empty state, pull to refresh.
- `src/screens/notifications/NotificationRow.tsx` — one row, two variants.
- `src/core/rooms/roomService.ts` — add `fetchMyPartyInvites()` beside the other
  RPC wrappers; the store never calls supabase directly.

`NotificationItem` is a discriminated union on `kind`:
`'friend-request' | 'invite'`, each with `at: string` for sorting. The union
exists so a third kind (reminders, activity) is an additive change.

## The rows

- **Friend request** — avatar, "{name} wants to be friends", relative time,
  `[Accept] [Decline]`. Reuses `RequestsSection`'s existing accept/decline calls.
- **Invite** — avatar, "{name} invited you to a match", relative time, then
  `[Join]` when `joinable`, else "You joined" / "You didn't join".

Relative time reuses `lastActiveParts`/`formatLastActive` from
`core/social/presence.ts` — the app already says "2m", "3h", "Yesterday" there,
and the bell must not invent a second dialect.

Rows follow the existing press-scale rule (`PressableScale`, never bare
`Pressable`). Avatars carry the presence dot recipe only if the row is a person —
`onRim` is already the shared helper.

## Removed

- Home's `?` `CircleButton` and its `HowToPlayModal` + `showHelp` state.
- `home.help`, `home.helpTitle` and the modal's line keys (en + da), if unused
  elsewhere.
- `RequestsSection` from `ProfileTab`, and `badge={{profile: hasRequests}}` from
  `TabsScreen` — the bell's dot becomes the single "you have something" signal.
- The stale docstring on `HowToPlayScreen` claiming Home's `?` reaches it.

`HowToPlayModal` itself STAYS — `PlayTab` still uses it.

## Error handling

- Invites RPC fails → the feed still renders friend requests, and invites show a
  quiet retry row. The bell must never be a blank screen because one source
  blinked. The same the other way round.
- No profile (pre-Friends opt-in) → both sources are empty by definition; the
  bell shows its empty state rather than an error.
- Backend not configured → all server sources no-op, as elsewhere.
- An invite whose room was deleted → the join returns no row; treat as not
  joinable, show "You didn't join".

## Testing

- `notificationsStore` merge + sort order + `unreadCount` against `lastReadAt`.
- `my_party_invites` derives `joined`/`joinable` correctly: joined room, open
  room not joined, finished room, deleted room.
- `my_party_invites` probed against prod with the app's EXACT arg names (PGRST202
  fires on wrong arg names too — see the release runbook).
- The screen: renders each row variant, an empty state, and `joinable` false
  hides Join.
- Verified on the Simulator by routing to `Notifications` — screenshot it, don't
  assume.

## Risks

- **0046 must be applied before the build ships**, or `my_party_invites` 404s on
  every open. The client must degrade to "no invites", not crash.
- The edge function is deployed separately from the app; an old function means no
  invite rows, which the feed must treat as "no invites yet", not an error.
- The bell will often be empty. That is intended: an empty bell means nothing
  needs you. Resist padding it with receipts.
