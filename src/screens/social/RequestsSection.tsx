/**
 * Pending incoming friend requests — one card per person with Accept and a
 * quiet round decline. The section only exists while something awaits an
 * answer, so the tab stays clean the rest of the time. Declining never
 * notifies the requester; accepting toasts here and pushes "X accepted your
 * friend request" to them (fire-and-forget, server re-verifies).
 */
import React, {useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import {X} from 'lucide-react-native';
import {Avatar, Button, CircleButton, Card, Text, toast} from '../../core/ui';
import {spacing, useColors} from '../../theme';
import {isNetworkError} from '../../core/rooms/roomService';
import {refreshFriendRequests} from '../../core/social/requestsStore';
import {
  acceptFriendRequest,
  avatarUrlFor,
  declineFriendRequest,
  sendFriendPush,
} from '../../core/social/socialService';
import type {FriendRequest} from '../../core/social/types';

type Props = {
  requests: FriendRequest[];
  /** Fired after an accept lands — the friends feed has a new card. */
  onAccepted: () => void;
};

export function RequestsSection({requests, onAccepted}: Props) {
  const {t} = useTranslation();
  const colors = useColors();
  const [busyId, setBusyId] = useState<string | null>(null);

  if (requests.length === 0) {
    return null;
  }

  async function handleAccept(request: FriendRequest) {
    const {userId, displayName} = request.profile;
    setBusyId(userId);
    try {
      await acceptFriendRequest(userId);
      toast.success(t('social.friendAdded', {name: displayName}));
      sendFriendPush('request_accepted', userId).catch(() => {});
      onAccepted();
    } catch (err) {
      toast.error(isNetworkError(err) ? t('common.errorNetwork') : t('social.errorAccept'));
    } finally {
      setBusyId(null);
      refreshFriendRequests();
    }
  }

  async function handleDecline(request: FriendRequest) {
    const {userId} = request.profile;
    setBusyId(userId);
    try {
      await declineFriendRequest(userId);
      // Quiet on purpose: the row disappearing is the whole feedback.
    } catch (err) {
      toast.error(isNetworkError(err) ? t('common.errorNetwork') : t('social.errorAccept'));
    } finally {
      setBusyId(null);
      refreshFriendRequests();
    }
  }

  return (
    <View style={styles.section}>
      <Text variant="caption" color="tertiary" style={styles.eyebrow}>
        {t('social.requests').toUpperCase()}
      </Text>
      {requests.map(request => {
        const {userId, displayName} = request.profile;
        const initials = displayName
          .split(/\s+/)
          .slice(0, 2)
          .map(w => w[0]?.toUpperCase() ?? '')
          .join('');
        const busy = busyId !== null;
        return (
          <Card key={userId} style={styles.card}>
            <Avatar
              initials={initials}
              tone="soft"
              uri={avatarUrlFor(request.profile.avatarPath)}
            />
            <View style={styles.name}>
              <Text variant="label" numberOfLines={1}>
                {displayName}
              </Text>
            </View>
            <Button
              label={t('social.accept')}
              variant="secondary"
              fullWidth={false}
              disabled={busy}
              onPress={() => handleAccept(request)}
            />
            <CircleButton
              size={32}
              onPress={busy ? undefined : () => handleDecline(request)}
              accessibilityLabel={t('social.a11yDecline', {name: displayName})}>
              <X size={16} color={colors.textSecondary} strokeWidth={2} />
            </CircleButton>
          </Card>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {gap: spacing.sm},
  eyebrow: {letterSpacing: 1},
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
  },
  name: {flex: 1},
});
