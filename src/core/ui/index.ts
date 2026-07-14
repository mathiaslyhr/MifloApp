/**
 * Shared UI primitives barrel — the design system components.
 * `import {Screen, Button, Text} from '../core/ui';`
 */
export {Screen} from './Screen';
export {ErrorBoundary} from './ErrorBoundary';
export {Text} from './Text';
export {Button} from './Button';
export type {ButtonVariant} from './Button';
export {CircleButton} from './CircleButton';
export {GameTile} from './GameTile';
export {SwipeReveal, closeOpenSwipeReveal} from './SwipeReveal';
export {GlassCard} from './GlassCard';
export {Skeleton} from './Skeleton';
export {GlassTag} from './GlassTag';
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
export {AppBlur} from './Blur';
export {TopStatusFade} from './TopStatusFade';
export {QrCard} from './QrCard';
export {PressableScale} from './PressableScale';
export {AppMark} from './AppMark';
export {usePressScale} from './usePressScale';
export {ToastHost} from './toast/ToastHost';
export {toast, useToast, useToastStore} from './toast/toastStore';
export type {Toast, ToastTone, ToastOptions} from './toast/toastStore';
