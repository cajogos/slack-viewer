import type { WebClient } from '@slack/web-api';
import { withRateLimit } from './client.js';
import { getUserInfo } from './users.js';
import type { Message, Reaction, FileAttachment } from '../types/slack.js';

const SYSTEM_SUBTYPES = new Set(['channel_join', 'channel_leave', 'channel_topic']);

export async function fetchThread(
    client: WebClient,
    teamId: string,
    channelId: string,
    threadTs: string,
): Promise<Message[]> 
{
    const messages: Message[] = [];
    let cursor: string | undefined;

    do 
    {
        const response = await withRateLimit(() =>
            client.conversations.replies({
                channel: channelId,
                ts: threadTs,
                limit: 200,
                cursor,
            }),
        );

        for (const rawMsg of response.messages ?? []) 
        {
            const msg = rawMsg as typeof rawMsg & { subtype?: string; username?: string };
            if (msg.subtype && SYSTEM_SUBTYPES.has(msg.subtype)) 
            {
                continue;
            }
            if (msg.subtype === 'bot_message' && !msg.text) 
            {
                continue;
            }

            const ts = msg.ts ?? '';
            const datetime = ts ? new Date(parseFloat(ts) * 1000).toLocaleString() : '';

            let userId: string;
            let user: string;
            let avatarUrl: string | undefined;

            if (msg.subtype === 'bot_message')
            {
                userId = 'bot';
                user = msg.username ?? 'bot';
            }
            else
            {
                userId = (msg.user as string | undefined) ?? '';
                if (userId)
                {
                    const info = await getUserInfo(client, teamId, userId);
                    user = info.name;
                    avatarUrl = info.imageUrl;
                }
                else
                {
                    user = 'unknown';
                }
            }

            const reactions: Reaction[] = (msg.reactions ?? []).map(r => ({
                name: r.name ?? '',
                count: r.count ?? 0,
            }));

            const files: FileAttachment[] = ((msg.files as Array<Record<string, unknown>> | undefined) ?? []).map(f => ({
                name: (f['name'] as string | undefined) ?? '',
                url: (f['permalink'] as string | undefined) ?? (f['url_private'] as string | undefined) ?? '',
                urlPrivate: f['url_private'] as string | undefined,
                mimetype: f['mimetype'] as string | undefined,
            }));

            const message: Message = {
                ts,
                datetime,
                userId,
                user,
                text: (msg.text as string | undefined) ?? '',
                ...(avatarUrl != null && { avatarUrl }),
                ...(reactions.length > 0 && { reactions }),
                ...(files.length > 0 && { files }),
                ...(msg.reply_count != null && { replyCount: msg.reply_count }),
                ...(msg.thread_ts != null && { threadTs: msg.thread_ts }),
            };

            messages.push(message);
        }

        cursor = response.response_metadata?.next_cursor ?? undefined;
    } while (cursor);

    return messages;
}

export function parseThreadUrl(url: string): { channelId: string; threadTs: string } | null 
{
    try 
    {
        const parsed = new URL(url);
        const match = parsed.pathname.match(/\/archives\/([A-Z0-9]+)\/p(\d+)/);
        if (!match) 
        {
            return null;
        }

        const channelId = match[1];
        const pNumber = match[2];

        // Prefer thread_ts query param if present
        const threadTsParam = parsed.searchParams.get('thread_ts');
        if (threadTsParam) 
        {
            return { channelId, threadTs: threadTsParam };
        }

        // Convert p-number: insert dot 10 digits from left
        const threadTs = pNumber.slice(0, 10) + '.' + pNumber.slice(10);
        return { channelId, threadTs };
    }
    catch 
    {
        return null;
    }
}
