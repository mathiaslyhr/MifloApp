/**
 * The bell's feed: friend requests and party invites, newest first.
 *
 * Marks everything read on mount — opening the bell IS reading it, so the dot
 * clears without a second gesture. An empty bell is honest: nothing needs you.
 *
 * One source blinking must never blank the page, so a failed invite fetch shows
 * a quiet retry row above whatever friend requests still loaded, rather than an
 * error screen over the top of them.
 */
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {RefreshControl, StyleSheet} from 'react-native';
import {useTranslation} from 'react-i18next';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {Card, PressableScale, Text} from '../core/ui';
import {spacing, useColors} from '../theme';
import {
  mergeFeed,
  refreshInvites,
  useNotificationsStore,
} from '../core/notifications/notificationsStore';
import {refreshFriendRequests, useRequestsStore} from '../core/social/requestsStore';
import {MenuDetailScreen} from './menu/MenuDetailScreen';
import {NotificationRow} from './notifications/NotificationRow';
import type {RootStackParamList} from '../core/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Notifications'>;

export function NotificationsScreen({navigation}: Props) {
  const {t} = useTranslation();
  const colors = useColors();
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

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refreshFriendRequests(), refreshInvites()]);
    setRefreshing(false);
    markAllRead();
  }, [markAllRead]);

  const reload = useCallback(() => {
    refreshFriendRequests();
    refreshInvites();
  }, []);

  return (
    <MenuDetailScreen
      title={t('notifications.title')}
      onBack={() => navigation.goBack()}
      backLabel={t('common.back')}
      contentStyle={styles.body}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.textTertiary}
        />
      }>
      {invitesError ? (
        <PressableScale
          onPress={onRefresh}
          accessibilityRole="button"
          accessibilityLabel={t('notifications.retry')}>
          <Card style={styles.messageCard}>
            <Text variant="secondary" color="tertiary" align="center">
              {t('notifications.retry')}
            </Text>
          </Card>
        </PressableScale>
      ) : null}

      {items.length === 0 ? (
        <Card style={styles.messageCard}>
          <Text variant="secondary" color="secondary" align="center">
            {t('notifications.empty')}
          </Text>
        </Card>
      ) : (
        items.map(item => (
          <NotificationRow
            key={
              item.kind === 'invite'
                ? `invite-${item.invite.id}`
                : `request-${item.request.profile.userId}`
            }
            item={item}
            onJoin={code => navigation.navigate('Join', {code})}
            onAfterAction={reload}
          />
        ))
      )}
    </MenuDetailScreen>
  );
}

const styles = StyleSheet.create({
  body: {gap: spacing.sm},
  messageCard: {padding: spacing.xl},
});
