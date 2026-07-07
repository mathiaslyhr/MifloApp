/**
 * PageHeader — the standard pushed-screen top bar: a back button on the left and
 * a centered wordmark title (the right spacer matches the button so the title
 * stays optically centred). Used by the Menu detail pages.
 */
import React from 'react';
import {StyleSheet, View} from 'react-native';
import {ChevronLeft} from 'lucide-react-native';
import {colors, spacing} from '../../theme';
import {CircleButton} from './CircleButton';
import {Text} from './Text';

type Props = {
  title: string;
  onBack: () => void;
  backLabel?: string;
};

export function PageHeader({title, onBack, backLabel = 'Back'}: Props) {
  return (
    <View style={styles.header}>
      <CircleButton size={36} accessibilityLabel={backLabel} onPress={onBack}>
        <ChevronLeft size={20} color={colors.ink} strokeWidth={2} />
      </CircleButton>
      <Text variant="wordmark" align="center" numberOfLines={1} style={styles.title}>
        {title}
      </Text>
      <View style={{width: 36}} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  title: {flex: 1},
});
