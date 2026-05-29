import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { MediaRow } from '@/components/media-row';
import { LoadingView, EmptyState } from '@/components/state-views';
import { useSearch } from '@/hooks/use-xtream';
import { useTheme } from '@/hooks/use-theme';
import type { Section, XtreamItem } from '@/api/types';
import { routes } from '@/lib/navigation';
import { Spacing } from '@/constants/theme';

interface Results {
  live: XtreamItem[];
  movies: XtreamItem[];
  series: XtreamItem[];
}

export default function SearchScreen() {
  const router = useRouter();
  const theme = useTheme();
  const search = useSearch();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Results | null>(null);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced search as the user types.
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const q = query.trim();
    if (q.length < 2) {
      setResults(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    timer.current = setTimeout(async () => {
      try {
        setResults(await search(q));
      } catch {
        setResults({ live: [], movies: [], series: [] });
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [query, search]);

  const open = (section: Section, item: XtreamItem, id: string | undefined) => {
    if (id) router.push(routes.details(section, id));
  };

  const empty =
    results && !results.live.length && !results.movies.length && !results.series.length;

  return (
    <ThemedView style={styles.container}>
      <View style={styles.searchBar}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search movies, series, channels…"
          placeholderTextColor={theme.textSecondary}
          autoFocus
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
        />
      </View>

      {loading ? (
        <LoadingView />
      ) : empty ? (
        <EmptyState title="No results" hint={`Nothing matched "${query.trim()}".`} />
      ) : results ? (
        <ScrollView contentContainerStyle={styles.results}>
          <MediaRow title="Movies" section="vod" items={results.movies} onPressItem={(i, id) => open('vod', i, id)} />
          <MediaRow title="Series" section="series" items={results.series} onPressItem={(i, id) => open('series', i, id)} />
          <MediaRow title="Live" section="live" items={results.live} onPressItem={(i, id) => open('live', i, id)} />
        </ScrollView>
      ) : (
        <EmptyState title="Search your library" hint="Type at least 2 characters." />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchBar: { padding: Spacing.three },
  input: {
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
  results: { paddingVertical: Spacing.three },
});
