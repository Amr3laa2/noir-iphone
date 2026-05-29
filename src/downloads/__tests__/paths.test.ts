import { describe, expect, it } from '@jest/globals';

import {
  downloadDestination,
  downloadFileName,
  joinPath,
  normalizeExtension,
} from '../paths';

describe('normalizeExtension', () => {
  it('defaults to mp4 for empty/missing input', () => {
    expect(normalizeExtension(undefined)).toBe('mp4');
    expect(normalizeExtension('')).toBe('mp4');
    expect(normalizeExtension('   ')).toBe('mp4');
  });

  it('strips leading dots and lowercases', () => {
    expect(normalizeExtension('.MKV')).toBe('mkv');
    expect(normalizeExtension('MP4')).toBe('mp4');
  });

  it('strips junk/query characters', () => {
    expect(normalizeExtension('ts?token=abc')).toBe('tstokenabc');
    expect(normalizeExtension('m3u8')).toBe('m3u8');
  });
});

describe('downloadFileName', () => {
  it('is deterministic and filesystem-safe', () => {
    expect(downloadFileName('vod', '12345', 'mkv')).toBe('vod_12345.mkv');
  });

  it('replaces unsafe characters in the slug', () => {
    expect(downloadFileName('series', 'a/b c', 'mp4')).toBe('series_a-b-c.mp4');
  });

  it('falls back to mp4 when extension missing', () => {
    expect(downloadFileName('vod', '1')).toBe('vod_1.mp4');
  });
});

describe('joinPath', () => {
  it('collapses duplicate separators', () => {
    expect(joinPath('/var/app/', '/file.mp4')).toBe('/var/app/file.mp4');
    expect(joinPath('/var/app', 'file.mp4')).toBe('/var/app/file.mp4');
  });
});

describe('downloadDestination', () => {
  it('builds a path under a downloads subdirectory', () => {
    expect(downloadDestination('/docs', 'vod', '99', 'mp4')).toBe(
      '/docs/downloads/vod_99.mp4',
    );
  });
});
