import React, {useState} from 'react';
import {KeyboardAvoidingView, Platform, StyleSheet, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {
  Screen,
  ScreenHeader,
  Text,
  Button,
  TextField,
  StickyFooter,
} from '../../../core/ui';
import {spacing} from '../../../theme';
import type {RootStackParamList} from '../../../core/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'QuizJoin'>;

/**
 * Guest entry: type the host's game code and a display name, then drop into the
 * lobby. Static for M1 — no validation against a real room yet.
 */
export function JoinScreen({navigation}: Props) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');

  const canJoin = code.trim().length === 4 && name.trim().length > 0;

  return (
    <Screen>
      <ScreenHeader title="Join game" onBack={() => navigation.goBack()} />
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.content}>
          <View style={styles.field}>
            <Text variant="secondary" color="textSecondary">
              Game code
            </Text>
            <TextField
              variant="code"
              value={code}
              onChangeText={text => setCode(text.toUpperCase().slice(0, 4))}
              placeholder="––––"
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={4}
              returnKeyType="next"
            />
          </View>

          <View style={styles.field}>
            <Text variant="secondary" color="textSecondary">
              Your name
            </Text>
            <TextField
              value={name}
              onChangeText={setName}
              placeholder="Name"
              autoCapitalize="words"
              maxLength={16}
              returnKeyType="done"
            />
          </View>
        </View>

        <StickyFooter>
          <Button
            label="Join game"
            disabled={!canJoin}
            onPress={() =>
              navigation.navigate('QuizLobby', {
                code: code.trim().toUpperCase(),
                isHost: false,
                name: name.trim(),
              })
            }
          />
        </StickyFooter>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: {flex: 1},
  content: {
    flex: 1,
    paddingTop: spacing.xl,
    gap: spacing.xl,
  },
  field: {
    gap: spacing.md,
  },
});
