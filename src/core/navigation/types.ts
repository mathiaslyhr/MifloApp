/**
 * Root navigation types. The app is a native-stack: the `Tabs` route hosts the
 * Home/Games/Friends/Profile shell (its own local tab toggle), and screens
 * outside the chrome — Lobby, Join, the menu pages — are pushed on top.
 */
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {SocialProfile} from '../social/types';

export type RootStackParamList = {
  /** `tab` jumps the shell to that page (friend-push taps land on Friends);
   * `at` makes repeat jumps distinct params so the effect refires. `addCode`
   * arrives via the miflo.dk/add/CODE deep link → Friends tab auto-sends the
   * friend request once the profile is ready. */
  Tabs: {tab?: 'social'; at?: number; addCode?: string} | undefined;
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
  Hattrick: {roomId: string};
  RedCard: {roomId: string};
  Offside: {roomId: string};
  CultHero: {roomId: string};
  // Pass-and-play on one shared phone — roomless, fully offline.
  HattrickLocal: undefined;
  RedCardLocal: undefined;
  OffsideLocal: undefined;
  CultHeroLocal: undefined;
  Scout: undefined;
  TopBins: undefined;
  Journeyman: undefined;
  Teamsheet: undefined;
  /** The old Menu tab's remainder, behind the Profile tab's hamburger. */
  Menu: undefined;
  /** A friend's profile page — the full profile travels for instant paint. */
  FriendProfile: {profile: SocialProfile};
  Settings: undefined;
  HowToPlay: undefined;
  About: undefined;
  OneDevice: undefined;
};

/** Typed navigation prop for screens that push/pop the root stack. */
export type RootNavigation = NativeStackNavigationProp<RootStackParamList>;

/** Typed `useNavigation` for screens inside the tab shell (e.g. Home). */
export const useAppNavigation = () => useNavigation<RootNavigation>();
