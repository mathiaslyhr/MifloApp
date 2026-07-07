import React from 'react';
import {Modal, Pressable, StyleSheet, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import {spacing} from '../../theme';
import {GAMES, GameType} from '../../screens/gamesCatalog';
import {GameTile} from './GameTile';
import {Text} from './Text';

type Props = {
  visible: boolean;
  title: string;
  onSelect: (gameType: GameType) => void;
  onCancel: () => void;
};

/**
 * The host's game picker in the Lobby's free mode (party created without a game).
 * No card: a dimmed scrim with the game tiles floating directly on it (each tile
 * carries its own near-solid white fill so it reads against the dark scrim).
 * Built games are tappable and start the round; unbuilt ones are dimmed with a
 * muted "Coming soon" label.
 */
export function GamePickerSheet({visible, title, onSelect, onCancel}: Props) {
  const {t} = useTranslation();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}>
      <Pressable style={styles.scrim} onPress={onCancel}>
        {/* Transparent content column — taps here don't dismiss (only the scrim). */}
        <Pressable style={styles.content} onPress={() => {}}>
          <Text variant="label" align="center" color="onInk">
            {title}
          </Text>
          <View style={styles.list}>
            {GAMES.map(game => (
              <GameTile
                key={game.gameType}
                title={t(`games.${game.i18nKey}.title`)}
                tagline={t(`games.${game.i18nKey}.tagline`)}
                Icon={game.Icon}
                surface="floating"
                disabled={!game.available}
                badge={game.available ? undefined : t('games.comingSoon')}
                badgeVariant="text"
                onPress={() => onSelect(game.gameType)}
              />
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(13,13,22,0.45)',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  content: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 380,
    gap: spacing.lg,
  },
  list: {gap: spacing.md},
});
