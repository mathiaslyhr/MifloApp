/**
 * Marks a view as a guided-tour spotlight target. Renders a plain View that
 * registers its ref under a stable id; the tour overlay measures it lazily
 * when (and only when) a step needs it. Zero cost while the tour is idle, and
 * safe to render anywhere — unregistering happens on unmount.
 */
import React, {useEffect, useRef} from 'react';
import {View, type StyleProp, type ViewStyle} from 'react-native';
import {registerTourTarget, type TourTargetId} from './tourStore';

type Props = {
  id: TourTargetId;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
};

export function TourTarget({id, style, children}: Props): React.JSX.Element {
  const ref = useRef<View>(null);
  useEffect(() => registerTourTarget(id, ref), [id]);
  return (
    <View ref={ref} collapsable={false} style={style}>
      {children}
    </View>
  );
}
