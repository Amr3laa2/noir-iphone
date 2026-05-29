/**
 * A horizontally-scrolling, titled row of poster cards — the building block of
 * the Home screen ("Recently Added", "Continue Watching", etc.).
 */
import { FlatList, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import type { Section, XtreamItem } from '@/api/types';
import { itemId, itemName, itemPoster } from '@/api/xtreamItem';
import { ThemedText } from './themed-text';
import { PosterCard } from './poster-card';

const CARD_WIDTH = 120;

export interface MediaRowProps {
  title: string;
  items: XtreamItem[];
  section: Section;
  onPressItem: (item: XtreamItem, id: string | undefined) => void;
}

export function MediaRow({ title, items, section, onPressItem }: MediaRowProps) {
  if (!items.length) return null;
  return (
    <View style={styles.container}>
      <ThemedText type="smallBold" style={styles.heading}>
        {title}
      </ThemedText>
      <FlatList
        horizontal
        data={items}
        keyExtractor={(item, i) => itemId(item, section) ?? String(i)}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const id = itemId(item, section);
          return (
            <PosterCard
              title={itemName(item)}
              poster={itemPoster(item)}
              width={CARD_WIDTH}
              onPress={() => onPressItem(item, id)}
            />
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: Spacing.four },
  heading: { marginBottom: Spacing.two, paddingHorizontal: Spacing.three },
  listContent: { paddingHorizontal: Spacing.three, gap: Spacing.three },
});
