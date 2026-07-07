import React, {useCallback, useEffect, useState} from 'react';
import {AppState, Linking, StyleSheet, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import {Button, Screen, Text} from '../ui';
import {spacing} from '../../theme';
import {APP_STORE_URL} from '../config';
import {isUpdateRequired} from './versionGate';

type Props = {children: React.ReactNode};

/**
 * Hard update gate. Wraps the whole app: if this build is below the remote
 * `min_supported_version`, it replaces everything with a blocking "update to
 * keep playing" screen. Fail-open — anything short of a confirmed
 * below-minimum result renders the app normally. Re-checks when the app
 * returns to the foreground so a mid-session bump takes effect.
 */
export function UpdateGate({children}: Props) {
  const {t} = useTranslation();
  const [blocked, setBlocked] = useState(false);

  const check = useCallback(() => {
    isUpdateRequired()
      .then(setBlocked)
      .catch(() => setBlocked(false));
  }, []);

  useEffect(() => {
    check();
    const sub = AppState.addEventListener('change', s => {
      if (s === 'active') {
        check();
      }
    });
    return () => sub.remove();
  }, [check]);

  if (!blocked) {
    return <>{children}</>;
  }

  return (
    <Screen canvas>
      <View style={styles.center}>
        <Text variant="wordmark" align="center">
          {t('update.title')}
        </Text>
        <Text variant="body" color="secondary" align="center" style={styles.body}>
          {t('update.body')}
        </Text>
        <Button
          label={t('update.action')}
          variant="primary"
          onPress={() => Linking.openURL(APP_STORE_URL).catch(() => {})}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'stretch',
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  body: {marginBottom: spacing.md},
});
