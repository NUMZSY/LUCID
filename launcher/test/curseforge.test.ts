import { describe, expect, it, vi } from 'vitest';
import { CurseForgeService, curseForgeSearchUrl, normalizeCurseForgeMod } from '../src/core/mods/CurseForge.js';

describe('CurseForge search adapter', () => {
  it('builds the official Minecraft mod search query', () => {
    const url = new URL(curseForgeSearchUrl({ query: 'sodium', loader: 'fabric', gameVersion: '1.21.1', sort: 'downloads', offset: 20, limit: 20 }));
    expect(url.origin + url.pathname).toBe('https://api.curseforge.com/v1/mods/search');
    expect(url.searchParams.get('gameId')).toBe('432');
    expect(url.searchParams.get('classId')).toBe('6');
    expect(url.searchParams.get('searchFilter')).toBe('sodium');
    expect(url.searchParams.get('gameVersion')).toBe('1.21.1');
    expect(url.searchParams.get('modLoaderType')).toBe('4');
    expect(url.searchParams.get('index')).toBe('20');
  });

  it('normalizes a CurseForge record and keeps it link-only', () => {
    const hit = normalizeCurseForgeMod({
      id: 394468,
      name: 'Sodium',
      slug: 'sodium',
      summary: 'A modern rendering optimization mod.',
      downloadCount: 123456,
      authors: [{ name: 'JellySquid' }],
      logo: { url: 'https://media.forgecdn.net/avatars/1/2/3.png' },
      dateModified: '2026-01-01T00:00:00Z',
      latestFilesIndexes: [{ gameVersion: '1.21.1', modLoader: 4 }],
      links: { websiteUrl: 'https://www.curseforge.com/minecraft/mc-mods/sodium' },
    });
    expect(hit).toMatchObject({ projectId: '394468', title: 'Sodium', author: 'JellySquid', provider: 'curseforge', installable: false, webUrl: 'https://www.curseforge.com/minecraft/mc-mods/sodium' });
    expect(hit?.loaders).toEqual(['fabric']);
    expect(hit?.gameVersions).toEqual(['1.21.1']);
  });

  it('rejects searches when no official API key is configured', async () => {
    const service = new CurseForgeService(undefined);
    await expect(service.search({ query: '', loader: null, gameVersion: null, sort: 'relevance', offset: 0, limit: 20 })).rejects.toThrow('CURSEFORGE_API_KEY');
  });

  it('sends the API key and normalizes the response', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ data: [{ id: 1, name: 'Test', slug: 'test', latestFilesIndexes: [] }], pagination: { totalCount: 1 } }), { status: 200 }));
    try {
      const result = await new CurseForgeService('secret').search({ query: 'test', loader: null, gameVersion: null, sort: 'relevance', offset: 0, limit: 20 });
      expect(result.total).toBe(1);
      expect(result.hits[0]?.projectId).toBe('1');
      expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ headers: expect.objectContaining({ 'x-api-key': 'secret' }) });
    } finally {
      fetchMock.mockRestore();
    }
  });
});
