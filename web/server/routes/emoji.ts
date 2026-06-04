import { Hono } from 'hono';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { getWorkspace } from '../context.js';
import { listEmoji } from '../../../src/api/emoji.js';

const IMAGE_CACHE_DIR = join(process.cwd(), 'data', 'emoji-images');
const IMAGE_EXTENSIONS = ['.png', '.gif', '.jpg', '.webp'] as const;

function extContentType(ext: string): string
{
    if (ext === '.gif') return 'image/gif';
    if (ext === '.jpg') return 'image/jpeg';
    if (ext === '.webp') return 'image/webp';
    return 'image/png';
}

function contentTypeExt(ct: string): string
{
    if (ct.includes('gif')) return '.gif';
    if (ct.includes('jpeg')) return '.jpg';
    if (ct.includes('webp')) return '.webp';
    return '.png';
}

// Follows alias: chains up to depth 5; returns the resolved URL or null.
function resolveAlias(name: string, raw: Record<string, string>, depth = 0): string | null
{
    if (depth > 5) return null;
    const value = raw[name];
    if (!value) return null;
    if (value.startsWith('alias:')) return resolveAlias(value.slice(6), raw, depth + 1);
    return value;
}

export const emojiRoute = new Hono();

emojiRoute.get('/workspaces/:ws/emoji', async (c) =>
{
    const ws = c.req.param('ws');
    const ctx = await getWorkspace(ws);
    if (!ctx) return c.json({ error: `Workspace "${ws}" not found` }, 404);

    const raw = await listEmoji(ctx.client, ctx.teamId);

    const emoji: Record<string, string> = {};
    for (const name of Object.keys(raw))
    {
        const resolved = resolveAlias(name, raw);
        if (resolved)
        {
            emoji[name] = `/api/workspaces/${encodeURIComponent(ws)}/emoji/image/${encodeURIComponent(name)}`;
        }
    }

    return c.json({ emoji });
});

emojiRoute.get('/workspaces/:ws/emoji/image/:name', async (c) =>
{
    const ws = c.req.param('ws');
    const name = c.req.param('name');
    const ctx = await getWorkspace(ws);
    if (!ctx) return c.json({ error: `Workspace "${ws}" not found` }, 404);

    const cacheDir = join(IMAGE_CACHE_DIR, ctx.teamId);

    for (const ext of IMAGE_EXTENSIONS)
    {
        try
        {
            const data = await readFile(join(cacheDir, `${name}${ext}`));
            return new Response(data, {
                headers: {
                    'Content-Type': extContentType(ext),
                    'Cache-Control': 'public, max-age=604800',
                },
            });
        }
        catch { /* try next extension */ }
    }

    const raw = await listEmoji(ctx.client, ctx.teamId);
    const slackUrl = resolveAlias(name, raw);
    if (!slackUrl) return c.json({ error: 'Emoji not found' }, 404);

    const response = await fetch(slackUrl);
    if (!response.ok) return c.json({ error: 'Failed to fetch emoji from Slack' }, 502);

    const contentType = response.headers.get('content-type') ?? 'image/png';
    const ext = contentTypeExt(contentType);
    const buffer = Buffer.from(await response.arrayBuffer());

    await mkdir(cacheDir, { recursive: true });
    await writeFile(join(cacheDir, `${name}${ext}`), buffer);

    return new Response(buffer, {
        headers: {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=604800',
        },
    });
});
