import type { WebClient } from '@slack/web-api';
import { withRateLimit } from './client.js';
import { getUserInfo } from './users.js';
import type { Message, Reaction, FileAttachment } from '../types/slack.js';

const SYSTEM_SUBTYPES = new Set(['channel_join', 'channel_leave', 'channel_topic']);

export interface FetchHistoryOpts {
  cursor?: string
  oldest?: string
  latest?: string
}

export async function fetchHistory(
    client: WebClient,
    teamId: string,
    channelId: string,
    opts?: FetchHistoryOpts,
): Promise<{ messages: Message[]; hasMore: boolean; nextCursor?: string }> 
{
    const response = await withRateLimit(() =>
        client.conversations.history({
            channel: channelId,
            limit: 200,
            cursor: opts?.cursor,
            oldest: opts?.oldest,
            latest: opts?.latest,
        }),
    );

    const raw = [...(response.messages ?? [])].reverse();
    const messages: Message[] = [];

    for (const msg of raw) 
    {
        if (msg.subtype && SYSTEM_SUBTYPES.has(msg.subtype)) 
        {
            continue;
        }
        if (msg.subtype === 'bot_message' && !(msg.text as string | undefined)) 
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
            user = (msg.username as string | undefined) ?? 'bot';
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

    return {
        messages,
        hasMore: response.has_more ?? false,
        nextCursor: response.response_metadata?.next_cursor ?? undefined,
    };
}
