import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
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
 * No card: a dimmed scrim with a white title pill above the game tiles, which
 * float directly on the scrim (each carries its own near-solid white fill so it
 * reads). Tiles show just the game name; unbuilt games are dimmed and inert.
 * The list scrolls, so the catalog can grow without breaking the layout.
 */
export function GamePickerSheet({visible, title, onSelect, onCancel}: Props) {
  const {t} = useTranslation();
  const {height} = useWindowDimensions();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}>
      <Pressable style={styles.scrim} onPress={onCancel}>
        {/* Transparent content column — taps here don't dismiss (only the scrim). */}
        <Pressable style={styles.content} onPress={() => {}}>
          {/* Title on its own white pill, matching the corner buttons. */}
          <View style={styles.titlePill}>
            <Text variant="label" align="center">
              {title}
            </Text>
          </View>
          <ScrollView
            style={{maxHeight: height * 0.6}}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}>
            {GAMES.filter(game => !game.single).map(game => (
              <GameTile
                key={game.gameType}
                title={t(`games.${game.i18nKey}.title`)}
                Icon={game.Icon}
                surface="floating"
                disabled={!game.available}
                onPress={() => onSelect(game.gameType)}
              />
            ))}
          </ScrollView>
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
  // White pill hugging the title, matching the floating tiles.
  titlePill: {
    alignSelf: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.pill,
    backgroundColor: colors.glassStrong,
    borderWidth: 1,
    borderColor: colors.glassRim,
    shadowColor: '#140F32',
    shadowOpacity: 0.12,
    shadowOffset: {width: 0, height: 8},
    shadowRadius: 16,
    elevation: 4,
  },
  // Gap between tiles + a little vertical breathing room so the tiles' shadows
  // aren't clipped at the top/bottom of the scroll frame.
  listContent: {gap: spacing.md, paddingVertical: spacing.xs},
});
