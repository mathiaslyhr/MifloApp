/**
 * Shared UI primitives barrel — the design system components.
 * `import {Screen, Button, Text} from '../core/ui';`
 */
export {Screen} from './Screen';
export {BootSplash} from './BootSplash';
export {ErrorBoundary} from './ErrorBoundary';
export {BOARD_TEXT_SCALE, Text} from './Text';
export {Button} from './Button';
export type {ButtonVariant} from './Button';
export {CircleButton} from './CircleButton';
export {GameTile} from './GameTile';
export {SwipeReveal, closeOpenSwipeReveal} from './SwipeReveal';
export {Card} from './Card';
export {Skeleton} from './Skeleton';
export {Tag} from './Tag';
export {Segmented, segmentedThumb} from './Segmented';
export type {SegmentedOption} from './Segmented';
export {MenuRow} from './MenuRow';
export type {MenuRowKind} from './MenuRow';
export {MenuGroup} from './MenuGroup';
export {Avatar, initialsFor} from './Avatar';
export {TextField} from './TextField';
export {NameSheet} from './NameSheet';
export {HowToPlayModal} from './HowToPlayModal';
export type {HelpLine} from './HowToPlayModal';
export {IslandTabBar, NAV_HEIGHT} from './IslandTabBar';
export type {TabId} from './IslandTabBar';
export {FloatingBar} from './FloatingBar';
export {EdgeFade, useEdgeFades, EDGE_FADE_HEIGHT} from './EdgeFade';
export {QrCard} from './QrCard';
export {PressableScale} from './PressableScale';
export {AppMark} from './AppMark';
export {usePressScale} from './usePressScale';
export {
  getReduceMotion,
  useReduceMotion,
  initReduceMotion,
} from './reduceMotion';
export {ToastHost} from './toast/ToastHost';
export {toast, useToast, useToastStore} from './toast/toastStore';
export type {Toast, ToastTone, ToastOptions} from './toast/toastStore';
