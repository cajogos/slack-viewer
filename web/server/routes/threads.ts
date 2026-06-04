import { Hono } from 'hono';
import { getWorkspace } from '../context.js';
import { fetchThread } from '../../../src/api/threads.js';

export const threadsRoute = new Hono();

// threadTs is passed as a query param (?ts=) to avoid routing issues with dots in path segments
threadsRoute.get('/workspaces/:ws/channels/:channelId/thread', async (c) =>
{
    const ws = c.req.param('ws');
    const channelId = c.req.param('channelId');
    const threadTs = c.req.query('ts');

    if (!threadTs)
    {
        return c.json({ error: 'Missing required query param: ts' }, 400);
    }

    const ctx = await getWorkspace(ws);

    if (!ctx)
    {
        return c.json({ error: `Workspace "${ws}" not found` }, 404);
    }

    const messages = await fetchThread(ctx.client, ctx.teamId, channelId, threadTs);
    return c.json({ messages });
});
