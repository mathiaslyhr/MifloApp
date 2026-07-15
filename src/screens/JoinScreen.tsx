import React, {useEffect, useRef, useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {ChevronLeft} from 'lucide-react-native';
import {useTranslation} from 'react-i18next';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {Button, CircleButton, Screen, Text, TextField, toast} from '../core/ui';
import {haptics} from '../core/haptics';
import {spacing, useColors} from '../theme';
import type {RootStackParamList} from '../core/navigation';
import {
  joinRoom,
  BackendUnavailableError,
  isNetworkError,
} from '../core/rooms/roomService';
import {myPlayerName} from '../core/social/socialService';

type Props = NativeStackScreenProps<RootStackParamList, 'Join'>;

const CODE_LENGTH = 4;

/**
 * Join — enter a party code to hop into someone else's lobby. Like Create, you
 * show up under your profile name (no prompt) and can rename yourself in the
 * lobby without touching the profile.
 * On success we `replace` this screen with the Lobby so Back goes Home.
 */
export function JoinScreen({navigation, route}: Props) {
  const {t} = useTranslation();
  const colors = useColors();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const trimmed = code.trim();

  // A code arriving via the join deep link (miflo.dk/join/CODE) fills the
  // field and joins immediately — the tap on the link WAS the join intent.
  const autoJoined = useRef(false);
  useEffect(() => {
    const linkCode = route.params?.code?.trim().toUpperCase() ?? '';
    if (autoJoined.current || !/^[A-Z0-9]{4}$/.test(linkCode)) {
      return;
    }
    autoJoined.current = true;
    setCode(linkCode);
    join(linkCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.params?.code]);

  async function handleJoin() {
    // A short code can't be a real party — say so instead of silently ignoring
    // the tap (the button stays enabled so the error is discoverable).
    if (trimmed.length !== CODE_LENGTH) {
      haptics.error();
      toast.error(t('join.errorShortCode', {count: CODE_LENGTH}));
      return;
    }
    await join(trimmed);
  }

  async function join(joinCode: string) {
    if (busy) {
      return;
    }
    setBusy(true);
    try {
      const room = await joinRoom(joinCode, await myPlayerName());
      navigation.replace('Lobby', {roomId: room.id});
    } catch (err) {
      // Blame the code only when the server actually rejected it — a request
      // that never got through shows a connection message instead.
      haptics.error();
      toast.error(
        err instanceof BackendUnavailableError
          ? t('join.errorUnavailable')
          : isNetworkError(err)
          ? t('join.errorNetwork')
          : t('join.errorBadCode'),
      );
      setBusy(false);
    }
  }

  return (
    <Screen canvas>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <CircleButton
            size={36}
            accessibilityLabel={t('common.back')}
            onPress={() => navigation.goBack()}>
            <ChevronLeft size={20} color={colors.ink} strokeWidth={2} />
          </CircleButton>
        </View>
        <Text variant="wordmark" align="center">
          {t('join.title')}
        </Text>
      </View>

      <View style={styles.body}>
        <Text variant="section" align="center">
          {t('join.prompt')}
        </Text>
        <TextField
          value={code}
          onChangeText={text => setCode(text.toUpperCase())}
          placeholder={t('join.codePlaceholder')}
          autoFocus
          autoCapitalize="characters"
          maxLength={CODE_LENGTH}
          returnKeyType="go"
          onSubmitEditing={handleJoin}
          accessibilityLabel={t('join.codeLabel')}
          style={styles.codeField}
        />
        <Button
          label={busy ? t('join.joining') : t('join.join')}
          variant="primary"
          onPress={handleJoin}
          disabled={busy}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    marginTop: spacing.sm,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerLeft: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  body: {
    paddingTop: spacing.xxxl,
    gap: spacing.lg,
  },
  codeField: {
    textAlign: 'center',
    fontSize: 24,
    letterSpacing: 8,
  },
});
