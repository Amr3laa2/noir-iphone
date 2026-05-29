/**
 * Shared browse UI for the Movies / Series / Live tabs: a horizontal category
 * filter bar above a responsive poster grid, with loading/error/empty states
 * and pull-to-refresh. Each tab is just `<BrowseScreen section=... />`.
 */
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedView } from './themed-view';
import { ThemedText } from './themed-text';
import { ScreenHeader, type HeaderAction } from './screen-header';
import { MediaGrid } from './media-grid';
import { LoadingView, ErrorView, EmptyState } from './state-views';
import { useCategories, useStreams } from '@/hooks/use-xtream';
import { itemCategoryId, itemName } from '@/api/xtreamItem';
import type { Section, XtreamItem } from '@/api/types';
import { routes } from '@/lib/navigation';
import { Spacing } from '@/constants/theme';

const HEADER_ACTIONS: HeaderAction[] = [
  { sf: 'magnifyingglass', href: routes.search(), label: 'Search' },
  { sf: 'gearshape', href: routes.settings(), label: 'Settings' },
];

export function BrowseScreen({ section, title }: { section: Section; title: string }) {
  const router = useRouter();
  const [categoryId, setCategoryId] = useState<string | undefined>(undefined);
  const categories = useCategories(section);
  const streams = useStreams(section, categoryId);

  const open = (item: XtreamItem, id: string | undefined) => {
    if (id) router.push(routes.details(section, id));
  };

  const chips = (
    <CategoryBar
      categories={categories.data ?? []}
      selected={categoryId}
      onSelect={setCategoryId}
    />
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.flex}>
        <ScreenHeader title={title} actions={HEADER_ACTIONS} />
        {streams.loading && !streams.data ? (
          <LoadingView />
        ) : streams.error ? (
          <ErrorView error={streams.error} onRetry={streams.reload} />
        ) : (
          <MediaGrid
            section={section}
            items={streams.data ?? []}
            onPressItem={open}
            refreshing={streams.loading}
            onRefresh={streams.reload}
            ListHeaderComponent={chips}
            ListEmptyComponent={<EmptyState title="Nothing here" hint="Try another category." />}
          />
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

function CategoryBar({
  categories,
  selected,
  onSelect,
}: {
  categories: XtreamItem[];
  selected: string | undefined;
  onSelect: (id: string | undefined) => void;
}) {
  if (!categories.length) return null;
  const data = [{ id: undefined, name: 'All' }, ...categories.map((c) => ({
    id: itemCategoryId(c),
    name: itemName(c),
  }))];

  return (
    <FlatList
      horizontal
      data={data}
      keyExtractor={(c, i) => c.id ?? `all-${i}`}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chips}
      style={styles.chipBar}
      renderItem={({ item }) => {
        const active = item.id === selected;
        return (
          <Pressable onPress={() => onSelect(item.id)}>
            <ThemedView
              type={active ? 'backgroundSelected' : 'backgroundElement'}
              style={styles.chip}>
              <ThemedText type="small" themeColor={active ? 'text' : 'textSecondary'}>
                {item.name}
              </ThemedText>
            </ThemedView>
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  chipBar: { marginBottom: Spacing.two },
  chips: { gap: Spacing.two, paddingBottom: Spacing.two },
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.four,
  },
});
