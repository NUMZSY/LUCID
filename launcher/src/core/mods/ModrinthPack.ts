import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, rename, rm, stat } from 'node:fs/promises';
import { dirname, extname, posix } from 'node:path';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import yauzl, { type Entry, type ZipFile } from 'yauzl';
import { DownloadManager, type FetchLike } from '../download/DownloadManager.js';
import type { LoaderId } from '../instance/InstanceManager.js';
import { safeJoin } from '../util/paths.js';

const MAX_ARCHIVE_BYTES = 1024 * 1024 * 1024;
const MAX_ENTRIES = 20_000;
const MAX_EXPANDED_BYTES = 1024 * 1024 * 1024;
const MAX_ENTRY_BYTES = 512 * 1024 * 1024;
const MAX_INDEX_BYTES = 2 * 1024 * 1024;
const MAX_PACK_FILES = 5_000;
const MAX_PATH_LENGTH = 1024;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const INITIAL_DOWNLOAD_HOSTS = new Set(['cdn.modrinth.com', 'github.com', 'raw.githubusercontent.com', 'gitlab.com']);
const REDIRECT_HOSTS = new Set(['cdn.modrinth.com', 'github.com', 'raw.githubusercontent.com', 'gitlab.com']);

export interface ModrinthPackInfo {
  name: string;
  summary: string;
  minecraftVersion: string;
  loader: LoaderId;
  loaderVersion: string | null;
}

export interface ModrinthPackPlan {
  info: ModrinthPackInfo;
  /** Detects if a file was changed between inspection and installation. */
  indexSha256: string;
  preview: {
    requiredFiles: number;
    optionalFiles: number;
    unsupportedFiles: number;
    requiredBytes: number;
  };
}

export interface ModrinthPackInstallResult {
  downloaded: number;
  optionalSkipped: number;
  unsupportedSkipped: number;
  overridesInstalled: number;
}

interface PackFile {
  path: string;
  sha1: string;
  sha512: string;
  size: number;
  url: string;
  client: 'required' | 'optional' | 'unsupported';
}

interface ValidatedIndex {
  info: ModrinthPackInfo;
  files: PackFile[];
}

function safeRelativePath(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value || value.length > MAX_PATH_LENGTH || value.includes('\0') || value.includes('\\') || value.startsWith('/') || /^[a-zA-Z]:/.test(value)) {
    throw new Error(`The modpack contains an unsafe ${label} path.`);
  }
  const parts = value.split('/');
  if (parts.some((p) => !p || p === '.' || p === '..')) throw new Error(`The modpack contains an unsafe ${label} path.`);
  const normalized = posix.normalize(value);
  if (normalized !== value || normalized.startsWith('../')) throw new Error(`The modpack contains an unsafe ${label} path.`);
  return value;
}

function allowedPackUrl(raw: unknown, initial: boolean): string | null {
  if (typeof raw !== 'string' || raw.length > 4096) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) return null;
  const hostname = url.hostname.toLowerCase();
  const hostOk = initial
    ? INITIAL_DOWNLOAD_HOSTS.has(hostname)
    : REDIRECT_HOSTS.has(hostname) || hostname.endsWith('.githubusercontent.com');
  return hostOk ? url.href : null;
}

/** HTTPS-only Modrinth-supported sources with every redirect checked before it is followed. */
async function fetchMrpackUrl(raw: string, init?: Parameters<FetchLike>[1]): Promise<Response> {
  let current = allowedPackUrl(raw, true);
  if (!current) throw new Error('The modpack has a download link from an unsupported or unsafe host.');
  for (let redirects = 0; redirects <= 5; redirects++) {
    const response = await fetch(current, { ...init, redirect: 'manual' } as RequestInit);
    if (!REDIRECT_STATUSES.has(response.status)) return response;
    const location = response.headers.get('location');
    if (!location) throw new Error('A modpack download returned an invalid redirect.');
    const next = allowedPackUrl(new URL(location, current).href, false);
    if (!next) throw new Error('A modpack download redirected to an unsupported or unsafe host.');
    current = next;
  }
  throw new Error('A modpack download redirected too many times.');
}

export function createModrinthPackDownloader(options: { concurrency?: number; retries?: number; userAgent?: string } = {}): DownloadManager {
  return new DownloadManager({
    concurrency: options.concurrency ?? 4,
    retries: options.retries ?? 2,
    userAgent: options.userAgent ?? 'LUCID Launcher',
    fetchImpl: fetchMrpackUrl,
  });
}

