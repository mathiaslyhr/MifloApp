/**
 * The first-launch guided tour — a spotlight walkthrough of the app's map.
 *
 * Mounted once at the app root (App.tsx, NavigationContainer's sibling, like
 * ToastHost) so it floats above every screen AND the nav island. While a step
 * is showing, the screen dims behind four scrim views framing a cutout — the
 * spotlit element stays visible through the hole — and a coach card explains
 * it in a sentence. Next advances (tab steps switch the real tab first, so
 * the page is visible behind the card), Skip ends it; both persist
 * `app.tourSeen` so the tour runs once.
 *
 * Not an RN `Modal` on purpose: a Modal is its own native window and could
 * not sit under the spotlight math. Touches are swallowed by the scrim and a
 * transparent catcher over the cutout (an overlay scrim, same precedent as
 * ToastHost's expanded tap-catcher) — the tour guides, it never forces taps.
 *
 * Reduce Motion contract: the fades play, the card's rise doesn't.
 */
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import {useTranslation} from 'react-i18next';
import Svg, {Path} from 'react-native-svg';
import {
  motion,
  radii,
  spacing,
  useColors,
  useThemedStyles,
  type Palette,
} from '../../../theme';
import {navigationRef} from '../../navigation/navigationRef';
import {setTourSeen} from '../../settings/preferences';
import {Button} from '../Button';
import {CrestWall} from '../CrestWall';
import {PressableScale} from '../PressableScale';
import {StepProgress} from '../StepProgress';
import {Text} from '../Text';
import {getReduceMotion} from '../reduceMotion';
import {
  TOUR_STEPS,
  measureTourTarget,
  useTourStore,
  type TargetRect,
} from './tourStore';

/** Breathing room between the target's edge and the spotlight ring. */
const RING_PAD = 6;
/** Gap between the ring and the coach card. */
const CARD_GAP = spacing.lg;
/** How long to keep retrying a measurement while screens mount/settle. */
const MEASURE_TRIES = 15;
const MEASURE_RETRY_MS = 80;

export function TourOverlay(): React.JSX.Element | null {
  const active = useTourStore(s => s.active);
  const step = useTourStore(s => s.step);
  if (!active) {
    return null;
  }
  return <TourOverlayBody step={step} />;
}

/** A clockwise rounded-rect subpath — the spotlight hole in the scrim. */
function roundedRectPath(
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): string {
  const rr = Math.min(r, w / 2, h / 2);
  return [
    `M${x + rr} ${y}`,
    `H${x + w - rr}`,
    `A${rr} ${rr} 0 0 1 ${x + w} ${y + rr}`,
    `V${y + h - rr}`,
    `A${rr} ${rr} 0 0 1 ${x + w - rr} ${y + h}`,
    `H${x + rr}`,
    `A${rr} ${rr} 0 0 1 ${x} ${y + h - rr}`,
    `V${y + rr}`,
    `A${rr} ${rr} 0 0 1 ${x + rr} ${y}`,
    'Z',
  ].join(' ');
}

