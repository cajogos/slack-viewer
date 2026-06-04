import { Hono } from 'hono';
import { getWorkspace } from '../context.js';
import { fetchThread } from '../../../src/api/threads.js';
import { resolveMentionIds, resolveChannelIds, resolveEmojiShortcodes } from '../../../src/utils/mrkdwn.js';

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

    await Promise.all(messages.map(async msg =>
    {
        let text = await resolveMentionIds(msg.text, ctx.client, ctx.teamId);
        text = await resolveChannelIds(text, ctx.client);
        msg.text = resolveEmojiShortcodes(text);
        if (msg.reactions)
        {
            msg.reactions = msg.reactions.map(r =>
            {
                const resolved = resolveEmojiShortcodes(`:${r.name}:`);
                const unicode = resolved !== `:${r.name}:` ? resolved : undefined;
                return { ...r, unicode };
            });
        }
        if (msg.avatarUrl && msg.userId !== 'bot')
        {
            msg.avatarUrl = `/api/workspaces/${encodeURIComponent(ws)}/avatars/${encodeURIComponent(msg.userId)}`;
        }
    }));

    return c.json({ messages });
});
