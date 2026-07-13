/**
 * Skin 3 — the "Quick setup" onboarding flow, launched from the welcome screen's
 * primary CTA. Three steps behind a progress bar:
 *
 *   0 Name       required — this is the call that creates the profile server-side
 *                and mints the permanent friend code (there's no way to know the
 *                code before the row exists, so name has to come first).
 *   1 Code       reveal the freshly minted friend code + share it.
 *   2 Favorites  pick one favorite player, club and national team — all optional.
 *
 * Skin 3 has no navigator, so this is a self-contained component with internal
 * step state, rendered full-screen over the welcome screen. It reuses the shared
 * social services (optInToSocial / setDisplayName / setFavorites) and the unified
 * FotMob search (useSearch), so nothing new touches the backend.
 *
 * Unlike the welcome screen, the setup steps sit on a plain near-black canvas —
 * the purple glow is reserved for the app's front door.
 */
import React, {useState} from 'react';
import {
  ActionSheetIOS,
  Image,
  Keyboard,
  Pressable,
  Share,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';
import {useTranslation} from 'react-i18next';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {ChevronLeft, ChevronRight, Plus, Share as ShareIcon} from 'lucide-react-native';
import {Button, PressableScale, Text, TextField, toast} from '../../../core/ui';
import {optInToSocial} from '../../../core/social/onboarding';
import {isNameTakenError, setDisplayName, setFavorites} from '../../../core/social/socialService';
import type {SocialProfile} from '../../../core/social/types';
import {ADD_URL_BASE} from '../../../core/config';
import {dateKeyFor} from '../../../games/scout/dailySeed';
import {useSearch} from '../../../games/shared/SearchScreen';
import {clubSource, nationSource, playerSource} from '../../../games/shared/searchSources';
import {getById, getClub} from '../../../data/football';
import {flagImage, logoImage} from '../../../games/hattrick/criterionIcon';
import {PLAYER_AVATARS} from '../../../games/hattrick/assets/playerAvatars';
import {fonts, radii, spacing, useColors, useThemedStyles, type Palette} from '../../../theme';
import {StepProgress} from './StepProgress';

const TOTAL_STEPS = 3;

type Favorites = {playerId: string | null; clubId: string | null; nation: string | null};
type Slot = 'player' | 'club' | 'nation';

/** Portrait for a footballer id, falling back to their nationality flag. */
function playerImage(id: string): number | null {
  return PLAYER_AVATARS[id] ?? flagImage(getById(id)?.nationality[0]) ?? null;
}

export function QuickSetupFlow({
  onClose,
  onComplete,
}: {
  /** Abandon setup → back to the welcome screen. */
  onClose: () => void;
  /** Setup finished → close the flow (no skin-3 home to land on yet). */
  onComplete: () => void;
}): React.JSX.Element {
  const styles = useThemedStyles(makeStyles);
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {t} = useTranslation();
  const openSearch = useSearch();

  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [profile, setProfile] = useState<SocialProfile | null>(null);
  const [favorites, setFavoritesState] = useState<Favorites>({
    playerId: null,
    clubId: null,
    nation: null,
  });
  const [busy, setBusy] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  const trimmedName = name.trim();

  async function submitName() {
    if (busy) {
      return;
    }
    if (trimmedName.length === 0) {
      // Tapping Continue with no username: tell them why nothing happened.
      toast.error(t('setup.nameRequired'));
      return;
    }
    setBusy(true);
    setNameError(null);
    try {
      if (!profile) {
        // First time through: create the profile (server mints the code).
        const created = await optInToSocial(trimmedName, dateKeyFor(new Date()));
        setProfile(created);
      } else if (trimmedName !== profile.displayName) {
        // Came back and edited the name: rename the existing profile.
        await setDisplayName(trimmedName);
        setProfile({...profile, displayName: trimmedName});
      }
      setStep(1);
    } catch (err) {
      if (isNameTakenError(err)) {
        setNameError(t('setup.nameTaken'));
      } else {
        toast.error(t('setup.createError'));
      }
    } finally {
      setBusy(false);
    }
  }

  function back() {
    if (step === 0) {
      onClose();
    } else {
      setStep(step - 1);
    }
  }

  function pickFavorite(slot: Slot) {
    const source = slot === 'player' ? playerSource() : slot === 'club' ? clubSource() : nationSource();
    const title =
      slot === 'player'
        ? t('setup.pickPlayer')
        : slot === 'club'
          ? t('setup.pickClub')
          : t('setup.pickNation');
    openSearch(source, {title, placeholder: t('setup.searchPlaceholder')}).then(item => {
      if (item) {
        setFavoritesState(prev => ({...prev, [slotKey(slot)]: item.id}));
      }
    });
  }

  function onTilePress(slot: Slot, hasValue: boolean) {
    if (!hasValue) {
      pickFavorite(slot);
      return;
    }
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: [t('setup.favoriteChange'), t('setup.favoriteRemove'), t('common.cancel')],
        destructiveButtonIndex: 1,
        cancelButtonIndex: 2,
      },
      index => {
        if (index === 0) {
          pickFavorite(slot);
        } else if (index === 1) {
          setFavoritesState(prev => ({...prev, [slotKey(slot)]: null}));
        }
      },
    );
  }

  function shareCode() {
    const code = profile?.friendCode ?? '';
    Share.share({
      message: t('social.shareMessage', {code, link: `${ADD_URL_BASE}/${code}`}),
    }).catch(() => {});
  }

  async function finish() {
    const hasAny = !!(favorites.playerId || favorites.clubId || favorites.nation);
    if (hasAny) {
      // Profile already exists; persist picks. A failure here shouldn't trap the
      // user in setup — they can set favorites later on Profile — so toast + go on.
      try {
        await setFavorites(favorites);
      } catch {
        toast.error(t('setup.favoritesError'));
      }
    }
    onComplete();
  }

  const hasAnyFavorite = !!(favorites.playerId || favorites.clubId || favorites.nation);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />
      <View
        style={[
          styles.container,
          {paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + spacing.xl},
        ]}>
          {/* Top bar: back + progress. */}
          <View style={styles.topBar}>
            <PressableScale
              onPress={back}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={t('common.back')}>
              <ChevronLeft size={24} color={colors.textPrimary} strokeWidth={2} />
            </PressableScale>
            <View style={styles.flex}>
              <StepProgress step={step} total={TOTAL_STEPS} />
            </View>
          </View>

          {/* Step body. */}
          <View style={styles.body}>
            {step === 0 ? (
              // Wrap ONLY the name step's text + field (no buttons) so tapping
              // off the field dismisses the keyboard. Safe here because there are
              // no press-scale buttons inside — the Continue button lives in the
              // footer, so its gesture isn't stolen. (Wrapping buttons WOULD kill
              // their press-scale on this RN/Fabric build.)
              <Pressable style={styles.flex} onPress={Keyboard.dismiss} accessible={false}>
                <Text variant="hero">{t('setup.nameTitle')}</Text>
                <Text variant="secondary" color="secondary" style={styles.subtitle}>
                  {t('setup.nameSubtitle')}
                </Text>
                <TextField
                  value={name}
                  onChangeText={next => {
                    setName(next);
                    if (nameError) {
                      setNameError(null);
                    }
                  }}
                  placeholder={t('setup.namePlaceholder')}
                  autoCapitalize="words"
                  maxLength={20}
                  returnKeyType="done"
                  onSubmitEditing={submitName}
                  accessibilityLabel={t('setup.nameTitle')}
                  style={[styles.field, {backgroundColor: colors.surfaceSunken}]}
                />
                {nameError ? (
                  <Text variant="secondary" style={[styles.errorText, {color: colors.error}]}>
                    {nameError}
                  </Text>
                ) : null}
              </Pressable>
            ) : step === 1 ? (
              <>
                <Text variant="hero">{t('setup.codeTitle')}</Text>
                <Text variant="secondary" color="secondary" style={styles.subtitle}>
                  {t('setup.codeSubtitle')}
                </Text>
                {/* The whole card is the share button (zooms on press). */}
                <PressableScale
                  onPress={shareCode}
                  containerStyle={styles.codeCardWrap}
                  style={styles.codeCard}
                  accessibilityRole="button"
                  accessibilityLabel={`${profile?.friendCode ?? ''}. ${t('setup.shareCode')}`}>
                  <Text style={styles.codeText}>{profile?.friendCode ?? ''}</Text>
                  <View style={styles.shareBtn}>
                    <ShareIcon size={18} color={colors.textPrimary} strokeWidth={2} />
                  </View>
                </PressableScale>
              </>
            ) : (
              <>
                <Text variant="hero">{t('setup.favoritesTitle')}</Text>
                <Text variant="secondary" color="secondary" style={styles.subtitle}>
                  {t('setup.favoritesSubtitle')}
                </Text>
                <View style={styles.tiles}>
                  <FavTile
                    caption={t('setup.player')}
                    label={favorites.playerId ? getById(favorites.playerId)?.name ?? favorites.playerId : null}
                    image={favorites.playerId ? playerImage(favorites.playerId) : null}
                    onPress={() => onTilePress('player', !!favorites.playerId)}
                  />
                  <FavTile
                    caption={t('setup.club')}
                    label={favorites.clubId ? getClub(favorites.clubId)?.name ?? favorites.clubId : null}
                    image={favorites.clubId ? logoImage(favorites.clubId) : null}
                    onPress={() => onTilePress('club', !!favorites.clubId)}
                  />
                  <FavTile
                    caption={t('setup.nation')}
                    label={favorites.nation}
                    image={favorites.nation ? flagImage(favorites.nation) : null}
                    onPress={() => onTilePress('nation', !!favorites.nation)}
                  />
                </View>
              </>
            )}
          </View>

          {/* Footer actions. */}
          <View style={styles.footer}>
            {step === 0 ? (
              <Button
                label={t('setup.continue')}
                variant="primary"
                onPress={submitName}
                disabled={busy}
                trailingIcon={<ChevronRight size={20} color={colors.onInk} strokeWidth={2.25} />}
              />
            ) : step === 1 ? (
              <Button
                label={t('setup.continue')}
                variant="primary"
                onPress={() => setStep(2)}
                trailingIcon={<ChevronRight size={20} color={colors.onInk} strokeWidth={2.25} />}
              />
            ) : (
              <>
                <Button label={t('setup.done')} variant="primary" onPress={finish} />
                <Pressable
                  onPress={finish}
                  hitSlop={8}
                  accessibilityRole="button"
                  style={styles.skip}>
                  <Text variant="secondary" color="accent">
                    {hasAnyFavorite ? t('setup.finishLater') : t('setup.skip')}
                  </Text>
                </Pressable>
              </>
            )}
          </View>
      </View>
    </View>
  );
}