function validateIndex(raw: unknown, fileName: string): { index: ValidatedIndex; json: Buffer } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('The modpack manifest is not a JSON object.');
  const data = raw as Record<string, unknown>;
  if (data.formatVersion !== 1 || data.game !== 'minecraft') throw new Error('This is not a supported Minecraft modpack (Modrinth format version 1).');
  const deps = data.dependencies;
  if (!deps || typeof deps !== 'object' || Array.isArray(deps)) throw new Error('The modpack manifest has no valid dependencies.');
  const dependencies = deps as Record<string, unknown>;
  const minecraftVersion = dependencies.minecraft;
  if (typeof minecraftVersion !== 'string' || !/^[A-Za-z0-9._+-]{1,64}$/.test(minecraftVersion)) throw new Error('The modpack does not specify a valid Minecraft version.');
  const loaderEntries: Array<[string, LoaderId]> = [
    ['fabric-loader', 'fabric'],
    ['quilt-loader', 'quilt'],
    ['forge', 'forge'],
    ['neoforge', 'neoforge'],
  ];
  const selected = loaderEntries.filter(([key]) => Object.hasOwn(dependencies, key));
  if (selected.length > 1) throw new Error('The modpack specifies more than one mod loader.');
  const unknownDependencies = Object.keys(dependencies).filter((key) => key !== 'minecraft' && !loaderEntries.some(([known]) => known === key));
  if (unknownDependencies.length) throw new Error(`This modpack uses an unsupported dependency: ${unknownDependencies[0]}.`);
  let loader: LoaderId = 'vanilla';
  let loaderVersion: string | null = null;
  if (selected.length) {
    const [key, id] = selected[0];
    const version = dependencies[key];
    if (typeof version !== 'string' || !/^[A-Za-z0-9._+-]{1,64}$/.test(version)) throw new Error(`The modpack has an invalid ${key} version.`);
    loader = id;
    loaderVersion = version;
  }

  const rawName = typeof data.name === 'string' ? data.name : '';
  const fallbackName = fileName.replace(/\.mrpack$/i, '').replace(/[\x00-\x1f\x7f]/g, ' ').trim();
  const name = (rawName.replace(/[\x00-\x1f\x7f]/g, ' ').trim() || fallbackName || 'Modrinth Modpack').slice(0, 64);
  const summary = typeof data.summary === 'string' ? data.summary.replace(/[\x00-\x1f\x7f]/g, ' ').slice(0, 500) : '';
  if (!Array.isArray(data.files) || data.files.length > MAX_PACK_FILES) throw new Error(`The modpack must have no more than ${MAX_PACK_FILES} indexed files.`);
  const files: PackFile[] = [];
  const destinations = new Set<string>();
  for (const value of data.files) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('The modpack contains an invalid file entry.');
    const item = value as Record<string, unknown>;
    const path = safeRelativePath(item.path, 'indexed file');
    const key = path.toLocaleLowerCase('en-US');
    if (destinations.has(key)) throw new Error(`The modpack lists the same file more than once: ${path}`);
    destinations.add(key);
    const env = item.env;
    let client: PackFile['client'] = 'required';
    if (env !== undefined) {
      if (!env || typeof env !== 'object' || Array.isArray(env)) throw new Error(`The modpack has invalid client settings for ${path}.`);
      const clientValue = (env as Record<string, unknown>).client;
      if (clientValue !== undefined) {
        if (clientValue !== 'required' && clientValue !== 'optional' && clientValue !== 'unsupported') throw new Error(`The modpack has invalid client settings for ${path}.`);
        client = clientValue;
      }
    }
    if (client === 'unsupported') {
      files.push({ path, sha1: '', sha512: '', size: 0, url: '', client });
      continue;
    }
    if (client === 'optional') {
      files.push({ path, sha1: '', sha512: '', size: 0, url: '', client });
      continue;
    }
    const hashes = item.hashes;
    if (!hashes || typeof hashes !== 'object' || Array.isArray(hashes)) throw new Error(`The modpack has no checksums for ${path}.`);
    const hash = hashes as Record<string, unknown>;
    if (typeof hash.sha1 !== 'string' || !/^[a-f0-9]{40}$/i.test(hash.sha1) || typeof hash.sha512 !== 'string' || !/^[a-f0-9]{128}$/i.test(hash.sha512)) throw new Error(`The modpack has invalid checksums for ${path}.`);
    const size = item.fileSize;
    if (!Number.isSafeInteger(size) || (size as number) < 1 || (size as number) > MAX_ENTRY_BYTES) throw new Error(`The modpack has an invalid or too-large file size for ${path}.`);
    if (!Array.isArray(item.downloads) || !item.downloads.length) throw new Error(`The modpack has no download URL for ${path}.`);
    const url = item.downloads.map((candidate) => allowedPackUrl(candidate, true)).find((candidate): candidate is string => candidate !== null);
    if (!url) throw new Error(`The modpack file ${path} has no supported HTTPS download URL.`);
    files.push({ path, sha1: hash.sha1.toLowerCase(), sha512: hash.sha512.toLowerCase(), size: size as number, url, client });
  }
  const json = Buffer.from(JSON.stringify(data));
  return { index: { info: { name, summary, minecraftVersion, loader, loaderVersion }, files }, json };
}

