import React from 'react';
import {
  Animated,
  Pressable,
  StyleProp,
  ViewStyle,
  PressableProps,
} from 'react-native';
import {usePressScale} from './usePressScale';

type Props = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
};

/**
 * A `Pressable` wrapped in the shared springy press-scale. Drop-in for any
 * control that should share the one interaction language. Style goes on the
 * animated wrapper; children render inside.
 */
export function PressableScale({
  style,
  children,
  onPressIn,
  onPressOut,
  ...rest
}: Props) {
  const press = usePressScale();
  return (
    <Pressable
      onPressIn={e => {
        press.onPressIn();
        onPressIn?.(e);
      }}
      onPressOut={e => {
        press.onPressOut();
        onPressOut?.(e);
      }}
      {...rest}>
      <Animated.View style={[style, press.animatedStyle]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}
