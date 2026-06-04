import { Hono } from 'hono';
import { getWorkspace } from '../context.js';
import { fetchHistory } from '../../../src/api/messages.js';
import { fetchThread } from '../../../src/api/threads.js';
import { resolveMentionIds } from '../../../src/utils/mrkdwn.js';
import {
    formatDoc,
    buildChannelExportDoc,
    buildThreadExportDoc,
    defaultFilename,
    type ExportFormat,
} from '../../../src/export/index.js';
import type { Message } from '../../../src/types/slack.js';
import type { WebClient } from '@slack/web-api';

export const exportRoute = new Hono();

const MIME: Record<ExportFormat, string> = {
    json: 'application/json',
    markdown: 'text/markdown; charset=utf-8',
    html: 'text/html; charset=utf-8',
};

async function resolveTexts(messages: Message[], client: WebClient, teamId: string): Promise<Message[]>
{
    return Promise.all(messages.map(async m => ({
        ...m,
        text: await resolveMentionIds(m.text, client, teamId),
    })));
}

exportRoute.get('/workspaces/:ws/channels/:channelId/export', async (c) =>
{
    const ws = c.req.param('ws');
    const channelId = c.req.param('channelId');
    const channelName = c.req.query('channelName') ?? channelId;
    const formatStr = c.req.query('format') ?? 'json';
    const oldest = c.req.query('oldest');
    const latest = c.req.query('latest');
    const threadTs = c.req.query('ts');

    if (!['json', 'markdown', 'html'].includes(formatStr))
    {
        return c.json({ error: 'format must be one of: json, markdown, html' }, 400);
    }
    const format = formatStr as ExportFormat;

    const ctx = await getWorkspace(ws);
    if (!ctx)
    {
        return c.json({ error: `Workspace "${ws}" not found` }, 404);
    }

    const { client, teamId } = ctx;

    let messages: Message[];
    let doc;

    if (threadTs)
    {
        messages = await fetchThread(client, teamId, channelId, threadTs);
        if (format !== 'json')
        {
            messages = await resolveTexts(messages, client, teamId);
        }
        doc = buildThreadExportDoc(ws, channelId, messages);
    }
    else
    {
        messages = [];
        let cursor: string | undefined;
        do
        {
            const result = await fetchHistory(client, teamId, channelId, { cursor, oldest, latest });
            messages.push(...result.messages);
            cursor = result.nextCursor;
        } while (cursor);

        if (format !== 'json')
        {
            messages = await resolveTexts(messages, client, teamId);
        }

        const channel = { id: channelId, name: channelName, type: 'public' as const, isMember: true };
        doc = buildChannelExportDoc(ws, channel, messages);
    }

    const content = formatDoc(doc, format);
    const filename = defaultFilename(channelName.replace(/^#/, ''), format);

    c.header('Content-Disposition', `attachment; filename="${filename}"`);
    c.header('Content-Type', MIME[format]);
    return c.text(content);
});