function TourOverlayBody({step}: {step: number}): React.JSX.Element | null {
  const {t} = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const colors = useColors();
  const {width: screenW, height: screenH} = useWindowDimensions();
  const next = useTourStore(s => s.next);
  const stop = useTourStore(s => s.stop);

  const def = TOUR_STEPS[step];
  // null while the step's target is being measured; centered steps render
  // immediately (rect stays null and the card centers on a full scrim).
  const [rect, setRect] = useState<TargetRect | null>(null);
  const [measured, setMeasured] = useState(def?.target == null);

  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardRise = useRef(new Animated.Value(0)).current;

  // Entering a step: make sure the right tab is on screen, then measure the
  // target. Home mounts lazily on first launch and a tab switch cross-fades
  // for motion.duration.slow, so the measurement retries across frames until
  // the element reports a real rectangle.
  useEffect(() => {
    let alive = true;
    setMeasured(def?.target == null);
    setRect(null);
    if (def == null) {
      return;
    }
    if (navigationRef.isReady()) {
      navigationRef.navigate('Tabs', {tab: def.tab, at: Date.now()});
    }
    if (def.target != null) {
      const target = def.target;
      (async () => {
        for (let i = 0; i < MEASURE_TRIES && alive; i++) {
          const found = await measureTourTarget(target);
          if (found != null) {
            if (alive) {
              setRect(found);
              setMeasured(true);
            }
            return;
          }
          await new Promise<void>(r => setTimeout(() => r(), MEASURE_RETRY_MS));
        }
        // Target never appeared (edge case: layout changed under the tour).
        // Fall back to a centered card rather than a stuck overlay.
        if (alive) {
          setMeasured(true);
        }
      })();
    }
    return () => {
      alive = false;
    };
  }, [def, step]);

  // The card fades (and rises, motion permitting) in on every step change.
  useEffect(() => {
    if (!measured) {
      return;
    }
    const reduceMotion = getReduceMotion();
    cardOpacity.setValue(0);
    cardRise.setValue(reduceMotion ? 0 : 8);
    Animated.parallel([
      Animated.timing(cardOpacity, {
        toValue: 1,
        duration: motion.duration.base,
        easing: motion.easing.out,
        useNativeDriver: true,
      }),
      Animated.timing(cardRise, {
        toValue: 0,
        duration: reduceMotion ? 0 : motion.duration.base,
        easing: motion.easing.out,
        useNativeDriver: true,
      }),
    ]).start();
  }, [cardOpacity, cardRise, measured, step]);

  const endTour = useCallback(() => {
    setTourSeen().catch(() => {});
    stop();
  }, [stop]);

  const playScout = useCallback(() => {
    endTour();
    if (navigationRef.isReady()) {
      navigationRef.navigate('Scout');
    }
  }, [endTour]);

  if (def == null) {
    return null;
  }
  const isLast = step === TOUR_STEPS.length - 1;
  const centered = def.target == null || (measured && rect == null);

  // Spotlight geometry: the ring's frame, padded out from the target. Radius
  // follows the lit element — a capsule for nav-pill items, the card radius
  // (plus the pad, so the curve stays concentric) for cards.
  const ring =
    rect == null
      ? null
      : {
          x: Math.max(0, rect.x - RING_PAD),
          y: Math.max(0, rect.y - RING_PAD),
          w: Math.min(screenW, rect.width + RING_PAD * 2),
          h: rect.height + RING_PAD * 2,
          r:
            def.ring === 'pill'
              ? (rect.height + RING_PAD * 2) / 2
              : radii.card + RING_PAD,
        };
  // Card above the ring when the target sits in the lower half (the nav
  // island), below it otherwise.
  const cardAbove = ring != null && ring.y + ring.h / 2 > screenH / 2;

  return (
    <View style={StyleSheet.absoluteFill}>
      {/* Swallow every touch, including inside the cutout — the tour guides;
          the spotlit element is visually live, not tappable. */}
      <Pressable
        style={StyleSheet.absoluteFill}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        onPress={() => {}}
      />
      {ring == null ? (
        <View style={[StyleSheet.absoluteFill, styles.scrim]} />
      ) : (
        <>
          {/* One scrim with an evenodd hole that matches the ring's rounded
              shape exactly — a rectangular cutout left undimmed grey corners
              around the pill ring (user report). Still no blur. */}
          <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
            <Path
              d={`M0 0H${screenW}V${screenH}H0Z ${roundedRectPath(
                ring.x,
                ring.y,
                ring.w,
                ring.h,
                ring.r,
              )}`}
              fill={colors.scrim}
              fillRule="evenodd"
            />
          </Svg>
          <View
            style={[
              styles.ring,
              {
                top: ring.y,
                left: ring.x,
                width: ring.w,
                height: ring.h,
                borderRadius: ring.r,
              },
            ]}
          />
        </>
      )}
      {centered ? (
        // Texture behind the two full-scrim bookend cards.
        <CrestWall count={24} size={42} opacity={0.05} />
      ) : null}
      {measured ? (
        <View
          pointerEvents="box-none"
          style={[
            styles.cardSlot,
            centered
              ? styles.cardCentered
              : cardAbove
                ? {bottom: screenH - (ring?.y ?? 0) + CARD_GAP}
                : {top: (ring?.y ?? 0) + (ring?.h ?? 0) + CARD_GAP},
          ]}>
          <Animated.View
            style={[
              styles.card,
              {opacity: cardOpacity, transform: [{translateY: cardRise}]},
            ]}>
            {/* Progress leads, like quick setup's header, not mid-card. */}
            <StepProgress step={step} total={TOUR_STEPS.length} />
            <Text variant="label">{t(`tour.steps.${def.key}.title`)}</Text>
            <Text variant="secondary" color="secondary" style={styles.body}>
              {t(`tour.steps.${def.key}.body`)}
            </Text>
            {isLast ? (
              <View style={styles.finishActions}>
                <Button label={t('tour.playScout')} onPress={playScout} />
                <PressableScale
                  onPress={endTour}
                  accessibilityRole="button"
                  style={styles.skip}>
                  <Text variant="secondary" color="secondary">
                    {t('tour.explore')}
                  </Text>
                </PressableScale>
              </View>
            ) : (
              <View style={styles.actions}>
                <PressableScale
                  onPress={endTour}
                  accessibilityRole="button"
                  accessibilityLabel={t('tour.skip')}
                  style={styles.skip}>
                  <Text variant="secondary" color="secondary">
                    {t('tour.skip')}
                  </Text>
                </PressableScale>
                <Button
                  label={t('tour.next')}
                  onPress={next}
                  fullWidth={false}
                  style={styles.nextBtn}
                />
              </View>
            )}
          </Animated.View>
        </View>
      ) : null}
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    scrim: {position: 'absolute', backgroundColor: c.scrim},
    // The spotlight ring: an accent hairline hugging the lit element. Its
    // borderRadius arrives inline, matched to the scrim hole's.
    ring: {
      position: 'absolute',
      borderWidth: 2,
      borderColor: c.primary,
    },
    cardSlot: {
      position: 'absolute',
      left: 0,
      right: 0,
      paddingHorizontal: spacing.lg,
      alignItems: 'center',
    },
    cardCentered: {top: 0, bottom: 0, justifyContent: 'center'},
    card: {
      alignSelf: 'stretch',
      gap: spacing.md,
      padding: spacing.xl,
      borderRadius: radii.card,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.divider,
    },
    body: {marginTop: -spacing.xs},
    actions: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: spacing.xs,
    },
    finishActions: {gap: spacing.md, marginTop: spacing.xs, alignItems: 'center'},
    // A quiet text control, but still a full 44pt target.
    skip: {paddingVertical: spacing.md, paddingHorizontal: spacing.xs},
    nextBtn: {minWidth: 120},
  });