async function openArchive(filePath: string): Promise<{ zip: ZipFile; entries: Entry[] }> {
  if (extname(filePath).toLowerCase() !== '.mrpack') throw new Error('Choose a .mrpack file.');
  const archiveStat = await stat(filePath);
  if (!archiveStat.isFile() || archiveStat.size <= 0 || archiveStat.size > MAX_ARCHIVE_BYTES) throw new Error('The modpack archive is empty or larger than 1 GB.');
  const zip = await yauzl.openPromise(filePath, { autoClose: false, lazyEntries: true, decodeStrings: true, validateEntrySizes: true, strictFileNames: true });
  try {
    if (zip.entryCount > MAX_ENTRIES) throw new Error(`The modpack has too many archive entries (maximum ${MAX_ENTRIES}).`);
    const entries: Entry[] = [];
    const names = new Set<string>();
    let expanded = 0;
    for await (const entry of zip.eachEntry()) {
      const directory = entry.fileName.endsWith('/');
      const name = directory ? entry.fileName.slice(0, -1) : entry.fileName;
      safeRelativePath(name, 'archive');
      if (entry.fileName.length > MAX_PATH_LENGTH) throw new Error('The modpack contains an excessively long archive path.');
      const type = (entry.externalFileAttributes >>> 16) & 0o170000;
      if (type === 0o120000) throw new Error('The modpack contains a symbolic link, which is not allowed.');
      if (entry.isEncrypted?.() || (entry.generalPurposeBitFlag & 1) !== 0) throw new Error('Encrypted modpack files are not supported.');
      const key = entry.fileName.toLocaleLowerCase('en-US');
      if (names.has(key)) throw new Error(`The modpack contains a duplicate archive path: ${entry.fileName}`);
      names.add(key);
      if (!Number.isSafeInteger(entry.uncompressedSize) || entry.uncompressedSize < 0 || entry.uncompressedSize > MAX_ENTRY_BYTES) throw new Error('The modpack contains an archive entry that is too large.');
      expanded += entry.uncompressedSize;
      if (!Number.isSafeInteger(expanded) || expanded > MAX_EXPANDED_BYTES) throw new Error('The modpack expands to more than 1 GB.');
      entries.push(entry);
    }
    return { zip, entries };
  } catch (error) {
    zip.close();
    throw error;
  }
}

async function readEntryBuffer(zip: ZipFile, entry: Entry, maxBytes: number): Promise<Buffer> {
  if (entry.uncompressedSize > maxBytes) throw new Error('The modpack manifest is larger than 2 MB.');
  const stream = await zip.openReadStreamPromise(entry);
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const value of stream) {
    const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value);
    length += chunk.length;
    if (length > maxBytes) {
      stream.destroy(new Error('The modpack manifest is larger than 2 MB.'));
      throw new Error('The modpack manifest is larger than 2 MB.');
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks, length);
}

async function readIndex(zip: ZipFile, entries: Entry[], fileName: string): Promise<{ index: ValidatedIndex; digest: string }> {
  const entry = entries.find((item) => item.fileName === 'modrinth.index.json');
  if (!entry) throw new Error('This archive has no modrinth.index.json manifest.');
  const bytes = await readEntryBuffer(zip, entry, MAX_INDEX_BYTES);
  let parsed: unknown;
  try {
    parsed = JSON.parse(bytes.toString('utf8'));
  } catch {
    throw new Error('The modpack manifest is not valid JSON.');
  }
  const result = validateIndex(parsed, fileName);
  return { index: result.index, digest: createHash('sha256').update(bytes).digest('hex') };
}

