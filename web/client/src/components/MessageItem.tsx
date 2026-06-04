import { mrkdwnToText } from '@/utils/mrkdwn';
import type { Message } from '@/types';

const USER_COLORS = [
    'text-cyan-400',
    'text-green-400',
    'text-yellow-400',
    'text-purple-400',
    'text-blue-400',
    'text-red-400',
];

function userColor(userId: string): string
{
    const idx = userId.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % USER_COLORS.length;
    return USER_COLORS[idx] ?? 'text-gray-400';
}

function initials(name: string): string
{
    return name.slice(0, 2).toUpperCase();
}

interface MessageItemProps
{
    message: Message;
    onThreadClick?: (ts: string) => void;
    isReply?: boolean;
    emojiMap?: Record<string, string>;
}

export function MessageItem({ message, onThreadClick, isReply = false, emojiMap }: MessageItemProps)
{
    const colorClass = userColor(message.userId);
    const html = mrkdwnToText(message.text, { format: 'html', emojiMap });

    return (
        <div className={`flex gap-3 py-2 px-3 hover:bg-white/5 rounded-md group ${isReply ? 'ml-8' : ''}`}>
            <div className={`flex-shrink-0 w-8 h-8 rounded flex items-center justify-center text-xs font-bold bg-white/10 ${colorClass}`}>
                {initials(message.user)}
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 mb-0.5">
                    <span className={`font-semibold text-sm ${colorClass}`}>{message.user}</span>
                    <span className="text-xs text-muted-foreground">{message.datetime}</span>
                </div>
                <div
                    className="text-sm text-foreground/90 leading-relaxed break-words [&_a]:text-blue-400 [&_a]:hover:underline [&_code]:bg-white/10 [&_code]:rounded [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs [&_pre]:bg-white/10 [&_pre]:rounded [&_pre]:p-2 [&_pre]:overflow-x-auto [&_strong]:font-semibold [&_em]:italic"
                    dangerouslySetInnerHTML={{ __html: html }}
                />
                {message.reactions && message.reactions.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                        {message.reactions.map(r => (
                            <span
                                key={r.name}
                                className="inline-flex items-center gap-1 text-xs bg-white/10 hover:bg-white/15 rounded px-1.5 py-0.5 cursor-default text-muted-foreground"
                                title={`:${r.name}:`}
                            >
                                {emojiMap?.[r.name]
                                    ? <img src={emojiMap[r.name]} alt={`:${r.name}:`} style={{ height: '1em', width: 'auto', display: 'inline-block', verticalAlign: '-0.1em' }} />
                                    : <span>:{r.name}:</span>
                                }
                                <span className="text-foreground/70">{r.count}</span>
                            </span>
                        ))}
                    </div>
                )}
                {message.files && message.files.length > 0 && (
                    <div className="mt-1.5 space-y-0.5">
                        {message.files.map((f, i) => (
                            <div key={i} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <span>📎</span>
                                <span className="truncate">{f.name}</span>
                            </div>
                        ))}
                    </div>
                )}
                {!isReply && message.replyCount != null && message.replyCount > 0 && onThreadClick && (
                    <button
                        onClick={() => onThreadClick(message.ts)}
                        className="mt-1.5 text-xs text-blue-400 hover:text-blue-300 hover:underline flex items-center gap-1"
                    >
                        ↳ {message.replyCount} {message.replyCount === 1 ? 'reply' : 'replies'}
                    </button>
                )}
            </div>
        </div>
    );
}
