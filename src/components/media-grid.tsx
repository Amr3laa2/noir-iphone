/**
 * Responsive poster grid used by the browse screens (Movies / Series / Live).
 * Column count adapts to viewport width; supports pull-to-refresh and an
 * optional header (e.g. a category filter bar).
 */
import { ReactElement } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';

import { Spacing } from '@/constants/theme';
import type { Section, XtreamItem } from '@/api/types';
import { itemId, itemName, itemPoster } from '@/api/xtreamItem';
import { PosterCard } from './poster-card';

const MIN_CARD_WIDTH = 110;
const GAP = Spacing.three;

export interface MediaGridProps {
  items: XtreamItem[];
  section: Section;
  onPressItem: (item: XtreamItem, id: string | undefined) => void;
  refreshing?: boolean;
  onRefresh?: () => void;
  ListHeaderComponent?: ReactElement;
  ListEmptyComponent?: ReactElement;
}

export function MediaGrid({
  items,
  section,
  onPressItem,
  refreshing,
  onRefresh,
  ListHeaderComponent,
  ListEmptyComponent,
}: MediaGridProps) {
  const { width } = useWindowDimensions();
  const usable = width - GAP;
  const columns = Math.max(2, Math.floor(usable / (MIN_CARD_WIDTH + GAP)));
  const cardWidth = Math.floor((usable - GAP * columns) / columns);

  return (
    <FlatList
      key={columns} // remount when column count changes (orientation)
      data={items}
      numColumns={columns}
      keyExtractor={(item, i) => itemId(item, section) ?? String(i)}
      columnWrapperStyle={styles.row}
      contentContainerStyle={styles.content}
      ListHeaderComponent={ListHeaderComponent}
      ListEmptyComponent={ListEmptyComponent}
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} />
        ) : undefined
      }
      renderItem={({ item }) => {
        const id = itemId(item, section);
        return (
          <PosterCard
            title={itemName(item)}
            poster={itemPoster(item)}
            width={cardWidth}
            onPress={() => onPressItem(item, id)}
          />
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  content: { padding: GAP, gap: GAP },
  row: { gap: GAP },
});