export async function inspectModrinthPack(filePath: string): Promise<ModrinthPackPlan> {
  const { zip, entries } = await openArchive(filePath);
  try {
    const { index, digest } = await readIndex(zip, entries, filePath.split(/[\\/]/).pop() ?? 'Modrinth Modpack');
    return {
      info: index.info,
      indexSha256: digest,
      preview: {
        requiredFiles: index.files.filter((file) => file.client === 'required').length,
        optionalFiles: index.files.filter((file) => file.client === 'optional').length,
        unsupportedFiles: index.files.filter((file) => file.client === 'unsupported').length,
        requiredBytes: index.files.filter((file) => file.client === 'required').reduce((total, file) => total + file.size, 0),
      },
    };
  } finally {
    zip.close();
  }
}

function readEntryStream(zip: ZipFile, entry: Entry): Promise<NodeJS.ReadableStream> {
  return zip.openReadStreamPromise(entry);
}

async function writeOverride(zip: ZipFile, entry: Entry, destination: string): Promise<void> {
  const temp = `${destination}.lucid-part`;
  await mkdir(dirname(destination), { recursive: true });
  await rm(temp, { force: true });
  const input = await readEntryStream(zip, entry);
  let written = 0;
  const limit = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      written += chunk.length;
      if (written > MAX_ENTRY_BYTES) callback(new Error('An override file is too large.'));
      else callback(null, chunk);
    },
  });
  try {
    await pipeline(input, limit, createWriteStream(temp, { flags: 'wx' }));
    await rm(destination, { force: true });
    await rename(temp, destination);
  } catch (error) {
    await rm(temp, { force: true });
    throw error;
  }
}

async function sha512Of(path: string): Promise<string> {
  const hash = createHash('sha512');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}

export async function installModrinthPackFiles(
  filePath: string,
  expectedIndexSha256: string,
  gameDir: string,
  downloads: DownloadManager,
  signal?: AbortSignal,
  onProgress?: (completed: number, total: number, current?: string) => void,
): Promise<ModrinthPackInstallResult> {
  const { zip, entries } = await openArchive(filePath);
  try {
    const { index, digest } = await readIndex(zip, entries, filePath.split(/[\\/]/).pop() ?? 'Modrinth Modpack');
    if (digest !== expectedIndexSha256) throw new Error('The modpack file changed during import. Choose it again and retry.');
    const required = index.files.filter((file) => file.client === 'required');
    const optionalSkipped = index.files.filter((file) => file.client === 'optional').length;
    const unsupportedSkipped = index.files.filter((file) => file.client === 'unsupported').length;
    const tasks = required.map((file) => ({
      url: file.url,
      dest: safeJoin(gameDir, file.path),
      sha1: file.sha1,
      size: file.size,
      label: file.path,
    }));
    await downloads.downloadAll(tasks, signal, (progress) => onProgress?.(progress.completed, progress.total, progress.current));
    for (const file of required) {
      signal?.throwIfAborted();
      const destination = safeJoin(gameDir, file.path);
      const actual = await sha512Of(destination);
      if (actual !== file.sha512) {
        await rm(destination, { force: true });
        throw new Error(`SHA-512 verification failed for ${file.path}. The modpack download was not kept.`);
      }
    }

    const overrides: Array<{ entry: Entry; path: string; layer: number }> = [];
    for (const entry of entries) {
      if (entry.fileName.endsWith('/')) continue;
      const layer = entry.fileName.startsWith('overrides/') ? 0 : entry.fileName.startsWith('client-overrides/') ? 1 : -1;
      if (layer < 0) continue;
      const prefix = layer === 0 ? 'overrides/' : 'client-overrides/';
      const relativePath = safeRelativePath(entry.fileName.slice(prefix.length), 'override');
      overrides.push({ entry, path: relativePath, layer });
    }
    overrides.sort((a, b) => a.layer - b.layer || a.path.localeCompare(b.path));
    let overrideBytes = 0;
    for (const override of overrides) {
      signal?.throwIfAborted();
      overrideBytes += override.entry.uncompressedSize;
      if (overrideBytes > MAX_EXPANDED_BYTES) throw new Error('Client overrides expand to more than 1 GB.');
      await writeOverride(zip, override.entry, safeJoin(gameDir, override.path));
    }
    return { downloaded: required.length, optionalSkipped, unsupportedSkipped, overridesInstalled: overrides.length };
  } finally {
    zip.close();
  }
}
