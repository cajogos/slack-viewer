import { Hash, Lock, MessageSquare, Users } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { Channel } from '@/types';

const CHANNEL_ICONS = {
    public: Hash,
    private: Lock,
    im: MessageSquare,
    mpim: Users,
};

interface ChannelListProps
{
    channels: Channel[];
    selectedChannelId: string | null;
    isLoading: boolean;
    onSelect: (channel: Channel) => void;
}

export function ChannelList({ channels, selectedChannelId, isLoading, onSelect }: ChannelListProps)
{
    if (isLoading)
    {
        return (
            <div className="space-y-1 px-2 py-2">
                {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className="h-7 w-full rounded" />
                ))}
            </div>
        );
    }

    return (
        <ScrollArea className="flex-1">
            <div className="py-2 space-y-0.5">
                {channels.map(ch =>
                {
                    const Icon = CHANNEL_ICONS[ch.type] ?? Hash;
                    const isSelected = ch.id === selectedChannelId;
                    const disabled = !ch.isMember;

                    return (
                        <button
                            key={ch.id}
                            onClick={() => !disabled && onSelect(ch)}
                            disabled={disabled}
                            className={cn(
                                'w-full flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors text-left',
                                isSelected
                                    ? 'bg-accent text-accent-foreground font-medium'
                                    : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                                disabled && 'opacity-40 cursor-not-allowed',
                            )}
                        >
                            <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                            <span className="truncate">{ch.name.replace(/^#/, '')}</span>
                            {!ch.isMember && (
                                <span className="ml-auto text-[10px] text-muted-foreground/60 flex-shrink-0">
                                    no access
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>
        </ScrollArea>
    );
}
