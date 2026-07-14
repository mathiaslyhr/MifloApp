import React, {useCallback, useEffect, useRef, useState} from 'react';
import {Alert, ScrollView, Share, StyleSheet, View} from 'react-native';
import {Check, ChevronLeft, User, UserMinus, UserPlus} from 'lucide-react-native';
import {useTranslation} from 'react-i18next';
import {JOIN_URL_BASE} from '../core/config';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useFocusEffect} from '@react-navigation/native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {
  Avatar,
  Button,
  CircleButton,
  FloatingBar,
  initialsFor,
  NameSheet,
  PressableScale,
  Screen,
  Skeleton,
  Text,
  toast,
} from '../core/ui';
import {haptics} from '../core/haptics';
import {Sentry, isSentryEnabled} from '../core/observability/sentry';
import {InviteFriendsSheet} from './lobby/InviteFriendsSheet';
import {
  avatarUrlFor,
  fetchFriends,
  sendFriendPush,
  sendFriendRequestByUserId,
} from '../core/social/socialService';
import type {SocialProfile} from '../core/social/types';
import {requestPushPermissionAndSync} from '../core/notifications/pushInvites';
import {
  radii,
  screenPadding,
  spacing,
  useColors,
  useThemedStyles,
  type Palette,
} from '../theme';
import type {RootStackParamList} from '../core/navigation';
import {
  kickPlayer,
  leaveRoom,
  renamePlayer,
  startBoardGame,
  startCultHeroGame,
  startOffsideGame,
  startRedCardGame,
  subscribePlayers,
  subscribeRoom,
} from '../core/rooms/roomService';
import {
  createConnectionNotifier,
  notifyPartyClosed,
} from '../core/rooms/connectionStatus';
import {ensureSession} from '../core/supabase/client';
import {generateGrid, gridSignature} from '../games/hattrick/grid';
import {createIndividualState} from '../games/hattrick/engine';
import {buildFootballerPool} from '../games/red-card/engine';
import {takeSessionQuestions} from '../games/red-card/questions';
import {
  DEFAULT_ROUNDS as RED_CARD_DEFAULT_ROUNDS,
  MIN_PLAYERS as IMPOSTER_MIN,
} from '../games/red-card/types';
import {buildRounds} from '../games/offside/questions';
import {DEFAULT_ROUNDS as OFFSIDE_DEFAULT_ROUNDS} from '../games/offside/types';
import {buildPromptPayloads} from '../games/cult-hero/famePrior';
import {takeSessionPrompts} from '../games/cult-hero/prompts';
import {DEFAULT_ROUNDS as CULT_HERO_DEFAULT_ROUNDS} from '../games/cult-hero/types';
import type {Room, RoomPlayer} from '../core/rooms/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Lobby'>;

/** The live-game screens the host jumps into once a round is built. */
export type GameRoute = 'Hattrick' | 'RedCard' | 'Offside' | 'CultHero';

/**
 * Lobby — where players gather after a match is created. Shows the join code (the
 * whole pill shares it) and a live list of players. Tap your own name to rename
 * yourself; the host taps another name to kick or add them as a friend. The host
 * picks the game from here — "Pick game" opens the games screen, which builds the
 * round and drops every device into it.
 *
 * A match is always free-pick (created game-less from Home); there's no locked
 * mode here. Free-pick starts each game on its default round count.
 */
