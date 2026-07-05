import React from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';

type Props = {children: React.ReactNode};
type State = {error: Error | null; stack: string};

/**
 * Catches render/lifecycle errors anywhere below it and shows the message +
 * component stack instead of letting the (Release) app close silently. Uses
 * plain RN primitives only, so the boundary itself can't depend on anything that
 * might be the thing crashing.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = {error: null, stack: ''};

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {error};
  }

  componentDidCatch(error: Error, info: {componentStack: string}) {
    this.setState({error, stack: info.componentStack});
  }

  render() {
    const {error, stack} = this.state;
    if (!error) {
      return this.props.children;
    }
    return (
      <View style={styles.root}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>Something crashed</Text>
          <Text style={styles.msg}>{String(error.message ?? error)}</Text>
          {error.stack ? <Text style={styles.mono}>{error.stack}</Text> : null}
          {stack ? <Text style={styles.mono}>{stack}</Text> : null}
        </ScrollView>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: '#FFFFFF'},
  content: {padding: 24, paddingTop: 80, gap: 12},
  title: {fontSize: 20, fontWeight: '600', color: '#B00020'},
  msg: {fontSize: 15, color: '#0D0D16'},
  mono: {fontSize: 11, color: '#5B5B6B', fontFamily: 'Courier'},
});
