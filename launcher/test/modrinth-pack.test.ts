import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DownloadManager } from '../src/core/download/DownloadManager.js';
import { inspectModrinthPack, installModrinthPackFiles } from '../src/core/mods/ModrinthPack.js';
import { makeZip, tempDir } from './helpers.js';

const bytes = Buffer.from('a pinned mod file');
const sha1 = createHash('sha1').update(bytes).digest('hex');
const sha512 = createHash('sha512').update(bytes).digest('hex');

function manifest(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    formatVersion: 1,
    game: 'minecraft',
    versionId: '1.0.0',
    name: 'Test Modpack',
    summary: 'A test pack',
    files: [
      {
        path: 'mods/test.jar',
        hashes: { sha1, sha512 },
        downloads: ['https://cdn.modrinth.com/data/test/file.jar'],
        fileSize: bytes.length,
        env: { client: 'required', server: 'required' },
      },
      { path: 'mods/optional.jar', env: { client: 'optional', server: 'optional' } },
      { path: 'mods/server-only.jar', env: { client: 'unsupported', server: 'required' } },
    ],
    dependencies: { minecraft: '1.21.1', 'fabric-loader': '0.16.10' },
    ...overrides,
  };
}

function writePack(index: Record<string, unknown>, extra: Record<string, string | Buffer> = {}): { file: string; root: string } {
  const root = tempDir('lucid-mrpack-');
  const file = join(root, 'test-pack.mrpack');
  writeFileSync(file, makeZip({ 'modrinth.index.json': JSON.stringify(index), ...extra }));
  return { file, root };
}

function fakeDownloads(payload: Buffer): DownloadManager {
  return new DownloadManager({
    retries: 0,
    fetchImpl: async () => new Response(payload, { status: 200 }),
  });
}

describe('Modrinth modpack import', () => {
  it('reads the pack name, Minecraft version and pinned loader version', async () => {
    const { file } = writePack(manifest());
    await expect(inspectModrinthPack(file)).resolves.toMatchObject({
      info: {
        name: 'Test Modpack',
        minecraftVersion: '1.21.1',
        loader: 'fabric',
        loaderVersion: '0.16.10',
      },
      indexSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
  });

  it('downloads only required client files and applies client overrides after base overrides', async () => {
    const { file, root } = writePack(manifest(), {
      'overrides/config/settings.txt': 'base',
      'client-overrides/config/settings.txt': 'client',
      'server-overrides/server.properties': 'not for the client',
    });
    const plan = await inspectModrinthPack(file);
    const gameDir = join(root, 'game');
    mkdirSync(gameDir, { recursive: true });
    const result = await installModrinthPackFiles(file, plan.indexSha256, gameDir, fakeDownloads(bytes));

    expect(result).toEqual({ downloaded: 1, optionalSkipped: 1, unsupportedSkipped: 1, overridesInstalled: 2 });
    expect(readFileSync(join(gameDir, 'mods', 'test.jar'))).toEqual(bytes);
    expect(readFileSync(join(gameDir, 'config', 'settings.txt'), 'utf8')).toBe('client');
    expect(() => readFileSync(join(gameDir, 'server.properties'))).toThrow();
  });

  it('rejects traversal paths, unsupported download hosts and missing checksums', async () => {
    const badPath = manifest({ files: [{ path: '../outside.jar', hashes: { sha1, sha512 }, downloads: ['https://cdn.modrinth.com/file.jar'], fileSize: bytes.length }] });
    const badHost = manifest({ files: [{ path: 'mods/unsafe.jar', hashes: { sha1, sha512 }, downloads: ['https://example.com/file.jar'], fileSize: bytes.length }] });
    const badHash = manifest({ files: [{ path: 'mods/nohash.jar', hashes: { sha1 }, downloads: ['https://cdn.modrinth.com/file.jar'], fileSize: bytes.length }] });
    for (const bad of [badPath, badHost, badHash]) {
      const { file } = writePack(bad);
      await expect(inspectModrinthPack(file)).rejects.toThrow();
    }
  });

  it('rejects a file whose SHA-512 does not match even if its SHA-1 matches', async () => {
    const wrongHash = manifest({ files: [{ path: 'mods/test.jar', hashes: { sha1, sha512: '0'.repeat(128) }, downloads: ['https://cdn.modrinth.com/data/test/file.jar'], fileSize: bytes.length }] });
    const { file, root } = writePack(wrongHash);
    const plan = await inspectModrinthPack(file);
    const gameDir = join(root, 'game');
    mkdirSync(gameDir, { recursive: true });
    await expect(installModrinthPackFiles(file, plan.indexSha256, gameDir, fakeDownloads(bytes))).rejects.toThrow(/SHA-512/);
    expect(() => readFileSync(join(gameDir, 'mods', 'test.jar'))).toThrow();
  });

  it('rejects an unsupported mod loader instead of silently creating a broken instance', async () => {
    const { file } = writePack(manifest({ dependencies: { minecraft: '1.21.1', 'unknown-loader': '1.0' } }));
    await expect(inspectModrinthPack(file)).rejects.toThrow(/unsupported dependency/);
  });
});
