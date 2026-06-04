import { Hono } from 'hono';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { getWorkspace } from '../context.js';
import { getUserInfo } from '../../../src/api/users.js';

const AVATAR_CACHE_DIR = join(process.cwd(), 'data', 'avatars');
const IMAGE_EXTENSIONS = ['.jpg', '.png', '.gif', '.webp'] as const;

function contentTypeExt(ct: string): string
{
    if (ct.includes('gif')) return '.gif';
    if (ct.includes('png')) return '.png';
    if (ct.includes('webp')) return '.webp';
    return '.jpg';
}

function extContentType(ext: string): string
{
    if (ext === '.gif') return 'image/gif';
    if (ext === '.png') return 'image/png';
    if (ext === '.webp') return 'image/webp';
    return 'image/jpeg';
}

export const avatarsRoute = new Hono();

avatarsRoute.get('/workspaces/:ws/avatars/:userId', async (c) =>
{
    const ws = c.req.param('ws');
    const userId = c.req.param('userId');
    const ctx = await getWorkspace(ws);
    if (!ctx) return c.json({ error: `Workspace "${ws}" not found` }, 404);

    const cacheDir = join(AVATAR_CACHE_DIR, ctx.teamId);

    for (const ext of IMAGE_EXTENSIONS)
    {
        try
        {
            const data = await readFile(join(cacheDir, `${userId}${ext}`));
            return new Response(data, {
                headers: {
                    'Content-Type': extContentType(ext),
                    'Cache-Control': 'public, max-age=604800',
                },
            });
        }
        catch { /* try next extension */ }
    }

    const info = await getUserInfo(ctx.client, ctx.teamId, userId);
    if (!info.imageUrl) return c.json({ error: 'No avatar for this user' }, 404);

    const response = await fetch(info.imageUrl);
    if (!response.ok) return c.json({ error: 'Failed to fetch avatar' }, 502);

    const contentType = response.headers.get('content-type') ?? 'image/jpeg';
    const ext = contentTypeExt(contentType);
    const buffer = Buffer.from(await response.arrayBuffer());

    await mkdir(cacheDir, { recursive: true });
    await writeFile(join(cacheDir, `${userId}${ext}`), buffer);

    return new Response(buffer, {
        headers: {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=604800',
        },
    });
});
