import { useState } from 'react';
import { Search } from 'lucide-react';
import { ChannelList } from '@/components/ChannelList';
import { useChannels } from '@/hooks/useChannels';
import type { Channel } from '@/types';

interface ChannelSidebarProps
{
    workspace: string | null;
    selectedChannelId: string | null;
    onSelect: (channel: Channel) => void;
}

export function ChannelSidebar({ workspace, selectedChannelId, onSelect }: ChannelSidebarProps)
{
    const { channels, isLoading, error } = useChannels(workspace);
    const [search, setSearch] = useState('');

    const tokens = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const filtered = tokens.length
        ? channels.filter(ch => tokens.every(t => ch.name.toLowerCase().includes(t)))
        : channels;

    return (
        <div className="flex flex-col h-full border-r border-border">
            <div className="px-3 py-3 border-b border-border flex-shrink-0">
                <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                    <input
                        type="text"
                        placeholder="Search channels…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full bg-secondary/50 border border-border rounded text-sm pl-7 pr-3 py-1.5 outline-none focus:ring-1 focus:ring-ring text-foreground placeholder:text-muted-foreground"
                    />
                </div>
            </div>
            {error && (
                <div className="px-3 py-2 text-xs text-red-400">{error}</div>
            )}
            <ChannelList
                channels={filtered}
                selectedChannelId={selectedChannelId}
                isLoading={isLoading}
                isFiltered={search.trim().length > 0}
                onSelect={onSelect}
            />
        </div>
    );
}
