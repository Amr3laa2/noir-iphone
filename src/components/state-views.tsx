/**
 * Shared loading / error / empty placeholders so every screen handles async
 * states consistently.
 */
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { ThemedText } from './themed-text';

export function LoadingView({ label }: { label?: string }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator />
      {label ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.gap}>
          {label}
        </ThemedText>
      ) : null}
    </View>
  );
}

export function ErrorView({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  return (
    <View style={styles.center}>
      <ThemedText type="smallBold">Something went wrong</ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.gap}>
        {error.message}
      </ThemedText>
      {onRetry ? (
        <Pressable onPress={onRetry} style={({ pressed }) => [styles.retry, pressed && styles.pressed]}>
          <ThemedText type="linkPrimary">Try again</ThemedText>
        </Pressable>
      ) : null}
    </View>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <View style={styles.center}>
      <ThemedText type="smallBold">{title}</ThemedText>
      {hint ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.gap}>
          {hint}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
    gap: Spacing.one,
  },
  gap: { marginTop: Spacing.one, textAlign: 'center' },
  retry: { marginTop: Spacing.three },
  pressed: { opacity: 0.6 },
});
