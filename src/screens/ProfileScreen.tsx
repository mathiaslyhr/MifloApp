import React, {useEffect, useState} from 'react';
import {StyleSheet, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {Button, Screen, ScreenHeader, Text, TextField} from '../core/ui';
import {spacing} from '../theme';
import {getNickname, setNickname} from '../core/identity/deviceId';
import type {RootStackParamList} from '../core/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Profile'>;

const NAME_MAX = 20;

/**
 * Edit the display name carried into games. Miflo has no login — this is just a
 * persisted nickname (see core/identity/deviceId).
 */
export function ProfileScreen({navigation}: Props) {
  const [name, setName] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getNickname().then(n => n && setName(n));
  }, []);

  const onSave = async () => {
    await setNickname(name);
    setSaved(true);
  };

  const trimmed = name.trim();

  return (
    <Screen>
      <ScreenHeader title="Profile" onBack={() => navigation.goBack()} />

      <View style={styles.body}>
        <Text variant="secondary" color="textSecondary">
          Display name
        </Text>
        <TextField
          value={name}
          onChangeText={t => {
            setName(t);
            setSaved(false);
          }}
          placeholder="Your name"
          maxLength={NAME_MAX}
          autoCapitalize="words"
          returnKeyType="done"
          onSubmitEditing={onSave}
        />
        <Text variant="caption" color="textSecondary">
          This is the name other players see in the room.
        </Text>

        <Button
          label={saved ? 'Saved' : 'Save'}
          disabled={trimmed.length === 0}
          onPress={onSave}
          style={styles.save}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingTop: spacing.lg,
    gap: spacing.sm,
  },
  save: {marginTop: spacing.lg},
});
