import type { Channel } from '@/types';

interface RecentEntry
{
    id: string;
    name: string;
    type: Channel['type'];
}

interface RecentChannelsBarProps
{
    recentChannels: RecentEntry[];
    activeChannelId: string | null;
    onSelect: (channel: Channel) => void;
}

export function RecentChannelsBar({ recentChannels, activeChannelId, onSelect }: RecentChannelsBarProps)
{
    if (recentChannels.length === 0) return null;

    return (
        <div className="flex items-center gap-1 px-3 py-1.5 border-b border-border bg-card/50 overflow-x-auto flex-shrink-0 scrollbar-hide">
            <span className="text-xs text-muted-foreground flex-shrink-0 mr-1">Recent:</span>
            {recentChannels.map(ch => (
                <button
                    key={ch.id}
                    onClick={() => onSelect({ id: ch.id, name: ch.name, type: ch.type, isMember: true })}
                    className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full border transition-colors ${
                        ch.id === activeChannelId
                            ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                            : 'border-border text-muted-foreground hover:border-border/80 hover:text-foreground'
                    }`}
                >
                    #{ch.name}
                </button>
            ))}
        </div>
    );
}
