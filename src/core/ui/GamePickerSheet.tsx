import React from 'react';
import {Modal, Pressable, StyleSheet, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import {colors, radii, spacing} from '../../theme';
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
 * A dimmed scrim over a card listing the games catalog: built games are tappable
 * and start the round; unbuilt ones render dimmed with a "Coming soon" pill.
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
        <Pressable style={styles.card} onPress={() => {}}>
          <Text variant="label" align="center">
            {title}
          </Text>
          <View style={styles.list}>
            {GAMES.map(game => (
              <GameTile
                key={game.gameType}
                title={t(`games.${game.i18nKey}.title`)}
                tagline={t(`games.${game.i18nKey}.tagline`)}
                Icon={game.Icon}
                disabled={!game.available}
                badge={game.available ? undefined : t('games.comingSoon')}
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
    backgroundColor: 'rgba(13,13,22,0.35)',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  card: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    shadowColor: '#140F32',
    shadowOpacity: 0.24,
    shadowOffset: {width: 0, height: 16},
    shadowRadius: 32,
    elevation: 12,
  },
  list: {gap: spacing.md},
});
