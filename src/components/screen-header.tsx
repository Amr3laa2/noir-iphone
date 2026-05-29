/**
 * Lightweight in-screen header for the tab screens (which hide the native
 * navigation header). Title on the left, SF-symbol action buttons on the right.
 */
import { Link } from 'expo-router';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ThemedText } from './themed-text';

export interface HeaderAction {
  sf: SymbolViewProps['name'];
  href: string;
  label: string;
}

export function ScreenHeader({
  title,
  actions = [],
}: {
  title: string;
  actions?: HeaderAction[];
}) {
  const theme = useTheme();
  return (
    <View style={styles.container}>
      <ThemedText type="subtitle" numberOfLines={1} style={styles.title}>
        {title}
      </ThemedText>
      <View style={styles.actions}>
        {actions.map((a) => (
          <Link key={a.href} href={a.href as never} asChild>
            <Pressable
              accessibilityLabel={a.label}
              hitSlop={8}
              style={({ pressed }) => pressed && styles.pressed}>
              <SymbolView name={a.sf} tintColor={theme.text} size={24} />
            </Pressable>
          </Link>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    gap: Spacing.three,
  },
  title: { flex: 1 },
  actions: { flexDirection: 'row', gap: Spacing.three, alignItems: 'center' },
  pressed: { opacity: 0.6 },
});
