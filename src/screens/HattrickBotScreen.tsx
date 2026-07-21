import React, {useEffect, useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import {ChevronLeft} from 'lucide-react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../core/navigation';
import {Button, CircleButton, Screen, Text} from '../core/ui';
import {spacing, useColors, useThemedStyles, type Palette} from '../theme';
import {HattrickGameView} from '../games/hattrick/HattrickGameView';
import {generateGrid} from '../games/hattrick/grid';
import {
  advanceBoard,
  createIndividualState,
  proposeTie,
  respondTie,
  surrender,
} from '../games/hattrick/engine';
import {
  botCanMove,
  botMove,
  botThinkMs,
  type Difficulty,
} from '../games/hattrick/bot';
import type {GridState} from '../games/hattrick/types';

type Props = NativeStackScreenProps<RootStackParamList, 'HattrickBot'>;

/** Fixed local ids: the human seat and the AI seat sharing one board. */
const HUMAN_ID = 'p1';
const BOT_ID = 'bot';

const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];

/**
 * Play Hattrick against the computer — one seat is a bot, played entirely on
 * this device (no room, no network). It reuses the online `HattrickGameView`
 * perspective, which already makes the board interactive only on YOUR turn and
 * speaks the you/them beat voice; the bot's moves are computed by the pure
 * `botMove` reducer and committed with `setState` instead of an RPC.
 *
 * First stage is a difficulty pick; choosing it deals the grid and starts play.
 */
export function HattrickBotScreen({navigation}: Props) {
  const {t} = useTranslation();
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
  const [state, setState] = useState<GridState | null>(null);

  const start = (level: Difficulty) => {
    setDifficulty(level);
    setState(
      // The level tunes both halves: how well the bot plays (BOT_TIERS) and how
      // gentle the board itself is (BOARD_TIERS). `boardTier` rides on the
      // state so "Play again" deals another board of the same difficulty.
      createIndividualState(
        generateGrid(Math.random, {difficulty: level}),
        [
          {userId: HUMAN_ID, name: t('hattrick.bot.you')},
          {userId: BOT_ID, name: t('hattrick.bot.name')},
        ],
        {boardTier: level},
      ),
    );
  };

  // Drive the bot's turn: when the board is the bot's, wait a natural "think"
  // beat, then commit its move. This screen only mutates `state` through moves,
  // so exactly one timeout is ever live — schedule on the bot's turn, cancel on
  // cleanup. The setState guard re-checks it's still the bot's turn, and the
  // final `s`-returns keep the update a no-op otherwise (StrictMode-safe).
  useEffect(() => {
    if (!state || !difficulty || state.winner || state.turnUserId !== BOT_ID) {
      return;
    }
    const id = setTimeout(() => {
      setState(s =>
        s && !s.winner && s.turnUserId === BOT_ID
          ? botMove(s, BOT_ID, difficulty)
          : s,
      );
    }, botThinkMs(difficulty));
    return () => clearTimeout(id);
  }, [state, difficulty]);

  // The human proposes a tie from the board corner; the bot answers after a
  // short beat — it accepts only when it genuinely has no move left, otherwise
  // it declines (clearing the offer) and play resumes.
  const handleProposeTie = () => {
    if (!difficulty) {
      return;
    }
    setState(s => (s ? proposeTie(s, HUMAN_ID) : s));
    setTimeout(() => {
      setState(s => {
        if (!s || !s.tieOffer) {
          return s;
        }
        return respondTie(s, BOT_ID, !botCanMove(s, difficulty));
      });
    }, 800);
  };

  // The only tie response the human makes here is cancelling their own pending
  // offer (the overlay's Cancel), which just clears it.
  const handleRespondTie = (_accept: boolean) => {
    setState(s => (s && s.tieOffer ? respondTie(s, BOT_ID, false) : s));
  };

  if (!state) {
    return (
      <DifficultyPicker
        onPick={start}
        onBack={() => navigation.goBack()}
      />
    );
  }

  return (
    <HattrickGameView
      state={state}
      perspective={{kind: 'online', myUserId: HUMAN_ID}}
      onCommit={setState}
      onProposeTie={handleProposeTie}
      onRespondTie={handleRespondTie}
      onPlayAgain={() => setState(s => (s ? advanceBoard(s) : s))}
      onExit={() => navigation.goBack()}
      exitLabel={t('hattrick.local.exit')}
      onBack={() => navigation.goBack()}
      showResultActions
      onSurrender={() => setState(s => (s ? surrender(s, HUMAN_ID) : s))}
    />
  );
}

/** The pre-match difficulty choice — three tiers, a back to the Play tab. */
function DifficultyPicker({
  onPick,
  onBack,
}: {
  onPick: (level: Difficulty) => void;
  onBack: () => void;
}) {
  const {t} = useTranslation();
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  return (
    <Screen canvas>
      <View style={styles.header}>
        <CircleButton size={36} accessibilityLabel={t('hattrick.back')} onPress={onBack}>
          <ChevronLeft size={20} color={colors.ink} strokeWidth={2} />
        </CircleButton>
        <Text variant="wordmark" align="center" numberOfLines={1} style={styles.title}>
          {t('hattrick.bot.title')}
        </Text>
        <View style={{width: 36}} />
      </View>

      <View style={styles.body}>
        <Text variant="section" align="center" style={styles.prompt}>
          {t('hattrick.bot.chooseDifficulty')}
        </Text>
        <View style={styles.choices}>
          {DIFFICULTIES.map(level => (
            <View key={level} style={styles.choice}>
              <Button
                label={t(`hattrick.bot.${level}`)}
                variant={level === 'medium' ? 'primary' : 'secondary'}
                onPress={() => onPick(level)}
              />
              <Text variant="caption" color="secondary" align="center" style={styles.choiceHint}>
                {t(`hattrick.bot.${level}Hint`)}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </Screen>
  );
}

const makeStyles = (_c: Palette) =>
  StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      height: 44,
      marginTop: spacing.sm,
      gap: spacing.sm,
    },
    title: {flex: 1},
    body: {flex: 1, justifyContent: 'center'},
    prompt: {marginBottom: spacing.xl},
    choices: {gap: spacing.lg},
    choice: {gap: spacing.xs},
    choiceHint: {},
  });
