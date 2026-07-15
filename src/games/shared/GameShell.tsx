/**
 * The chrome every game screen wears, in one place.
 *
 * The grammar (same as the dailies): the wordmark sits IN the scroll flow so it
 * scrolls away, while back/help stay pinned as floating corner circles on a
 * transparent bar. No frost, no blur, no status strip — content scrolls clean
 * under the clock.
 *
 * Six game screens hand-rolled this identically, down to the style names. It
 * lives here now so a GameView is only its phases.
 */
import React, {useState} from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import {ChevronLeft, HelpCircle} from 'lucide-react-native';
import {
  CircleButton,
  FloatingBar,
  HowToPlayModal,
  Screen,
  Text,
} from '../../core/ui';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {screenPadding, spacing, useColors} from '../../theme';

export function GameShell({
  title,
  backLabel,
  onBack,
  help,
  topAlign = false,
  children,
}: {
  /** The wordmark. Scrolls away with the content. */
  title: string;
  /** Also the back circle's accessibility label — online "Back to lobby", local "Exit". */
  backLabel: string;
  onBack: () => void;
  /** Omit to hide the help circle. */
  help?: {title: string; lines: {text: string}[]};
  /**
   * Tall content (final standings) top-aligns and scrolls normally; short
   * phases centre in the space below the header.
   */
  topAlign?: boolean;
  children: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const [showHelp, setShowHelp] = useState(false);

  return (
    // Drop the top safe-area edge — the scroll content owns the top inset so the
    // wordmark scrolls away; back/help stay pinned as floating corner buttons.
    <Screen canvas edges={['left', 'right', 'bottom']}>
      {/* Lifts centred content above the keyboard while typing (names, answers).
          Inert when nothing is focused, so every game can keep it on. */}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[
            styles.body,
            {paddingTop: insets.top + spacing.sm},
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.titleHeader}>
            <Text variant="wordmark" align="center">
              {title}
            </Text>
          </View>

          <View style={[styles.phaseWrap, topAlign && styles.phaseWrapTop]}>
            {children}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <FloatingBar edge="top" style={styles.chromeBar}>
        <View style={styles.chromeRow}>
          <CircleButton size={36} accessibilityLabel={backLabel} onPress={onBack}>
            <ChevronLeft size={20} color={colors.ink} strokeWidth={2} />
          </CircleButton>
          <View style={styles.chromeSpacer} />
          {help ? (
            <CircleButton
              size={36}
              accessibilityLabel={help.title}
              onPress={() => setShowHelp(true)}>
              <HelpCircle size={18} color={colors.ink} strokeWidth={2} />
            </CircleButton>
          ) : null}
        </View>
      </FloatingBar>

      {help ? (
        <HowToPlayModal
          visible={showHelp}
          onClose={() => setShowHelp(false)}
          title={help.title}
          lines={help.lines}
        />
      ) : null}
    </Screen>
  );
}

/** The phase's own column: one gap, stretched children. Games compose into it. */
export const phaseStyles = StyleSheet.create({
  phase: {gap: spacing.lg, alignItems: 'stretch'},
  resultActions: {gap: spacing.md, marginTop: spacing.sm},
});

const styles = StyleSheet.create({
  flex: {flex: 1},
  // Scroll-away wordmark row.
  titleHeader: {height: 44, alignItems: 'center', justifyContent: 'center'},
  // Pinned floating corner buttons (back left, help right).
  chromeBar: {paddingHorizontal: screenPadding},
  chromeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    marginTop: spacing.sm,
  },
  chromeSpacer: {flex: 1},
  body: {flexGrow: 1, paddingBottom: spacing.xl, gap: spacing.lg},
  // Centres the active phase in the space between the header and the bottom.
  phaseWrap: {flex: 1, justifyContent: 'center'},
  phaseWrapTop: {justifyContent: 'flex-start'},
});
