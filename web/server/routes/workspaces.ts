import { Hono } from 'hono';
import { getRegistry } from '../context.js';

export const workspacesRoute = new Hono();

workspacesRoute.get('/workspaces', async (c) =>
{
    const registry = await getRegistry();
    const workspaces = [...registry.keys()].map(name => ({ name }));
    return c.json({ workspaces });
});
