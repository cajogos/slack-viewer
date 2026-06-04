type Format = 'plain' | 'markdown' | 'html';

function escHtml(s: string): string
{
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function mrkdwnToText(text: string, opts?: { format?: Format; emojiMap?: Record<string, string> }): string
{
    const fmt = opts?.format ?? 'html';
    const emojiMap = opts?.emojiMap;
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
            return `<span class="text-blue-400 font-medium">#${escHtml(name)}</span>`;
        }
        return `#${name}`;
    });

    // Bare channel mentions: <#C123> (fallback when server couldn't resolve the name)
    result = result.replace(/<#([A-Z0-9]+)>/g, (_, channelId: string) =>
    {
        if (fmt === 'html')
        {
            return `<span class="text-blue-400 font-medium">#${escHtml(channelId)}</span>`;
        }
        return `#${channelId}`;
    });

    // Bold: *text*
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

    // HTML entities — decode for plain/markdown
    if (fmt !== 'html')
    {
        result = result.replace(/&amp;/g, '&');
        result = result.replace(/&lt;/g, '<');
        result = result.replace(/&gt;/g, '>');
    }

    // User mentions with resolved name: <@U123|Alice>
    result = result.replace(/<@([A-Z0-9]+)\|([^>]+)>/g, (_, userId: string, name: string) =>
    {
        if (fmt === 'html')
        {
            return `<span class="text-blue-400 font-medium">@${escHtml(name)}</span>`;
        }
        return `@${name}`;
    });

    // User mentions without name: <@U123>
    result = result.replace(/<@([A-Z0-9]+)>/g, (_, userId: string) =>
    {
        if (fmt === 'html')
        {
            return `<span class="text-blue-400 font-medium">@${escHtml(userId)}</span>`;
        }
        return `@${userId}`;
    });

    // Escape remaining plain text and substitute custom emoji in html mode.
    // Operates only on text segments (between tags) so code blocks are untouched.
    if (fmt === 'html')
    {
        result = result.replace(/(?<=>|^)([^<]*)(?=<|$)/g, (_, plain: string) =>
        {
            let segment = plain.replace(/&(?!amp;|lt;|gt;|quot;)/g, '&amp;');
            if (emojiMap)
            {
                segment = segment.replace(/:([a-z0-9_+\-]+):/g, (match, name: string) =>
                {
                    const url = emojiMap[name];
                    if (!url) return match;
                    return `<img src="${escHtml(url)}" alt=":${escHtml(name)}:" title=":${escHtml(name)}:" style="height:1.2em;width:auto;display:inline-block;vertical-align:-0.2em;" />`;
                });
            }
            return segment;
        });
    }

    return result;
}
