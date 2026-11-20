import type { SearchOptions, SearchHit } from './Modrinth.js';

const API = 'https://api.curseforge.com/v1';
const MINECRAFT_GAME_ID = 432;
const MOD_CLASS_ID = 6;
const LOADER_TYPES: Record<string, number> = { forge: 1, fabric: 4, quilt: 5, neoforge: 6 };
const SORT_FIELDS: Record<string, number> = { relevance: 2, downloads: 6, updated: 3, newest: 3, follows: 2 };

export interface CurseForgeMod {
  id?: unknown;
  name?: unknown;
  slug?: unknown;
  summary?: unknown;
  downloadCount?: unknown;
  authors?: unknown;
  logo?: { url?: unknown };
  dateModified?: unknown;
  latestFilesIndexes?: Array<{ gameVersion?: unknown; modLoader?: unknown }>;
  links?: { websiteUrl?: unknown };
}

export interface CurseForgeSearchResponse {
  data?: unknown;
  pagination?: { totalCount?: unknown };
}

const text = (value: unknown, max = 500): string => (typeof value === 'string' ? value.slice(0, max) : '');
const idText = (value: unknown): string => typeof value === 'number' && Number.isInteger(value) ? String(value) : text(value, 64);
const count = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) ? value : 0);
const safeUrl = (value: unknown): string | null => {
  const url = text(value, 1000);
  return /^https:\/\/www\.curseforge\.com\/minecraft\/mc-mods\//i.test(url) ? url : null;
};
const safeImage = (value: unknown): string | null => {
  const url = text(value, 1000);
  return /^https:\/\/(?:media\.file\.io|media\.curseforge\.com|cdn\.curseforge\.com|media\.forgecdn\.net)\//i.test(url) ? url : null;
};

export function curseForgeSearchUrl(options: SearchOptions): string {
  const params = new URLSearchParams({
    gameId: String(MINECRAFT_GAME_ID),
    classId: String(MOD_CLASS_ID),
    searchFilter: options.query,
    index: String(Math.max(0, options.offset)),
    pageSize: String(Math.min(Math.max(options.limit, 1), 50)),
    sortField: String(SORT_FIELDS[options.sort] ?? SORT_FIELDS.relevance),
    sortOrder: 'desc',
  });
  if (options.gameVersion) params.set('gameVersion', options.gameVersion);
  if (options.loader && LOADER_TYPES[options.loader]) params.set('modLoaderType', String(LOADER_TYPES[options.loader]));
  return `${API}/mods/search?${params}`;
}

export function normalizeCurseForgeMod(raw: CurseForgeMod): SearchHit | null {
  const projectId = idText(raw.id);
  if (!/^\d+$/.test(projectId)) return null;
  const indexes = Array.isArray(raw.latestFilesIndexes) ? raw.latestFilesIndexes : [];
  const gameVersions = [...new Set(indexes.map((f) => text(f?.gameVersion, 32)).filter(Boolean))].slice(0, 400);
  const loaders = [...new Set(indexes.map((f) => {
    const loader = Number(f?.modLoader);
    return Object.entries(LOADER_TYPES).find(([, value]) => value === loader)?.[0] ?? '';
  }).filter(Boolean))];
  const authors = Array.isArray(raw.authors) ? raw.authors.map((a) => text((a as { name?: unknown })?.name, 64)).filter(Boolean) : [];
  const slug = text(raw.slug, 120) || projectId;
  const websiteUrl = safeUrl(raw.links?.websiteUrl) ?? `https://www.curseforge.com/minecraft/mc-mods/${encodeURIComponent(slug)}`;
  return {
    projectId,
    slug,
    title: text(raw.name, 120) || projectId,
    author: authors.join(', '),
    description: text(raw.summary, 300),
    iconUrl: safeImage(raw.logo?.url),
    downloads: count(raw.downloadCount),
    follows: 0,
    updated: text(raw.dateModified, 40),
    loaders,
    gameVersions,
    versionRange: gameVersions.length ? gameVersions.join(', ') : 'CurseForge',
    provider: 'curseforge',
    webUrl: websiteUrl,
    installable: false,
  };
}

export class CurseForgeService {
  constructor(private readonly apiKey: string | undefined) {}

  get configured(): boolean { return Boolean(this.apiKey?.trim()); }

  async search(options: SearchOptions): Promise<{ hits: SearchHit[]; total: number; offset: number }> {
    if (!this.configured) throw new Error('CurseForge search is not configured. Set CURSEFORGE_API_KEY for this launcher build.');
    const response = await fetch(curseForgeSearchUrl(options), {
      headers: { Accept: 'application/json', 'x-api-key': this.apiKey!.trim(), 'User-Agent': 'LUCID Launcher' },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`CurseForge search failed (${response.status}). Try again in a moment.`);
    const raw = await response.json() as CurseForgeSearchResponse;
    if (!Array.isArray(raw?.data)) throw new Error('CurseForge returned an unexpected search response.');
    const hits = raw.data.map((item) => item && typeof item === 'object' ? normalizeCurseForgeMod(item as CurseForgeMod) : null).filter((hit): hit is SearchHit => hit !== null);
    return { hits, total: count(raw.pagination?.totalCount), offset: options.offset };
  }
}
