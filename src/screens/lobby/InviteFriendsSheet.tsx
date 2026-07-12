/**
 * Invite friends to the party — a modal sheet over the lobby listing the
 * host's Friends (same graph as the Friends tab) with a per-friend Invite
 * action that pushes a real APNs notification to their iPhone (see
 * supabase/functions/send-party-invite). Friends without a push token are
 * shown but marked unreachable; the share-sheet code link stays the fallback
 * for them and for everyone outside the app.
 *
 * Opening the sheet is also the moment this device asks for notification
 * permission (best-effort, never blocking): inviting is the strongest signal
 * the user wants to be invitable back.
 */
import React, {useEffect, useState} from 'react';
import {Modal, Pressable, ScrollView, StyleSheet, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import {Avatar, GlassTag, Skeleton, Text, toast} from '../../core/ui';
import {radii, spacing, useThemedStyles, type Palette} from '../../theme';
import {requestPushPermissionAndSync} from '../../core/notifications/pushInvites';
import {presenceFor} from '../../core/social/presence';
import {
  avatarUrlFor,
  fetchFriends,
  fetchReachableFriendIds,
  getCachedProfile,
  sendPartyInvite,
} from '../../core/social/socialService';
import type {SocialProfile} from '../../core/social/types';

type Props = {
  visible: boolean;
  /** The party code invites carry; null while the room is still loading. */
  code: string | null;
  onClose: () => void;
  /** Opens the existing share sheet (the code link) as the fallback path. */
  onShareFallback: () => void;
  /** Pre-marked as invited — the Friends-tab flow already sent theirs. */
  initialInvitedId?: string;
};

/** Re-inviting the same friend is blocked this long (spam guard). */
const COOLDOWN_MS = 60_000;

type Phase = 'loading' | 'noProfile' | 'error' | 'ready';

export function InviteFriendsSheet({
  visible,
  code,
  onClose,
  onShareFallback,
  initialInvitedId,
}: Props) {
  const {t} = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const [phase, setPhase] = useState<Phase>('loading');
  const [friends, setFriends] = useState<SocialProfile[]>([]);
  const [reachable, setReachable] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState<Set<string>>(new Set());
  const [sentAt, setSentAt] = useState<Map<string, number>>(new Map());
  // Cooldowns are time-based; a slow tick lets "Invited" relax back to
  // "Invite" without a per-row timer.
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!visible) {
      return;
    }
    let live = true;
    setPhase('loading');
    setSentAt(
      initialInvitedId ? new Map([[initialInvitedId, Date.now()]]) : new Map(),
    );
    (async () => {
      // Friends require a profile; without one there is nobody to invite.
      if (!(await getCachedProfile())) {
        if (live) {
          setPhase('noProfile');
        }
        return;
      }
      // Ask for notification permission so THIS phone becomes invitable too.
      // Sending needs the friends' tokens, not ours, so a "no" never blocks.
      await requestPushPermissionAndSync();
      try {
        const [list, reach] = await Promise.all([
          fetchFriends(),
          fetchReachableFriendIds(),
        ]);
        if (live) {
          setFriends(list);
          setReachable(reach);
          setPhase('ready');
        }
      } catch {
        if (live) {
          setPhase('error');
        }
      }
    })();
    return () => {
      live = false;
    };
  }, [visible, initialInvitedId]);

  useEffect(() => {
    if (!visible) {
      return;
    }
    const id = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(id);
  }, [visible]);

  async function invite(friend: SocialProfile) {
    const id = friend.userId;
    const sent = sentAt.get(id);
    if (!code || sending.has(id) || (sent && Date.now() - sent < COOLDOWN_MS)) {
      return;
    }
    setSending(prev => new Set(prev).add(id));
    try {
      const res = await sendPartyInvite(id, code);
      if (res.ok) {
        setSentAt(prev => new Map(prev).set(id, Date.now()));
        toast.success(t('invite.sentToast', {name: friend.displayName}));
      } else if (res.reason === 'no_token') {
        // The server just learned this token is dead — reflect it right away.
        setReachable(prev => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        toast.neutral(t('invite.unreachableToast', {name: friend.displayName}));
      } else if (res.reason === 'no_room') {
        toast.error(t('invite.errorRoom'));
      } else {
        toast.error(t('invite.errorSend'));
      }
    } catch {
      toast.error(t('invite.errorSend'));
    } finally {
      setSending(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  function renderRow(friend: SocialProfile) {
    const id = friend.userId;
    const online = presenceFor(friend.lastSeenAt, now).online;
    const isSending = sending.has(id);
    const sent = sentAt.get(id);
    const invited = !!sent && now - sent < COOLDOWN_MS;
    const initials = friend.displayName
      .split(/\s+/)
      .slice(0, 2)
      .map(w => w[0]?.toUpperCase() ?? '')
      .join('');
    return (
      <View key={id} style={styles.row}>
        <View>
          <Avatar initials={initials} tone="soft" uri={avatarUrlFor(friend.avatarPath)} />
          {online ? (
            <View
              style={styles.onlineDot}
              accessibilityLabel={t('social.a11yOnline')}
            />
          ) : null}
        </View>
        <Text variant="label" numberOfLines={1} style={styles.rowName}>
          {friend.displayName}
        </Text>
        {reachable.has(id) ? (
          <GlassTag
            size="sm"
            accent={invited}
            disabled={isSending || invited || !code}
            onPress={() => invite(friend)}
            accessibilityRole="button"
            accessibilityLabel={t('invite.a11yInvite', {
              name: friend.displayName,
            })}>
            <Text variant="caption" style={styles.tagText}>
              {isSending
                ? t('invite.sending')
                : invited
                ? t('invite.invited')
                : t('invite.invite')}
            </Text>
          </GlassTag>
        ) : (
          // No push token on their side (old build, notifications off) — the
          // code link is the only way to reach them.
          <Pressable onPress={onShareFallback} accessibilityRole="button">
            <Text variant="caption" color="tertiary">
              {t('invite.unreachable')}
            </Text>
          </Pressable>
        )}
      </View>
    );
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose}>
        {/* Card keeps taps off the scrim (no accidental dismiss). */}
        <Pressable style={styles.card}>
          <Text variant="label" align="center">
            {t('invite.title')}
          </Text>

          {phase === 'loading' ? (
            <View style={styles.skeletons}>
              <Skeleton height={44} />
              <Skeleton height={44} />
            </View>
          ) : phase === 'noProfile' ? (
            <Text variant="secondary" color="secondary" align="center">
              {t('invite.noProfile')}
            </Text>
          ) : phase === 'error' ? (
            <Text variant="secondary" color="secondary" align="center">
              {t('invite.errorLoad')}
            </Text>
          ) : friends.length === 0 ? (
            <Text variant="secondary" color="secondary" align="center">
              {t('invite.noFriends')}
            </Text>
          ) : (
            <ScrollView style={styles.listScroll} bounces={false}>
              <View style={styles.list}>{friends.map(renderRow)}</View>
            </ScrollView>
          )}

        </Pressable>
      </Pressable>
    </Modal>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
  // Same scrim/card recipe as NameSheet — the app's one floating-sheet look.
  scrim: {
    flex: 1,
    backgroundColor: c.scrim,
    justifyContent: 'flex-start',
    paddingTop: 150,
    paddingHorizontal: spacing.xl,
  },
  card: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 340,
    backgroundColor: c.surface,
    borderRadius: radii.card,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    shadowColor: c.shadowInk,
    shadowOpacity: 0.24,
    shadowOffset: {width: 0, height: 16},
    shadowRadius: 32,
    elevation: 12,
  },
  skeletons: {gap: spacing.sm},
  listScroll: {maxHeight: 320},
  list: {gap: spacing.md},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  rowName: {flex: 1},
  tagText: {color: c.ink},
  // Same presence disc as the Friends tab's cards.
  onlineDot: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: c.success,
    borderWidth: 2,
    borderColor: c.surface,
  },
  });
