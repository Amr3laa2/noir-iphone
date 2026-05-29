/**
 * A tappable poster tile: artwork on top, title below. Falls back to a themed
 * placeholder block when the item has no poster URL.
 */
import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ThemedText } from './themed-text';

export interface PosterCardProps {
  title: string;
  poster?: string;
  /** Tile width in px; height is derived from a 2:3 poster ratio. */
  width: number;
  subtitle?: string;
  onPress?: () => void;
}

export function PosterCard({ title, poster, width, subtitle, onPress }: PosterCardProps) {
  const theme = useTheme();
  const height = Math.round(width * 1.5);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [{ width }, pressed && styles.pressed]}>
      {poster ? (
        <Image
          source={{ uri: poster }}
          style={[styles.poster, { width, height }]}
          contentFit="cover"
          transition={200}
          cachePolicy="memory-disk"
        />
      ) : (
        <View
          style={[styles.poster, styles.placeholder, { width, height, backgroundColor: theme.backgroundElement }]}>
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={3} style={styles.placeholderText}>
            {title}
          </ThemedText>
        </View>
      )}
      <ThemedText type="small" numberOfLines={1} style={styles.title}>
        {title}
      </ThemedText>
      {subtitle ? (
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {subtitle}
        </ThemedText>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  poster: {
    borderRadius: Spacing.two,
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.two,
  },
  placeholderText: { textAlign: 'center' },
  title: { marginTop: Spacing.one },
  pressed: { opacity: 0.7 },
});
