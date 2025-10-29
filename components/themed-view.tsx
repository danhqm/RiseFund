import { StyleSheet, View, type ViewProps } from 'react-native';

export type ThemedViewProps = ViewProps;

export function ThemedView({ style, ...otherProps }: ThemedViewProps) {
  return <View style={[styles.view, style]} {...otherProps} />;
}

const styles = StyleSheet.create({
  view: {
    backgroundColor: '#fff',
  },
});
