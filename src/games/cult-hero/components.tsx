/**
 * Cult Hero presentational atoms shared across the screen's phases: the prompt
 * header, your locked-in pick, and the one-by-one result reveal. Pure display
 * over plain props — no room, no engine, no network.
 */
import React from 'react';
import {Image, StyleSheet, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import {GlassCard, GlassTag, Text} from '../../core/ui';
import {colors, spacing} from '../../theme';
import {getById} from '../../data/football';
import {flagImage} from '../hattrick/criterionIcon';
import type {CultHeroResult} from './types';

/**
 * Flag + display name for a picked footballer. The raw id (a readable
 * "Surname, First") covers a device whose older dataset lacks the player.
 */
export function FootballerLine({footballerId}: {footballerId: string}) {
  const footballer = getById(footballerId);
  const flag = footballer ? flagImage(footballer.nationality[0]) : null;
  return (
    <View style={styles.playerRow}>
      {flag != null ? (
        <Image source={flag} resizeMode="contain" style={styles.flag} />
      ) : null}
      <Text variant="section" style={styles.playerName}>
        {footballer?.name ?? footballerId}
      </Text>
    </View>
  );
}

/** Round pill + the localized question, the header of every phase. */
export function PromptBlock({
  round,
  total,
  text,
  muted,
}: {
  round: number;
  total: number;
  /** Omit for phases where something else is the star (the leaderboard). */
  text?: string;
  /** De-emphasise the question (the reveal, where the results are the star). */
  muted?: boolean;
}) {
  const {t} = useTranslation();
  return (
    <>
      <GlassTag tint="light" style={styles.roundPill}>
        <Text variant="caption" color="muted" style={styles.roundText}>
          {t('cultHero.round', {round, total})}
        </Text>
      </GlassTag>
      {text === undefined ? null : muted ? (
        <Text variant="secondary" color="secondary" align="center">
          {text}
        </Text>
      ) : (
        <Text variant="section" align="center" style={styles.headline}>
          {text}
        </Text>
      )}
    </>
  );
}

/** The caller's locked-in pick while the table finishes answering. */
export function PickedAnswerCard({footballerId}: {footballerId: string}) {
  const {t} = useTranslation();
  return (
    <GlassCard style={styles.card}>
      <Text variant="caption" color="muted" align="center" style={styles.cardLabel}>
        {t('cultHero.answer.picked')}
      </Text>
      <FootballerLine footballerId={footballerId} />
    </GlassCard>
  );
}

/**
 * One revealed answer with its author and rarity score, plus progress dots.
 * The advance button lives in the screen (host-gated).
 */
export function ResultRevealCard({
  name,
  result,
  index,
  total,
}: {
  name: string;
  result: CultHeroResult;
  index: number;
  total: number;
}) {
  const {t} = useTranslation();
  const dots = [];
  for (let i = 0; i < total; i++) {
    dots.push(i);
  }
  return (
    <>
      <GlassCard style={styles.card}>
        <Text variant="caption" color="muted" align="center" style={styles.cardLabel}>
          {t('cultHero.results.answerBy', {name})}
        </Text>
        <FootballerLine footballerId={result.footballerId} />
        {result.valid ? (
          <>
            <Text variant="wordmark" align="center" style={styles.scoreUp}>
              {t('cultHero.results.points', {score: result.score})}
            </Text>
            {result.score > 0 ? (
              <Text variant="caption" color="muted" align="center">
                {t('cultHero.results.rarity', {score: result.score})}
              </Text>
            ) : null}
          </>
        ) : (
          <Text variant="section" align="center" style={styles.scoreZero}>
            {t('cultHero.results.invalid')}
          </Text>
        )}
      </GlassCard>
      <View style={styles.progress}>
        <View style={styles.dots}>
          {dots.map(i => (
            <View key={i} style={[styles.dot, i <= index && styles.dotDone]} />
          ))}
        </View>
        <Text variant="caption" color="muted">
          {t('cultHero.results.progress', {index: index + 1, total})}
        </Text>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  roundPill: {
    alignSelf: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  roundText: {letterSpacing: 1},
  headline: {color: colors.ink},
  card: {gap: spacing.sm, padding: spacing.lg},
  cardLabel: {letterSpacing: 1},
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  flag: {width: 22, height: 16, borderRadius: 2},
  playerName: {color: colors.ink},
  scoreUp: {color: colors.success},
  scoreZero: {color: colors.error},
  progress: {alignItems: 'center', gap: spacing.xs},
  dots: {flexDirection: 'row', gap: spacing.xs},
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.ink,
    opacity: 0.2,
  },
  dotDone: {opacity: 1},
});
