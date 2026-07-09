import React, {useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {ChevronLeft} from 'lucide-react-native';
import {useTranslation} from 'react-i18next';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {Button, CircleButton, Screen, Text, TextField, toast} from '../core/ui';
import {haptics} from '../core/haptics';
import {colors, spacing} from '../theme';
import type {RootStackParamList} from '../core/navigation';
import {
  joinRoom,
  BackendUnavailableError,
  isNetworkError,
} from '../core/rooms/roomService';
import {randomFootballName} from '../core/identity/funnyName';

type Props = NativeStackScreenProps<RootStackParamList, 'Join'>;

const CODE_LENGTH = 4;

/**
 * Join — enter a party code to hop into someone else's lobby. Like Create, you
 * get a random football name (no prompt) and can rename yourself in the lobby.
 * On success we `replace` this screen with the Lobby so Back goes Home.
 */
export function JoinScreen({navigation}: Props) {
  const {t} = useTranslation();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const trimmed = code.trim();

  async function handleJoin() {
    if (busy) {
      return;
    }
    // A short code can't be a real party — say so instead of silently ignoring
    // the tap (the button stays enabled so the error is discoverable).
    if (trimmed.length !== CODE_LENGTH) {
      haptics.error();
      toast.error(t('join.errorShortCode', {count: CODE_LENGTH}));
      return;
    }
    setBusy(true);
    try {
      const room = await joinRoom(trimmed, randomFootballName());
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
