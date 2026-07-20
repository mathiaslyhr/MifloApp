/**
 * Root navigation types. The app is a native-stack: the `Tabs` route hosts the
 * Home/Daily/Play/Profile shell (its own local tab toggle), and screens
 * outside the chrome — Lobby, Join, the menu pages — are pushed on top.
 */
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {SocialProfile} from '../social/types';
import type {GameType} from '../../screens/gamesCatalog';
import type {TabId} from '../ui';

export type RootStackParamList = {
  /** `tab` jumps the shell to that page; `at` makes repeat jumps distinct
   * params so the effect refires. `addCode` arrives via the miflo.dk/add/CODE
   * deep link and opens Profile → Friends, which auto-sends the request. */
  Tabs: {tab?: TabId; at?: number; addCode?: string} | undefined;
  /** `code` arrives via the miflo.dk/join/CODE deep link → auto-join. */
  Join: {code?: string} | undefined;
  /** `invitedFriendId` pre-marks that friend as invited in the invite sheet
   * (the Friends-tab flow sends the push before landing here). */
  Lobby: {roomId: string; invitedFriendId?: string};
  // onPick is a function param (non-serializable, but this app never persists or
  // deep-links nav state): the host's startGame runs on select and resolves to
  // the game route to jump into (or undefined if the start was blocked/failed).
  GamePicker: {
    roomId: string;
    onPick: (
      gameType: string,
    ) => Promise<'Hattrick' | 'RedCard' | 'Offside' | 'CultHero' | undefined>;
  };
  /** "How do you want to play?" — the ways into one multiplayer game, on a
   * native sheet. Both choices replace it, so it never lingers in the stack. */
  GameMode: {gameType: GameType};
  Hattrick: {roomId: string};
  RedCard: {roomId: string};
  Offside: {roomId: string};
  CultHero: {roomId: string};
  /** Competitive Hattrick (ranked/ELO) — matchmaking then the live 1v1 match. */
  RankedSearch: undefined;
  RankedHattrick: {roomId: string};
  /** The ranked board: everyone (or just friends) by € value. */
  RankedLeaderboard: undefined;
  // Pass-and-play on one shared phone — roomless, fully offline.
  HattrickLocal: undefined;
  /** Solo Hattrick vs the computer — roomless, offline, difficulty picked
   * in-screen before the grid is dealt. */
  HattrickBot: undefined;
  RedCardLocal: undefined;
  OffsideLocal: undefined;
  CultHeroLocal: undefined;
  Scout: undefined;
  TopBins: undefined;
  Journeyman: undefined;
  Teamsheet: undefined;
  /** The old Menu tab's remainder, behind the Profile tab's hamburger. */
  Menu: undefined;
  /** Every friend you have, opened from the Profile header's friends line.
   * Holds the search, which is also the only way to add a friend by code. */
  /** Someone's friends. No params = mine (my code, add-by-code, swipe-remove);
   * a userId = a friend's list, which is browsable but not editable. */
  FriendsList: {userId: string; name: string} | undefined;
  /** The bell's feed: friend requests and party invites, newest first. */
  Notifications: undefined;
  /** A profile page — the profile travels for instant paint. `relation` is a
   * paint hint only: public_profile's is_friend is the authority, since you
   * might have become friends between the tap and the fetch. */
  FriendProfile: {profile: SocialProfile; relation?: 'friend' | 'stranger'};
  Settings: undefined;
  HowToPlay: undefined;
  About: undefined;
  /** Explains moving a profile to a new phone (the device-linking flow). */
  MoveToPhone: undefined;
};

/** Typed navigation prop for screens that push/pop the root stack. */
export type RootNavigation = NativeStackNavigationProp<RootStackParamList>;

/** Typed `useNavigation` for screens inside the tab shell (e.g. Home). */
export const useAppNavigation = () => useNavigation<RootNavigation>();
