import { Hono } from 'hono';
import { getWorkspace } from '../context.js';

export const filesRoute = new Hono();

filesRoute.get('/workspaces/:ws/files', async (c) =>
{
    const ws = c.req.param('ws');
    const url = c.req.query('url');

    if (!url)
    {
        return c.json({ error: 'Missing required query param: url' }, 400);
    }

    // Guard against SSRF — only proxy Slack private file URLs
    if (!url.startsWith('https://files.slack.com/'))
    {
        return c.json({ error: 'Invalid file URL' }, 400);
    }

    const ctx = await getWorkspace(ws);
    if (!ctx)
    {
        return c.json({ error: `Workspace "${ws}" not found` }, 404);
    }

    let response: Response;
    try
    {
        response = await fetch(url, {
            headers: { Authorization: `Bearer ${ctx.token}` },
        });
    }
    catch
    {
        return c.json({ error: 'Failed to fetch file' }, 502);
    }

    if (!response.ok)
    {
        return c.json({ error: 'Slack returned an error for this file' }, response.status as 400 | 401 | 403 | 404 | 500);
    }

    const contentType = response.headers.get('content-type') ?? 'application/octet-stream';
    const body = response.body;
    if (!body)
    {
        return c.json({ error: 'Empty response from Slack' }, 502);
    }

    return new Response(body, {
        headers: {
            'Content-Type': contentType,
            'Cache-Control': 'private, max-age=3600',
        },
    });
});
