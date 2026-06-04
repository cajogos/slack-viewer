import type { WebClient } from '@slack/web-api';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { withRateLimit } from './client.js';

const CACHE_DIR = join(process.cwd(), 'data', 'emoji');
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

interface EmojiCache
{
    updatedAt: number;
    emoji: Record<string, string>;
}

export async function listEmoji(client: WebClient, teamId: string): Promise<Record<string, string>>
{
    const cachePath = join(CACHE_DIR, `${teamId}.json`);

    try
    {
        const raw = await readFile(cachePath, 'utf-8');
        const cache = JSON.parse(raw) as EmojiCache;
        if (Date.now() - cache.updatedAt < CACHE_TTL_MS)
        {
            return cache.emoji;
        }
    }
    catch
    {
        // Cache miss or stale — fetch fresh
    }

    const result = await withRateLimit(() => (client.emoji as { list: () => Promise<{ emoji?: Record<string, string> }> }).list());
    const emoji = result.emoji ?? {};

    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(cachePath, JSON.stringify({ updatedAt: Date.now(), emoji } satisfies EmojiCache));

    return emoji;
}
