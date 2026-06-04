import type { WebClient } from '@slack/web-api';
import { getDisplayName } from '../api/users.js';
import { getChannelName } from '../api/channels.js';

type Format = 'plain' | 'markdown' | 'html'

function escHtml(s: string): string
{
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function mrkdwnToText(text: string, opts?: { format?: Format }): string
{
    const fmt = opts?.format ?? 'plain';
    let result = text;

    // Code blocks first (prevent inner parsing)
    result = result.replace(/```([\s\S]*?)```/g, (_, code: string) =>
    {
        if (fmt === 'html')
        {
            return `<pre><code>${escHtml(code)}</code></pre>`;
        }
        if (fmt === 'markdown')
        {
            return `\`\`\`\n${code}\n\`\`\``;
        }
        return `\`\`\`${code}\`\`\``;
    });

    // Inline code
    result = result.replace(/`([^`]+)`/g, (_, code: string) =>
    {
        if (fmt === 'html')
        {
            return `<code>${escHtml(code)}</code>`;
        }
        return `\`${code}\``;
    });

    // Links with display text: <url|text>
    result = result.replace(/<(https?:\/\/[^|>]+)\|([^>]+)>/g, (_, url: string, linkText: string) =>
    {
        if (fmt === 'html')
        {
            return `<a href="${escHtml(url)}" target="_blank" rel="noopener noreferrer">${escHtml(linkText)}</a>`;
        }
        if (fmt === 'markdown')
        {
            return `[${linkText}](${url})`;
        }
        return `${linkText} (${url})`;
    });

    // Bare links: <url>
    result = result.replace(/<(https?:\/\/[^>]+)>/g, (_, url: string) =>
    {
        if (fmt === 'html')
        {
            return `<a href="${escHtml(url)}" target="_blank" rel="noopener noreferrer">${escHtml(url)}</a>`;
        }
        return url;
    });

    // Channel mentions: <#C123|name>
    result = result.replace(/<#[A-Z0-9]+\|([^>]+)>/g, (_, name: string) =>
    {
        if (fmt === 'html')
        {
            return `<span class="channel">#${escHtml(name)}</span>`;
        }
        return `#${name}`;
    });

    // Bare channel mentions: <#C123> (no name — async resolver didn't run or couldn't resolve)
    result = result.replace(/<#([A-Z0-9]+)>/g, (_, channelId: string) =>
    {
        if (fmt === 'html')
        {
            return `<span class="channel">#${escHtml(channelId)}</span>`;
        }
        return `#${channelId}`;
    });

    // Bold: *text* — processed before user mentions so @display_names aren't corrupted
    result = result.replace(/\*([^*\n]+)\*/g, (_, bold: string) =>
    {
        if (fmt === 'html')
        {
            return `<strong>${escHtml(bold)}</strong>`;
        }
        if (fmt === 'markdown')
        {
            return `**${bold}**`;
        }
        return bold;
    });

    // Italic: _text_
    result = result.replace(/_([^_\n]+)_/g, (_, italic: string) =>
    {
        if (fmt === 'html')
        {
            return `<em>${escHtml(italic)}</em>`;
        }
        if (fmt === 'markdown')
        {
            return `_${italic}_`;
        }
        return italic;
    });

    // HTML entities — decode for plain/markdown; leave as-is for html (already valid)
    if (fmt !== 'html')
    {
        result = result.replace(/&amp;/g, '&');
        result = result.replace(/&lt;/g, '<');
        result = result.replace(/&gt;/g, '>');
    }

    // User mentions processed after bold/italic so display names with underscores aren't
    // corrupted by the italic regex in plain mode.

    // User mentions with resolved name: <@U123|Alice>
    result = result.replace(/<@([A-Z0-9]+)\|([^>]+)>/g, (_, userId: string, name: string) =>
    {
        if (fmt === 'html')
        {
            return `<a class="mention" href="https://slack.com/team/${userId}" target="_blank" rel="noopener noreferrer">@${escHtml(name)}</a>`;
        }
        return `@${name}`;
    });

    // User mentions without name: <@U123> (sync — use raw ID as fallback)
    result = result.replace(/<@([A-Z0-9]+)>/g, (_, userId: string) =>
    {
        if (fmt === 'html')
        {
            return `<span class="mention">@${userId}</span>`;
        }
        return `@${userId}`;
    });

    return result;
}

export async function mrkdwnToTextAsync(
    text: string,
    client: WebClient,
    teamId: string,
    format: Format = 'plain',
): Promise<string>
{
    let resolved = await resolveMentionIds(text, client, teamId);
    resolved = await resolveChannelIds(resolved, client);
    return mrkdwnToText(resolved, { format });
}

// Replaces <@U123> tokens with <@U123|displayname> in raw mrkdwn,
// so the sync mrkdwnToText can render names without an API call.
export async function resolveMentionIds(
    text: string,
    client: WebClient,
    teamId: string,
): Promise<string>
{
    const ids = [...new Set([...text.matchAll(/<@([A-Z0-9]+)>/g)].map(m => m[1]))];
    if (ids.length === 0)
    {
        return text;
    }

    const nameMap = new Map(
        await Promise.all(ids.map(async id => [id, await getDisplayName(client, teamId, id)] as const)),
    );

    return text.replace(/<@([A-Z0-9]+)>/g, (_, id: string) =>
    {
        const name = nameMap.get(id) ?? id;
        return `<@${id}|${name}>`;
    });
}

// Replaces <#C123> tokens (bare channel IDs) with <#C123|name> in raw mrkdwn.
export async function resolveChannelIds(
    text: string,
    client: WebClient,
): Promise<string>
{
    const ids = [...new Set([...text.matchAll(/<#([A-Z0-9]+)>/g)].map(m => m[1]))];
    if (ids.length === 0)
    {
        return text;
    }

    const nameMap = new Map(
        await Promise.all(ids.map(async id => [id, await getChannelName(client, id)] as const)),
    );

    return text.replace(/<#([A-Z0-9]+)>/g, (_, id: string) =>
    {
        const name = nameMap.get(id) ?? id;
        return `<#${id}|${name}>`;
    });
}
