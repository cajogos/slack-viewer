import { useRef, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { MessageItem } from '@/components/MessageItem';
import { LoadMoreButton } from '@/components/LoadMoreButton';
import { ExportMenu } from '@/components/ExportMenu';
import { useMessages } from '@/hooks/useMessages';
import type { Channel } from '@/types';

interface MessageFeedProps
{
    workspace: string;
    channel: Channel;
    onThreadOpen: (channelId: string, threadTs: string) => void;
    emojiMap?: Record<string, string>;
}

export function MessageFeed({ workspace, channel, onThreadOpen, emojiMap }: MessageFeedProps)
{
    const { messages, hasMore, isLoading, error, loadMore } = useMessages(workspace, channel.id);
    const bottomRef = useRef<HTMLDivElement>(null);
    const shouldScrollRef = useRef(false);

    // Arm the scroll flag whenever the channel changes
    useEffect(() =>
    {
        shouldScrollRef.current = true;
    }, [channel.id]);

    // Execute the scroll once messages have loaded
    useEffect(() =>
    {
        if (shouldScrollRef.current && messages.length > 0)
        {
            shouldScrollRef.current = false;
            bottomRef.current?.scrollIntoView({ behavior: 'instant' });
        }
    }, [messages]);

    return (
        <div className="flex flex-col h-full">
            <div className="flex items-center justify-between px-4 py-2 border-b border-border flex-shrink-0">
                <div>
                    <h2 className="font-semibold text-sm">{channel.name}</h2>
                    {channel.memberCount != null && (
                        <span className="text-xs text-muted-foreground">{channel.memberCount} members</span>
                    )}
                </div>
                <ExportMenu workspace={workspace} channel={channel} />
            </div>

            <ScrollArea className="flex-1">
                <div className="py-2">
                    <LoadMoreButton hasMore={hasMore} isLoading={isLoading && messages.length > 0} onLoadMore={loadMore} />
                    {isLoading && messages.length === 0 && (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                    )}
                    {error && (
                        <div className="px-4 py-3 text-sm text-red-400">{error}</div>
                    )}
                    {messages.map((msg, i) =>
                    (
                        <div key={msg.ts}>
                            {i > 0 && messages[i - 1] &&
                                new Date(parseFloat(messages[i - 1]!.ts) * 1000).toDateString() !==
                                new Date(parseFloat(msg.ts) * 1000).toDateString() && (
                                <div className="flex items-center gap-3 px-3 py-2">
                                    <Separator className="flex-1" />
                                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                                        {new Date(parseFloat(msg.ts) * 1000).toLocaleDateString(undefined, {
                                            weekday: 'long',
                                            month: 'long',
                                            day: 'numeric',
                                        })}
                                    </span>
                                    <Separator className="flex-1" />
                                </div>
                            )}
                            <MessageItem
                                message={msg}
                                onThreadClick={ts => onThreadOpen(channel.id, ts)}
                                emojiMap={emojiMap}
                            />
                        </div>
                    ))}
                    <div ref={bottomRef} />
                </div>
            </ScrollArea>
        </div>
    );
}
