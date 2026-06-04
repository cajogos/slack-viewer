import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import type { Theme } from '@/hooks/useTheme';
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
    theme: Theme;
    setTheme: (t: Theme) => void;
}

export function RecentChannelsBar({ recentChannels, activeChannelId, onSelect, theme, setTheme }: RecentChannelsBarProps)
{
    return (
        <div className="flex items-center gap-1 px-3 py-1.5 border-b border-border bg-card/50 overflow-x-auto flex-shrink-0 scrollbar-hide">
            {recentChannels.length > 0 && (
                <>
                    <span className="text-xs text-muted-foreground flex-shrink-0 mr-1">Recent:</span>
                    {recentChannels.map(ch => (
                        <button
                            key={ch.id}
                            onClick={() => onSelect({ id: ch.id, name: ch.name, type: ch.type, isMember: true })}
                            className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full border transition-colors ${
                                ch.id === activeChannelId
                                    ? 'border-primary/50 bg-primary/10 text-primary'
                                    : 'border-border text-muted-foreground hover:border-border/80 hover:text-foreground'
                            }`}
                        >
                            #{ch.name}
                        </button>
                    ))}
                </>
            )}
            <div className="ml-auto flex-shrink-0 pl-2">
                <ThemeSwitcher theme={theme} setTheme={setTheme} />
            </div>
        </div>
    );
}
