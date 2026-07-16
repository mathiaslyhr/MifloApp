# Home bell + notifications

2026-07-16

## The problem

Home's top-right corner is a `?` that opens `HowToPlayModal` — orientation copy
you read once and never again. Meanwhile the things you'd actually want to check
are scattered or invisible:

- **Friend requests** live in Profile (`RequestsSection`) and dot the Profile tab.
- **Party invites** exist ONLY as an APNs push. Dismiss the banner and the invite
  is gone — there is no in-app record of it at all.
- **Daily reminders** fire and vanish.

The corner should hold the thing you check often, not the thing you read once.

## What we're building

A bell in Home's header opening a full-screen `Notifications` feed: an activity
log, newest first, of friend requests, party invites and daily reminders.

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

### Reminders stay local — and are logged at SCHEDULE time, not fire time

Nudges are scheduled on-device (`scoutReminder.ts` / `habit.ts`) and have no
server row, so their history can only be local. Everything actionable is server
truth; only "we reminded you" is local.

The awkward part, which shapes the implementation: a nudge is a
`createTriggerNotification` with a `TIMESTAMP` trigger. **No code runs when it
fires.** iOS gives notifee no reliable background DELIVERED event, so there is
nothing to hook. Logging at fire time is not possible.

So the log records the nudge when it is SCHEDULED, storing `fireAt`, and:

- the feed shows an entry only once `fireAt <= now` — a nudge scheduled for
  tomorrow is not history yet;
- `syncNudges` cancels nudges when you've already played, and cancellation MUST
  remove the log entry too (`cancelTriggerNotifications` and the log stay in
  step), or the log claims a reminder that never fired;
- entries are only recorded when notification permission is granted —
  `scoutReminder` already checks `AuthorizationStatus`, so a user with
  notifications off gets an empty reminder log rather than a fictional one.

This is a proxy — "scheduled, not cancelled, and its time has passed" — not proof
of delivery. If the OS suppressed a nudge, the log would still show it. That is
the honest limit of what the platform allows, and it is the reason reminders are
non-actionable rows: they claim only that we meant to remind you.

### Unread is per-device

A local `lastReadAt`. The bell dots when anything is newer; opening the screen
clears it. No server read-state — the bell is a per-device thing, and syncing it
would cost a table to solve a problem nobody has.

## Architecture

| Source | Truth | Read via |
| --- | --- | --- |
| Friend requests | `friend_requests` (exists) | `useRequestsStore` (exists) |
| Party invites | **new** `party_invites` | **new** `my_party_invites()` RPC |
| Daily reminders | **local** AsyncStorage | new `reminderLog.ts` |

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

- `src/core/notifications/reminderLog.ts` — local log keyed by the nudge's own
  notification id, so it upserts exactly as `syncNudges` does. `record(id, title,
  fireAt)` at schedule time, `forget(ids)` alongside every
  `cancelTriggerNotifications` call. Reads return only `fireAt <= now`. Caps at
  30, drops >7 days.
- `src/core/notifications/notificationsStore.ts` — zustand, mirroring
  `requestsStore`'s shape. Merges the three sources into one `NotificationItem[]`
  sorted by time desc, and owns `lastReadAt` + `unreadCount`.
- `src/screens/NotificationsScreen.tsx` — the feed + empty state.
- `src/screens/notifications/NotificationRow.tsx` — one row, three variants.

`NotificationItem` is a discriminated union on `kind`:
`'friend-request' | 'invite' | 'reminder'`, each with `at: string` for sorting.

## The rows

- **Friend request** — avatar, "{name} wants to be friends", relative time,
  `[Accept] [Decline]`. Reuses `RequestsSection`'s existing accept/decline calls.
- **Invite** — avatar, "{name} invited you to a match", relative time, then
  `[Join]` when `joinable`, else "You joined" / "You didn't join".
- **Reminder** — game icon, the nudge's own copy, relative time, no action.

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

- RPC fails → the feed still renders friend requests + reminders; invites show a
  quiet retry row. The bell must never be a blank screen because one source blinked.
- No profile (pre-Friends opt-in) → requests and invites are empty by definition;
  reminders still show.
- Backend not configured → all server sources no-op, as elsewhere.
- An invite whose room was deleted → the join returns no row; treat as not
  joinable, show "You didn't join".

## Testing

- `notificationsStore` merge + sort order + `unreadCount` against `lastReadAt`.
- `reminderLog`: cap, 7-day drop, a future `fireAt` is NOT returned, and
  `forget()` on cancel removes the entry — the three ways the log could lie.
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
- Reminders are local: a reinstall starts an empty reminder log. Acceptable, and
  invisible to anyone who hasn't reinstalled.
