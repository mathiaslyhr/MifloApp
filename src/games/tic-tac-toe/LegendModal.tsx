/**
 * LegendModal — the in-game "technical area": a scrollable key explaining every
 * axis icon on the football grid, in plain language. Opened from the game
 * header. Uses a real example flag/crest/trophy/avatar where one is bundled and
 * falls back to the same emoji vocabulary the board uses (criterionIcon.ts).
 */
import React from 'react';
import {Image, Modal, Pressable, ScrollView, StyleSheet, View} from 'react-native';
import {X} from 'lucide-react-native';
import {useTranslation} from 'react-i18next';
import {Text} from '../../core/ui';
import {colors, radii, spacing} from '../../theme';
import {FLAG_IMAGES} from './assets/flags.generated';
import {LOGO_IMAGES} from './assets/logos.generated';
import {TROPHY_IMAGES} from './assets/trophies.generated';
import {PLAYER_AVATARS} from './assets/playerAvatars';

/** First bundled image in a map (a representative sample for the key), or null. */
function sample(map: Record<string, number>): number | null {
  const values = Object.values(map);
  return values.length ? values[0] : null;
}

type Entry = {
  image?: number | null;
  emoji: string;
  /** Key under `legend.*` for the title/desc pair (e.g. "country" → countryTitle/countryDesc). */
  key: string;
};

const ENTRIES: Entry[] = [
  {image: sample(FLAG_IMAGES), emoji: '🏴', key: 'country'},
  {image: sample(LOGO_IMAGES), emoji: '🛡️', key: 'club'},
  {
    image: TROPHY_IMAGES['champions-league'] ?? sample(TROPHY_IMAGES),
    emoji: '🏆',
    key: 'trophy',
  },
  {emoji: '🌍', key: 'international'},
  {emoji: '🏅', key: 'ballonDor'},
  {emoji: '👟', key: 'goldenBoot'},
  {image: sample(PLAYER_AVATARS), emoji: '🤝', key: 'playedWith'},
  {emoji: '👕', key: 'shirtNumber'},
  {emoji: '🌐', key: 'topLeagues'},
  {emoji: '🧤 🛡️ 🎯 ⚽', key: 'position'},
  {emoji: '🔥', key: 'currentStar'},
  {emoji: '⭐', key: 'notable'},
];

/** "country" → "countryTitle" (capitalize first letter for the key suffix). */
function titleKey(key: string) {
  return `legend.${key}Title`;
}
function descKey(key: string) {
  return `legend.${key}Desc`;
}

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function LegendModal({visible, onClose}: Props) {
  const {t} = useTranslation();
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          <View style={styles.titleRow}>
            <Text variant="label">{t('legend.title')}</Text>
            <Pressable
              onPress={onClose}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}>
              <X size={20} color={colors.ink} strokeWidth={2} />
            </Pressable>
          </View>
          <Text variant="secondary" color="secondary">
            {t('legend.intro')}
          </Text>
          <ScrollView
            style={styles.list}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled">
            {ENTRIES.map(e => (
              <View key={e.key} style={styles.row}>
                <View style={styles.iconBox}>
                  {e.image != null ? (
                    <Image source={e.image} resizeMode="contain" style={styles.iconImage} />
                  ) : (
                    <Text style={styles.iconEmoji}>{e.emoji}</Text>
                  )}
                </View>
                <View style={styles.rowText}>
                  <Text variant="body">{t(titleKey(e.key))}</Text>
                  <Text variant="secondary" color="secondary">
                    {t(descKey(e.key))}
                  </Text>
                </View>
              </View>
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
    backgroundColor: 'rgba(13,13,22,0.15)',
    justifyContent: 'flex-start',
    paddingTop: 72,
    paddingHorizontal: spacing.xl,
  },
  card: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 380,
    maxHeight: '78%',
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.lg,
    gap: spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  list: {flexGrow: 0},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  iconBox: {width: 40, alignItems: 'center', justifyContent: 'center'},
  iconImage: {width: 28, height: 28},
  iconEmoji: {fontSize: 20, lineHeight: 26, textAlign: 'center'},
  rowText: {flex: 1, gap: 2},
});
