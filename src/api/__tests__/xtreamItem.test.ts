import {
  itemName,
  itemId,
  itemPoster,
  itemCategoryId,
  itemExtension,
  itemRating,
} from '../xtreamItem';
import type { XtreamItem } from '../types';

describe('itemName', () => {
  it('prefers name, then title, then display name', () => {
    expect(itemName({ name: 'A', title: 'B' })).toBe('A');
    expect(itemName({ title: 'B' })).toBe('B');
    expect(itemName({ stream_display_name: 'C' })).toBe('C');
  });
  it('falls back to Untitled', () => {
    expect(itemName({})).toBe('Untitled');
    expect(itemName({ name: '' })).toBe('Untitled');
  });
});

describe('itemId', () => {
  it('uses series_id for series and stream_id otherwise', () => {
    expect(itemId({ series_id: 7 }, 'series')).toBe('7');
    expect(itemId({ stream_id: 42 }, 'vod')).toBe('42');
    expect(itemId({ stream_id: '99' }, 'live')).toBe('99');
  });
  it('coerces numeric ids to strings and falls back to id', () => {
    expect(itemId({ id: 5 }, 'vod')).toBe('5');
    expect(itemId({}, 'live')).toBeUndefined();
  });
});

describe('itemPoster', () => {
  it('resolves across provider field names', () => {
    expect(itemPoster({ stream_icon: 'a.png' })).toBe('a.png');
    expect(itemPoster({ cover: 'b.png' })).toBe('b.png');
    expect(itemPoster({ movie_image: 'c.png' })).toBe('c.png');
    expect(itemPoster({})).toBeUndefined();
  });
});

describe('itemCategoryId / itemExtension / itemRating', () => {
  it('reads category id as string', () => {
    expect(itemCategoryId({ category_id: 12 })).toBe('12');
    expect(itemCategoryId({})).toBeUndefined();
  });
  it('defaults extension to mp4', () => {
    expect(itemExtension({ container_extension: 'mkv' })).toBe('mkv');
    expect(itemExtension({})).toBe('mp4');
  });
  it('parses numeric rating, ignores junk', () => {
    expect(itemRating({ rating: '7.5' })).toBe(7.5);
    expect(itemRating({ rating_5based: 4 })).toBe(4);
    expect(itemRating({ rating: 'N/A' })).toBeUndefined();
    expect(itemRating({})).toBeUndefined();
  });
});