export function LobbyScreen({route, navigation}: Props) {
  const {roomId} = route.params;
  const {t} = useTranslation();
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<RoomPlayer[]>([]);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [starting, setStarting] = useState(false);
  const insets = useSafeAreaInsets();
  // Measured height of the floating bottom bar, so scroll content clears it.
  const [botH, setBotH] = useState(0);
  // Host selection: the roster card whose actions (kick / add friend / profile)
  // are open. Only the host ever selects another player; null = nothing open.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // My friends, keyed by their uid — drives the "Friends ✓ + view profile" vs
  // "Add friend" fork, and supplies the full profile for the profile screen.
  const [friends, setFriends] = useState<Record<string, SocialProfile>>({});
  // Players I've just sent a request to this session (uid → true), so the button
  // reads "Requested" without waiting for a refetch.
  const [requested, setRequested] = useState<Record<string, true>>({});
  // Guards a double-tap on Add friend while the RPC is in flight.
  const [adding, setAdding] = useState<string | null>(null);

  // Track membership so we can detect being kicked (present → gone).
  const wasPresentRef = useRef(false);
  const kickedRef = useRef(false);
  // Guards the one-shot exit to the menu when the match closes (host left).
  const closedRef = useRef(false);
  // Guards the one-shot navigation into the game when it starts.
  const inGameRef = useRef(false);
  // Match-session memory (host device): who opened the last game and the last few
  // grids, so consecutive rounds don't repeat the starter or the board.
  const lastStarterRef = useRef<string | null>(null);
  const recentGridsRef = useRef<string[]>([]);

  useEffect(() => {
    ensureSession()
      .then(setMyUserId)
      .catch(() => {});
    // One notifier for both channels, so a single outage toasts once.
    const notifyStatus = createConnectionNotifier();
    const unsubPlayers = subscribePlayers(roomId, setPlayers, notifyStatus);
    // Host left → the room is deleted; no host, no match. Return to the menu.
    const unsubRoom = subscribeRoom(
      roomId,
      setRoom,
      ({selfIsHost}) => {
        if (!closedRef.current) {
          closedRef.current = true;
          notifyPartyClosed(selfIsHost);
          navigation.popToTop();
        }
      },
      notifyStatus,
    );
    return () => {
      unsubPlayers();
      unsubRoom();
    };
  }, [roomId, navigation]);

  // Leave the match whenever this screen is popped (back button, swipe, or the
  // kicked auto-goBack). Fire-and-forget; the RPC is idempotent, so the already
  // kicked/gone case is harmless. Host leaving closes the match for everyone.
  useEffect(() => {
    const unsub = navigation.addListener('beforeRemove', () => {
      leaveRoom(roomId).catch(() => {});
    });
    return unsub;
  }, [navigation, roomId]);

  // When the host starts a game, every device follows the room into it. When it
  // returns to the lobby, reset so the next round can navigate again.
  useEffect(() => {
    if (!room) {
      return;
    }
    if (room.status === 'in_progress' && room.gameType === 'hattrick') {
      if (!inGameRef.current) {
        inGameRef.current = true;
        navigation.navigate('Hattrick', {roomId});
      }
    } else if (room.status === 'in_progress' && room.gameType === 'red-card') {
      if (!inGameRef.current) {
        inGameRef.current = true;
        navigation.navigate('RedCard', {roomId});
      }
    } else if (room.status === 'in_progress' && room.gameType === 'offside') {
      if (!inGameRef.current) {
        inGameRef.current = true;
        navigation.navigate('Offside', {roomId});
      }
    } else if (room.status === 'in_progress' && room.gameType === 'cult-hero') {
      if (!inGameRef.current) {
        inGameRef.current = true;
        navigation.navigate('CultHero', {roomId});
      }
    } else if (room.status === 'lobby') {
      inGameRef.current = false;
      setStarting(false);
    }
  }, [room, navigation, roomId]);

  const isHost = !!room && !!myUserId && room.hostId === myUserId;
  const me = players.find(p => p.userId === myUserId);

  // Load my friends once per focus so the roster can tell friends (Friends ✓ +
  // view profile) from strangers (Add friend). Silent on failure — an empty map
  // just means everyone reads as "not yet a friend".
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      fetchFriends()
        .then(list => {
          if (!alive) {
            return;
          }
          const byId: Record<string, SocialProfile> = {};
          for (const f of list) {
            byId[f.userId] = f;
          }
          setFriends(byId);
        })
        .catch(() => {});
      return () => {
        alive = false;
      };
    }, []),
  );

  // Kicked-out detection: once we've been seen in the roster, disappearing from
  // it means the host removed us — leave the lobby.
  useEffect(() => {
    if (!myUserId || players.length === 0) {
      return;
    }
    if (players.some(p => p.userId === myUserId)) {
      wasPresentRef.current = true;
      return;
    }
    if (wasPresentRef.current && !kickedRef.current) {
      kickedRef.current = true;
      navigation.goBack();
      Alert.alert(t('common.miflo'), t('lobby.kicked'));
    }
  }, [players, myUserId, navigation, t]);

  // A guest who backed out of a still-running game re-enters it manually. The
  // auto-nav effect above won't do it (inGameRef stays true until the room
  // returns to the lobby), but a direct navigate isn't blocked by that guard.
  function rejoinGame() {
    if (room?.gameType === 'hattrick') {
      navigation.navigate('Hattrick', {roomId});
    } else if (room?.gameType === 'red-card') {
      navigation.navigate('RedCard', {roomId});
    } else if (room?.gameType === 'offside') {
      navigation.navigate('Offside', {roomId});
    } else if (room?.gameType === 'cult-hero') {
      navigation.navigate('CultHero', {roomId});
    }
  }

  async function shareCode() {
    if (!room?.code) {
      return;
    }
    try {
      await Share.share({
        message: t('lobby.shareMessage', {
          code: room.code,
          link: `${JOIN_URL_BASE}/${room.code}`,
        }),
      });
    } catch {
      // User dismissed the share sheet; nothing to do.
    }
  }

  function onPressPlayer(p: RoomPlayer) {
    if (p.userId === myUserId) {
      // Tapping yourself renames — no action row.
      setSelectedId(null);
      setRenameOpen(true);
    } else if (isHost) {
      // Toggle this player's action row (kick / add friend / view profile).
      setSelectedId(cur => (cur === p.id ? null : p.id));
    }
  }

  // Host removes a player.
  function confirmKick(p: RoomPlayer) {
    Alert.alert(t('lobby.removeTitle'), t('lobby.removeConfirm', {name: p.name}), [
      {text: t('common.cancel'), style: 'cancel'},
      {
        text: t('common.remove'),
        style: 'destructive',
        onPress: () => {
          setSelectedId(null);
          kickPlayer(roomId, p.userId).catch(() =>
            Alert.alert(t('common.miflo'), t('lobby.errorRemove', {name: p.name})),
          );
        },
      },
    ]);
  }

  // Host befriends a roster player. 0033 lets us request by uid (the roster has
  // no friend code); outcomes mirror the Friends-tab send flow.
  async function addFriend(p: RoomPlayer) {
    if (adding) {
      return;
    }
    setAdding(p.id);
    try {
      const {outcome, friend} = await sendFriendRequestByUserId(p.userId);
      const name = friend.displayName || p.name;
      switch (outcome) {
        case 'requested':
          haptics.success();
          toast.success(t('social.requestSent', {name}));
          sendFriendPush('friend_request', friend.userId).catch(() => {});
          setRequested(cur => ({...cur, [p.userId]: true}));
          break;
        case 'autoAccepted':
          // Their pending ask + ours fused into a friendship on the spot.
          haptics.success();
          toast.success(t('social.friendAdded', {name}));
          sendFriendPush('request_accepted', friend.userId).catch(() => {});
          setFriends(cur => ({...cur, [friend.userId]: friend}));
          break;
        case 'alreadyRequested':
          toast.neutral(t('social.requestAlreadySent', {name}));
          setRequested(cur => ({...cur, [p.userId]: true}));
          break;
        case 'alreadyFriends':
          toast.neutral(t('social.alreadyFriends', {name}));
          setFriends(cur => ({...cur, [friend.userId]: friend}));
          break;
      }
      // Sending is also when this phone becomes push-reachable for the reply.
      requestPushPermissionAndSync().catch(() => {});
    } catch {
      haptics.error();
      toast.error(t('social.errorRequest'));
    } finally {
      setAdding(null);
    }
  }

  // Open an existing friend's profile (only friends have a fetchable profile).
  function viewProfile(profile: SocialProfile) {
    setSelectedId(null);
    navigation.navigate('FriendProfile', {profile});
  }

  async function submitRename(name: string) {
    setRenameOpen(false);
    try {
      await renamePlayer(roomId, name);
    } catch {
      Alert.alert(t('common.miflo'), t('lobby.errorRename'));
    }
  }

  // Host starts a specific game: build its initial state from the roster, then
  // hand every device into the game via the room. Called by the game picker,
  // which navigates the host into the returned screen; guests follow via the
  // auto-nav effect. Free-pick uses each game's default round count.
  async function startGame(gameType: string): Promise<GameRoute | undefined> {
    if (players.length < 2 || starting) {
      return undefined;
    }
    setStarting(true);
    try {
      switch (gameType) {
        case 'hattrick': {
          const grid = generateGrid(Math.random, {avoid: recentGridsRef.current});
          const roster = players.map(p => ({userId: p.userId, name: p.name}));
          const state = createIndividualState(grid, roster, {
            avoidStarter: lastStarterRef.current ?? undefined,
          });
          // Remember for next round (keep the last 5 grids).
          lastStarterRef.current = state.turnUserId;
          recentGridsRef.current = [
            gridSignature(grid),
            ...recentGridsRef.current,
          ].slice(0, 5);
          await startBoardGame(roomId, 'hattrick', state);
          // The host drives its own screen (the caller navigates); flag it so the
          // auto-nav effect below stays a guests-only path and never re-enters.
          inGameRef.current = true;
          return 'Hattrick';
        }
        case 'red-card': {
          // Needs more players than Hattrick (1 imposter + ≥2 detectives to make
          // voting meaningful). Roles are assigned server-side; the host only
          // ships the candidate footballer pool.
          if (players.length < IMPOSTER_MIN) {
            setStarting(false);
            haptics.warning();
            toast.neutral(t('lobby.needPlayers', {count: IMPOSTER_MIN}));
            return undefined;
          }
          await startRedCardGame(
            roomId,
            buildFootballerPool(),
            RED_CARD_DEFAULT_ROUNDS,
            takeSessionQuestions(roomId, RED_CARD_DEFAULT_ROUNDS),
          );
          inGameRef.current = true;
          return 'RedCard';
        }
        case 'offside': {
          // The host builds the deck; the generator never reuses a player, so a
          // capped pool just means a shorter game — ship the actual length.
          const deck = buildRounds(OFFSIDE_DEFAULT_ROUNDS);
          if (deck.length === 0) {
            throw new Error('Offside deck came back empty');
          }
          await startOffsideGame(roomId, deck, deck.length);
          inGameRef.current = true;
          return 'Offside';
        }
        case 'cult-hero': {
          // The host deals the prompts and ships each one's eligible players with
          // fame priors; picks are collected and scored server-side.
          await startCultHeroGame(
            roomId,
            CULT_HERO_DEFAULT_ROUNDS,
            buildPromptPayloads(takeSessionPrompts(roomId, CULT_HERO_DEFAULT_ROUNDS)),
          );
          inGameRef.current = true;
          return 'CultHero';
        }
        default:
          throw new Error(`Unsupported game: ${gameType}`);
      }
    } catch (err) {
      setStarting(false);
      console.warn('startGame failed', err);
      if (isSentryEnabled) {
        Sentry.captureException(err);
      }
      haptics.error();
      toast.error(t('lobby.errorStart'));
    }
  }

  return (
    // Drop top/bottom safe-area edges — the scroll content owns the top inset
    // (the code pill scrolls under the chrome) and the bottom bar owns the
    // bottom inset.
    <Screen canvas edges={['left', 'right']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.body,
          {paddingTop: insets.top + spacing.sm, paddingBottom: botH + spacing.xl},
        ]}
        showsVerticalScrollIndicator={false}>
        {/* Code card — one full-round pill showing the code; the whole card is
            the share button (tap it to open the share sheet). */}
        <PressableScale
          onPress={shareCode}
          accessibilityRole="button"
          accessibilityLabel={t('lobby.shareCode')}>
          <View style={styles.codeCard}>
            <Text
              variant="hero"
              align="center"
              color="accent"
              style={styles.code}
              accessibilityLabel={t('lobby.code')}>
              {room?.code ?? '····'}
            </Text>
          </View>
        </PressableScale>

        {/* Players — section header + a joined count. */}
        <View style={styles.playersHeader}>
          <Text variant="caption" color="secondary" style={styles.playersLabel}>
            {t('lobby.players').toUpperCase()}
          </Text>
          {players.length > 0 ? (
            <Text variant="caption" color="secondary">
              {t('lobby.joined', {count: players.length})}
            </Text>
          ) : null}
        </View>

        {/* Roster — a vertical list of player cards. Tap yours to rename; the
            host taps another to open kick / add friend / view profile. */}
        <View style={styles.roster}>
          {players.length === 0 ? (
            // Ghost cards while the roster primes over realtime.
            <View
              style={styles.roster}
              accessibilityLabel={t('lobby.waitingFriends')}>
              <Skeleton height={72} radius={radii.card} />
              <Skeleton height={72} radius={radii.card} />
            </View>
          ) : null}
          {players.map(p => {
            const isMe = p.userId === myUserId;
            const actionable = isMe || isHost;
            const selected = selectedId === p.id;
            const friendProfile = friends[p.userId];
            const badge =
              p.isHost && isMe
                ? t('lobby.hostYou')
                : p.isHost
                ? t('lobby.hostLabel')
                : isMe
                ? t('lobby.you')
                : null;
            return (
              <View key={p.id}>
                <PressableScale
                  onPress={() => onPressPlayer(p)}
                  disabled={!actionable}
                  accessibilityRole={actionable ? 'button' : undefined}
                  accessibilityLabel={
                    (isMe
                      ? t('lobby.changeName')
                      : isHost
                      ? t('lobby.removeName', {name: p.name})
                      : p.name) + (p.isHost ? `, ${t('lobby.host')}` : '')
                  }>
                  <View
                    style={[
                      styles.playerCard,
                      selected && styles.playerCardSelected,
                    ]}>
                    <Avatar
                      initials={initialsFor(p.name)}
                      tone={isMe ? 'accent' : 'soft'}
                      size={44}
                      uri={avatarUrlFor(p.avatarPath)}
                    />
                    <Text
                      variant="section"
                      style={styles.nameText}
                      numberOfLines={1}>
                      {p.name}
                    </Text>
                    {badge ? (
                      <View style={styles.badge}>
                        <Text
                          variant="caption"
                          color="accent"
                          style={styles.badgeText}>
                          {badge}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </PressableScale>

                {/* Host action row for the selected (non-self) player. */}
                {selected && isHost && !isMe ? (
                  <View style={styles.actionRow}>
                    {friendProfile ? (
                      <>
                        <View style={[styles.actionPill, styles.friendsPill]}>
                          <Check size={16} color={colors.primary} strokeWidth={2.25} />
                          <Text variant="label" color="primary">
                            {t('lobby.friends')}
                          </Text>
                        </View>
                        <PressableScale
                          onPress={() => viewProfile(friendProfile)}
                          accessibilityRole="button">
                          <View style={styles.actionPill}>
                            <User size={16} color={colors.primary} strokeWidth={2.25} />
                            <Text variant="label" color="primary">
                              {t('lobby.viewProfile')}
                            </Text>
                          </View>
                        </PressableScale>
                      </>
                    ) : requested[p.userId] ? (
                      <View style={[styles.actionPill, styles.friendsPill]}>
                        <Check size={16} color={colors.textSecondary} strokeWidth={2.25} />
                        <Text variant="label" color="secondary">
                          {t('lobby.requested')}
                        </Text>
                      </View>
                    ) : (
                      <PressableScale
                        onPress={() => addFriend(p)}
                        disabled={adding === p.id}
                        accessibilityRole="button">
                        <View style={styles.actionPill}>
                          <UserPlus size={16} color={colors.primary} strokeWidth={2.25} />
                          <Text variant="label" color="primary">
                            {t('lobby.addFriend')}
                          </Text>
                        </View>
                      </PressableScale>
                    )}
                    <PressableScale
                      onPress={() => confirmKick(p)}
                      accessibilityRole="button">
                      <View style={[styles.actionPill, styles.kickPill]}>
                        <UserMinus size={16} color={colors.error} strokeWidth={2.25} />
                        <Text variant="label" style={{color: colors.error}}>
                          {t('lobby.kick')}
                        </Text>
                      </View>
                    </PressableScale>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* Pinned floating chrome (top) — back on the left, invite on the right,
          both stay reachable while the code pill scrolls away. */}
      <FloatingBar edge="top" style={styles.backBar}>
        <View style={styles.backRow}>
          <CircleButton
            size={40}
            accessibilityLabel={t('lobby.leave')}
            onPress={() => navigation.goBack()}>
            <ChevronLeft size={20} color={colors.textPrimary} strokeWidth={2} />
          </CircleButton>
          <CircleButton
            size={40}
            accessibilityLabel={t('lobby.inviteFriends')}
            onPress={() => setInviteOpen(true)}>
            <UserPlus size={20} color={colors.textPrimary} strokeWidth={2} />
          </CircleButton>
        </View>
      </FloatingBar>

      {/* Floating footer — the host's "Pick game" button (or guest hint) floats
          over the roster with no box behind it. */}
      <FloatingBar edge="bottom" onHeight={setBotH} style={styles.footer}>
        {isHost && players.length <= 1 ? (
          // Alone in the lobby — nudge the host that a game needs others.
          <Text
            variant="secondary"
            color="secondary"
            align="center"
            style={styles.waitingHint}>
            {t('lobby.waitingPlayers')}
          </Text>
        ) : null}
        {isHost ? (
          <Button
            label={starting ? t('lobby.starting') : t('lobby.pickGame')}
            variant="primary"
            disabled={players.length < 2 || starting}
            onDisabledPress={() => {
              if (starting) {
                return;
              }
              haptics.warning();
              toast.neutral(t('lobby.needPlayersPick', {count: 2}));
            }}
            onPress={() =>
              navigation.navigate('GamePicker', {roomId, onPick: startGame})
            }
          />
        ) : room?.status === 'in_progress' ? (
          <Button label={t('lobby.rejoin')} variant="primary" onPress={rejoinGame} />
        ) : (
          <Text variant="secondary" color="secondary" align="center">
            {t('lobby.waitingHostPick')}
          </Text>
        )}
      </FloatingBar>

      <InviteFriendsSheet
        visible={inviteOpen}
        code={room?.code ?? null}
        onClose={() => setInviteOpen(false)}
        onShareFallback={() => {
          setInviteOpen(false);
          shareCode();
        }}
        initialInvitedId={route.params.invitedFriendId}
      />

      <NameSheet
        visible={renameOpen}
        title={t('lobby.renameTitle')}
        initialValue={me?.name ?? ''}
        placeholder={t('lobby.namePlaceholder')}
        confirmLabel={t('common.save')}
        onConfirm={submitRename}
        onCancel={() => setRenameOpen(false)}
      />
    </Screen>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    // Pinned floating chrome, aligned to the top row: back left, invite right.
    backBar: {paddingHorizontal: screenPadding},
    backRow: {
      height: 44,
      marginTop: spacing.sm,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    scroll: {flex: 1},
    body: {
      gap: spacing.xl,
    },
    // Code card — one full-round pill (surface2) with the purple code; the whole
    // pill is the share button. Dropped well below the top chrome.
    codeCard: {
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: spacing.xxxl,
      backgroundColor: c.surface2,
      borderRadius: radii.pill,
      paddingVertical: spacing.xl,
      paddingHorizontal: spacing.xl,
    },
    code: {letterSpacing: 8},
    // Players section header: label left, joined count right.
    playersHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    playersLabel: {letterSpacing: 1},
    // Vertical roster of player cards.
    roster: {gap: spacing.sm},
    // Player card: sunken near-black ground + hairline inset border.
    playerCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      backgroundColor: c.surfaceSunken,
      borderWidth: 1,
      borderColor: c.divider,
      borderRadius: radii.card,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
    },
    // Tapped (host-selected) card gets the purple rim.
    playerCardSelected: {borderColor: c.primary},
    nameText: {flex: 1},
    // Host · You badge on the right of the card (surface2 fill, purple label).
    badge: {
      backgroundColor: c.surface2,
      borderRadius: radii.pill,
      paddingHorizontal: spacing.md,
      paddingVertical: 4,
    },
    badgeText: {letterSpacing: 0.2},
    // Action row under a host-selected player card.
    actionRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginTop: spacing.sm,
      paddingLeft: spacing.xs,
    },
    actionPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      backgroundColor: c.surface2,
      borderRadius: radii.pill,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    // Neutral (non-primary) pills sit on the sunken ground with a hairline rim.
    friendsPill: {
      backgroundColor: c.surfaceSunken,
      borderWidth: 1,
      borderColor: c.divider,
    },
    kickPill: {
      backgroundColor: c.surfaceSunken,
      borderWidth: 1,
      borderColor: c.divider,
    },
    // Only top padding for vertical rhythm — FloatingBar owns the bottom safe-area
    // inset. Horizontal padding matches the scrolled content.
    footer: {
      paddingTop: spacing.md,
      paddingHorizontal: screenPadding,
    },
    // "Waiting for other players" line sitting above the (disabled) button.
    waitingHint: {marginBottom: spacing.md},
  });
