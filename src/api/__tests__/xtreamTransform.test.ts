import {
  filterByQuery,
  paginate,
  sortRecentMovies,
  sortRecentSeries,
} from '../xtreamTransform';
import type { XtreamItem } from '../types';

const items: XtreamItem[] = [
  { name: 'The Matrix', added: '100' },
  { title: 'Matrix Reloaded', added: '300' },
  { name: 'Inception', added: '200' },
];

describe('filterByQuery', () => {
  it('returns all when query empty/whitespace', () => {
    expect(filterByQuery(items, '')).toHaveLength(3);
    expect(filterByQuery(items, '   ')).toHaveLength(3);
    expect(filterByQuery(items, undefined)).toHaveLength(3);
  });
  it('matches name or title case-insensitively', () => {
    const r = filterByQuery(items, 'matrix');
    expect(r).toHaveLength(2);
  });
  it('returns empty on no match', () => {
    expect(filterByQuery(items, 'zzz')).toHaveLength(0);
  });
});

describe('paginate', () => {
  const list: XtreamItem[] = Array.from({ length: 10 }, (_, i) => ({ id: i }));
  it('returns same list when no limit and zero offset', () => {
    expect(paginate(list)).toHaveLength(10);
  });
  it('slices by limit', () => {
    expect(paginate(list, 3, 0).map((x) => x.id)).toEqual([0, 1, 2]);
  });
  it('slices by offset + limit', () => {
    expect(paginate(list, 2, 8).map((x) => x.id)).toEqual([8, 9]);
  });
  it('saturates past the end', () => {
    expect(paginate(list, 5, 20)).toHaveLength(0);
  });
});

describe('sortRecentMovies', () => {
  it('orders newest-first by added and does not mutate input', () => {
    const before = [...items];
    const sorted = sortRecentMovies(items);
    expect(sorted.map((x) => x.added)).toEqual(['300', '200', '100']);
    expect(items).toEqual(before);
  });
});

describe('sortRecentSeries', () => {
  it('prefers last_modified, falls back to added', () => {
    const series: XtreamItem[] = [
      { name: 'A', added: '500' },
      { name: 'B', last_modified: '900', added: '1' },
      { name: 'C', last_modified: '100' },
    ];
    expect(sortRecentSeries(series).map((x) => x.name)).toEqual(['B', 'A', 'C']);
  });
});
