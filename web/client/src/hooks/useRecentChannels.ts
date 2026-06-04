import { useState, useCallback } from 'react';
import type { Channel } from '@/types';

interface RecentEntry
{
    id: string;
    name: string;
    type: Channel['type'];
}

const MAX_RECENT = 8;

function storageKey(workspace: string): string
{
    return `recent-channels-${workspace}`;
}

function loadRecent(workspace: string): RecentEntry[]
{
    try
    {
        const raw = localStorage.getItem(storageKey(workspace));
        return raw ? (JSON.parse(raw) as RecentEntry[]) : [];
    }
    catch
    {
        return [];
    }
}

function saveRecent(workspace: string, entries: RecentEntry[]): void
{
    try
    {
        localStorage.setItem(storageKey(workspace), JSON.stringify(entries));
    }
    catch { /* quota exceeded — ignore */ }
}

export function useRecentChannels(workspace: string | null)
{
    const [recentChannels, setRecentChannels] = useState<RecentEntry[]>(() =>
        workspace ? loadRecent(workspace) : [],
    );

    const addRecentChannel = useCallback((channel: Channel) =>
    {
        if (!workspace) return;
        setRecentChannels(prev =>
        {
            const entry: RecentEntry = { id: channel.id, name: channel.name, type: channel.type };
            const filtered = prev.filter(e => e.id !== channel.id);
            const next = [entry, ...filtered].slice(0, MAX_RECENT);
            saveRecent(workspace, next);
            return next;
        });
    }, [workspace]);

    return { recentChannels, addRecentChannel };
}
