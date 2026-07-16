/**
 * One row of the bell's feed.
 *
 * Two variants, one shape: an avatar, a sentence, a relative time, and at most
 * one action. An invite row is a LOG — it says what happened ("You joined") and
 * only offers Join while the room is still open, which the server decides, not
 * this component.
 *
 * Accept/decline are the calls the Profile tab's RequestsSection used to make,
 * verbatim (same toasts, same busy guard, same fire-and-forget push). That
 * section is gone: this is now the only place a request gets answered, because
 * two ways to answer one would be two things to keep in sync.
 */
import React, {useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import type {TFunction} from 'i18next';
import {Check, X} from 'lucide-react-native';
import {
  Avatar,
  Button,
  Card,
  CircleButton,
  Text,
  initialsFor,
  toast,
} from '../../core/ui';
import {spacing, useColors} from '../../theme';
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
  const colors = useColors();
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
      sendFriendPush('request_accepted', person.userId).catch(() => {});
      onAfterAction();
    } catch (err) {
      toast.error(
        isNetworkError(err) ? t('common.errorNetwork') : t('social.errorAccept'),
      );
    } finally {
      setBusy(false);
      refreshFriendRequests();
    }
  }

  async function handleDecline() {
    if (busy) {
      return;
    }
    setBusy(true);
    try {
      await declineFriendRequest(person.userId);
      // Quiet on purpose: the row disappearing is the whole feedback.
      onAfterAction();
    } catch (err) {
      toast.error(
        isNetworkError(err) ? t('common.errorNetwork') : t('social.errorAccept'),
      );
    } finally {
      setBusy(false);
      refreshFriendRequests();
    }
  }

  const body =
    item.kind === 'friend-request'
      ? t('notifications.friendRequest', {name})
      : t('notifications.invited', {name});

  // An invite that can no longer be joined says how it ended instead.
  const meta =
    item.kind === 'invite' && !item.invite.joinable
      ? `${when} · ${
          item.invite.joined
            ? t('notifications.joined')
            : t('notifications.didNotJoin')
        }`
      : when;

  return (
    <Card style={styles.row}>
      <Avatar
        initials={initialsFor(name)}
        tone="soft"
        size={44}
        uri={avatarUrlFor(person.avatarPath)}
      />
      <View style={styles.body}>
        <Text variant="label" numberOfLines={2}>
          {body}
        </Text>
        <Text variant="caption" color="tertiary">
          {meta}
        </Text>
      </View>
      {item.kind === 'friend-request' ? (
        // A matched pair of round controls, told apart by weight rather than
        // shape: accept wears the brand rim and a brighter glyph, decline stays
        // on the divider rim. Two identical circles would offer the same thing
        // twice.
        <>
          <CircleButton
            size={32}
            accent
            onPress={busy ? undefined : handleAccept}
            accessibilityLabel={t('social.a11yAccept', {name})}>
            <Check size={16} color={colors.primary} strokeWidth={2.25} />
          </CircleButton>
          <CircleButton
            size={32}
            onPress={busy ? undefined : handleDecline}
            accessibilityLabel={t('social.a11yDecline', {name})}>
            <X size={16} color={colors.textSecondary} strokeWidth={2} />
          </CircleButton>
        </>
      ) : item.invite.joinable ? (
        <Button
          label={t('notifications.join')}
          variant="secondary"
          fullWidth={false}
          size="sm"
          onPress={() => onJoin(item.invite.code)}
        />
      ) : null}
    </Card>
  );
}

/**
 * "2m ago" / "3h ago" / "4d ago" — when the thing HAPPENED.
 *
 * Deliberately not presence's `formatLastActive`: that one is welded to
 * presence semantics. It returns null inside the online window, so a
 * two-minute-old invite would carry no time at all, and it words itself
 * "Active 5 min ago", which is a claim about a person, not about when they
 * invited you. Its `profile.ago*` keys are bare unit labels ("min ago") with no
 * count in them — the profile stat renders the number separately — so they
 * cannot be reused for a one-line caption either. Hence one helper, its own
 * keys, and no second dialect anywhere in this row.
 */
function relativeTime(at: string, t: TFunction): string {
  const parsed = Date.parse(at);
  if (Number.isNaN(parsed)) {
    return '';
  }
  const mins = Math.max(0, Math.round((Date.now() - parsed) / 60_000));
  if (mins < 60) {
    return t('notifications.agoMinutes', {count: mins});
  }
  if (mins < 60 * 24) {
    return t('notifications.agoHours', {count: Math.floor(mins / 60)});
  }
  return t('notifications.agoDays', {count: Math.floor(mins / (60 * 24))});
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
  },
  body: {flex: 1, gap: 2},
});
