import { Hono } from 'hono';
import { getWorkspace } from '../context.js';
import { listChannels } from '../../../src/api/channels.js';

export const channelsRoute = new Hono();

channelsRoute.get('/workspaces/:ws/channels', async (c) =>
{
    const ws = c.req.param('ws');
    const ctx = await getWorkspace(ws);

    if (!ctx)
    {
        return c.json({ error: `Workspace "${ws}" not found` }, 404);
    }

    const channels = await listChannels(ctx.client, ctx.teamId);
    return c.json({ channels });
});