function slotKey(slot: Slot): keyof Favorites {
  return slot === 'player' ? 'playerId' : slot === 'club' ? 'clubId' : 'nation';
}

function FavTile({
  caption,
  label,
  image,
  onPress,
}: {
  caption: string;
  label: string | null;
  image: number | null;
  onPress: () => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const colors = useColors();
  const {t} = useTranslation();
  const a11y = label ? `${caption}, ${label}` : t('setup.favoriteAddA11y', {slot: caption});
  return (
    <PressableScale
      containerStyle={styles.tilePress}
      style={styles.tileInner}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11y}>
      <View style={styles.badge}>
        {image != null ? (
          <Image source={image} resizeMode="contain" style={styles.badgeImg} />
        ) : (
          <Plus size={20} color={colors.textTertiary} strokeWidth={2} />
        )}
      </View>
      <Text variant="caption" color="tertiary" numberOfLines={1} style={styles.tileCaption}>
        {caption}
      </Text>
      <Text
        variant="secondary"
        color={label ? 'primary' : 'tertiary'}
        numberOfLines={1}
        style={styles.tileLabel}>
        {label ?? t('setup.favoriteAdd')}
      </Text>
    </PressableScale>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: {flex: 1, backgroundColor: c.background},
    flex: {flex: 1},
    container: {flex: 1, paddingHorizontal: spacing.xl},
    topBar: {flexDirection: 'row', alignItems: 'center', gap: spacing.md},
    body: {flex: 1, marginTop: spacing.xxl},
    subtitle: {marginTop: spacing.sm},
    field: {marginTop: spacing.xl},
    errorText: {marginTop: spacing.sm},
    // Skin 3 card: solid surface + hairline divider border (NOT the old glass).
    codeCardWrap: {marginTop: spacing.xl},
    codeCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
      backgroundColor: c.surfaceSunken,
      borderWidth: 1,
      borderColor: c.divider,
      borderRadius: radii.card,
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing.lg,
    },
    codeText: {
      fontFamily: fonts.medium,
      fontSize: 28,
      lineHeight: 32,
      letterSpacing: 6,
      color: c.textPrimary,
    },
    // No background — just the share glyph (the accent stays reserved).
    shareBtn: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tiles: {flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xl},
    tilePress: {flex: 1},
    tileInner: {alignItems: 'center', gap: spacing.xs},
    // Icon well: the sunken near-black fill + hairline border, not the accent.
    badge: {
      width: 64,
      height: 64,
      borderRadius: radii.card,
      backgroundColor: c.surfaceSunken,
      borderWidth: 1,
      borderColor: c.divider,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    badgeImg: {width: 46, height: 46},
    tileCaption: {marginTop: spacing.xs},
    tileLabel: {textAlign: 'center'},
    footer: {gap: spacing.md, alignItems: 'stretch'},
    skip: {alignSelf: 'center', paddingVertical: spacing.xs},
  });
