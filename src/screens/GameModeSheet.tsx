import React from 'react';
import {StyleSheet, View} from 'react-native';
import {ChevronRight, Smartphone, Users} from 'lucide-react-native';
import {useTranslation} from 'react-i18next';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {PressableScale, Text} from '../core/ui';
import {
  radii,
  screenPadding,
  spacing,
  useColors,
  useThemedStyles,
  type Palette,
} from '../theme';
import type {RootStackParamList} from '../core/navigation';
import {useCreateParty} from '../core/rooms/useCreateParty';
import {GAMES, type GameType} from './gamesCatalog';

/** Roomless pass-and-play routes, one per game that supports one phone. All
 * four take no params, which is what lets `replace` be called untyped-free. */
type LocalRoute =
  | 'HattrickLocal'
  | 'RedCardLocal'
  | 'OffsideLocal'
  | 'CultHeroLocal';

const LOCAL_ROUTES: Partial<Record<GameType, LocalRoute>> = {
  hattrick: 'HattrickLocal',
  'red-card': 'RedCardLocal',
  offside: 'OffsideLocal',
  'cult-hero': 'CultHeroLocal',
};

type Props = NativeStackScreenProps<RootStackParamList, 'GameMode'>;

/**
 * "How do you want to play?" — the two ways into one multiplayer game, on a
 * real UIKit sheet (see RootNavigator: `formSheet` + `fitToContents`).
 *
 * This exists because tapping a game used to mint an online room on the spot:
 * one tap and you were the host of a live room, and backing out deleted it.
 * There was no way to say "actually, one phone". Now the tap asks first.
 *
 * Both actions REPLACE this route rather than pushing over it, so the sheet
 * never sits in the stack underneath a lobby or a game — coming back from a
 * match lands on the Play tab, not on a stale sheet.
 */
export function GameModeSheet({route, navigation}: Props) {
  const {gameType} = route.params;
  const {t} = useTranslation();
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const {createParty, busy} = useCreateParty();

  const entry = GAMES.find(g => g.gameType === gameType);
  const localRoute = LOCAL_ROUTES[gameType];

  const startOnline = () => {
    if (!busy) {
      createParty(gameType, {replace: true});
    }
  };

  const startLocal = () => {
    if (localRoute) {
      navigation.replace(localRoute);
    }
  };

  return (
    <View style={styles.sheet}>
      <Text variant="wordmark" align="center" style={styles.title}>
        {entry ? t(`games.${entry.i18nKey}.title`) : ''}
      </Text>
      <Text variant="caption" color="secondary" align="center">
        {t('play.mode.prompt')}
      </Text>

      <View style={styles.options}>
        <Option
          Icon={Users}
          title={t('play.mode.onlineTitle')}
          subtitle={t('play.mode.onlineBody')}
          onPress={startOnline}
          disabled={busy}
          styles={styles}
          colors={colors}
        />
        {localRoute ? (
          <Option
            Icon={Smartphone}
            title={t('play.mode.localTitle')}
            subtitle={t('play.mode.localBody')}
            onPress={startLocal}
            disabled={busy}
            styles={styles}
            colors={colors}
          />
        ) : null}
      </View>
    </View>
  );
}

function Option({
  Icon,
  title,
  subtitle,
  onPress,
  disabled,
  styles,
  colors,
}: {
  Icon: typeof Users;
  title: string;
  subtitle: string;
  onPress: () => void;
  disabled: boolean;
  styles: ReturnType<typeof makeStyles>;
  colors: Palette;
}) {
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={[styles.option, disabled && styles.optionBusy]}>
      <View style={styles.iconSlot}>
        <Icon size={22} color={colors.ink} strokeWidth={2} />
      </View>
      <View style={styles.optionBody}>
        <Text variant="body">{title}</Text>
        <Text variant="caption" color="secondary">
          {subtitle}
        </Text>
      </View>
      <ChevronRight size={18} color={colors.textTertiary} strokeWidth={2} />
    </PressableScale>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    // The sheet sizes itself to this content (fitToContents), so the padding
    // here IS the sheet's height. Bottom padding clears the home indicator.
    sheet: {
      paddingHorizontal: screenPadding,
      paddingTop: spacing.lg,
      paddingBottom: spacing.xl + spacing.lg,
      gap: spacing.xs,
    },
    title: {marginBottom: 2},
    options: {marginTop: spacing.lg, gap: spacing.sm},
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      backgroundColor: c.surface,
      borderRadius: radii.card,
      borderWidth: 1,
      borderColor: c.divider,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
    },
    optionBusy: {opacity: 0.5},
    iconSlot: {width: 40, alignItems: 'center', justifyContent: 'center'},
    optionBody: {flex: 1, gap: 2},
  });
