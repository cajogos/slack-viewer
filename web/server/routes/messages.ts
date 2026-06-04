import { Hono } from 'hono';
import { getWorkspace } from '../context.js';
import { fetchHistory } from '../../../src/api/messages.js';

export const messagesRoute = new Hono();

messagesRoute.get('/workspaces/:ws/channels/:channelId/messages', async (c) =>
{
    const ws = c.req.param('ws');
    const channelId = c.req.param('channelId');
    const cursor = c.req.query('cursor');
    const oldest = c.req.query('oldest');
    const latest = c.req.query('latest');

    const ctx = await getWorkspace(ws);

    if (!ctx)
    {
        return c.json({ error: `Workspace "${ws}" not found` }, 404);
    }

    const result = await fetchHistory(ctx.client, ctx.teamId, channelId, {
        cursor,
        oldest,
        latest,
    });

    return c.json(result);
});
