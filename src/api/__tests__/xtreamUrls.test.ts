import {
  apiUrl,
  streamUrl,
  categoriesAction,
  streamsAction,
  type UrlAccount,
} from '../xtreamUrls';

const acct: UrlAccount = {
  baseUrl: 'http://example.com:8080/',
  username: 'user name',
  password: 'p@ss/word',
};

describe('apiUrl', () => {
  it('trims trailing slashes and url-encodes credentials', () => {
    expect(apiUrl(acct)).toBe(
      'http://example.com:8080/player_api.php?username=user%20name&password=p%40ss%2Fword',
    );
  });

  it('appends extra params', () => {
    expect(apiUrl(acct, 'action=get_vod_streams')).toBe(
      'http://example.com:8080/player_api.php?username=user%20name&password=p%40ss%2Fword&action=get_vod_streams',
    );
  });

  it('handles base url with no trailing slash', () => {
    expect(apiUrl({ ...acct, baseUrl: 'http://h.tv' })).toContain('http://h.tv/player_api.php?');
  });
});

describe('streamUrl', () => {
  const a: UrlAccount = { baseUrl: 'http://h.tv/', username: 'u', password: 'p' };

  it('builds live path', () => {
    expect(streamUrl(a, 'live', '55', 'ts')).toBe('http://h.tv/live/u/p/55.ts');
  });
  it('builds movie path for vod', () => {
    expect(streamUrl(a, 'vod', '12', 'mkv')).toBe('http://h.tv/movie/u/p/12.mkv');
  });
  it('builds series path', () => {
    expect(streamUrl(a, 'series', '7', 'mp4')).toBe('http://h.tv/series/u/p/7.mp4');
  });
});

describe('action mappers', () => {
  it('maps categories actions', () => {
    expect(categoriesAction('live')).toBe('get_live_categories');
    expect(categoriesAction('vod')).toBe('get_vod_categories');
    expect(categoriesAction('series')).toBe('get_series_categories');
  });
  it('maps streams actions', () => {
    expect(streamsAction('live')).toBe('get_live_streams');
    expect(streamsAction('vod')).toBe('get_vod_streams');
    expect(streamsAction('series')).toBe('get_series');
  });
});
