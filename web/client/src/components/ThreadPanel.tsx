import { Loader2 } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageItem } from '@/components/MessageItem';
import { ExportMenu } from '@/components/ExportMenu';
import { useThread } from '@/hooks/useThread';
import type { Channel } from '@/types';

interface ThreadPanelProps
{
    workspace: string;
    channel: Channel;
    threadTs: string;
    onClose: () => void;
    emojiMap?: Record<string, string>;
}

export function ThreadPanel({ workspace, channel, threadTs, onClose, emojiMap }: ThreadPanelProps)
{
    const { messages, isLoading, error } = useThread(workspace, channel.id, threadTs);

    return (
        <Sheet open onOpenChange={open => !open && onClose()}>
            <SheetContent side="right" className="w-full sm:max-w-xl flex flex-col p-0">
                <SheetHeader className="px-4 py-3 border-b border-border flex-shrink-0">
                    <div className="flex items-center justify-between pr-6">
                        <SheetTitle className="text-sm font-semibold">Thread</SheetTitle>
                        <ExportMenu workspace={workspace} channel={channel} threadTs={threadTs} />
                    </div>
                </SheetHeader>
                <ScrollArea className="flex-1">
                    <div className="py-2">
                        {isLoading && (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                            </div>
                        )}
                        {error && (
                            <div className="px-4 py-3 text-sm text-red-400">{error}</div>
                        )}
                        {messages.map((msg, i) => (
                            <MessageItem key={msg.ts} message={msg} workspace={workspace} isReply={i > 0} emojiMap={emojiMap} />
                        ))}
                    </div>
                </ScrollArea>
            </SheetContent>
        </Sheet>
    );
}
