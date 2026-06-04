import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { MessageSquare } from 'lucide-react';
import { WorkspaceSwitcher } from '@/components/WorkspaceSwitcher';
import { ChannelSidebar } from '@/components/ChannelSidebar';
import { MessageFeed } from '@/components/MessageFeed';
import { ThreadPanel } from '@/components/ThreadPanel';
import { RecentChannelsBar } from '@/components/RecentChannelsBar';
import { ActionLogBar } from '@/components/ActionLogBar';
import { TooltipProvider } from '@/components/ui/tooltip';
import { fetchWorkspaces } from '@/api/client';
import { useEmoji } from '@/hooks/useEmoji';
import { useChannels } from '@/hooks/useChannels';
import { useRecentChannels } from '@/hooks/useRecentChannels';
import { useActionLog } from '@/hooks/useActionLog';
import { useTheme } from '@/hooks/useTheme';
import type { Channel } from '@/types';

interface OpenThread
{
    channelId: string;
    channel: Channel;
    threadTs: string;
}

function parseUrl(pathname: string): { ws: string | null; channelId: string | null }
{
    const m = pathname.match(/^\/workspaces\/([^/]+)(?:\/channels\/([^/]+))?/);
    return {
        ws: m?.[1] ? decodeURIComponent(m[1]) : null,
        channelId: m?.[2] ? decodeURIComponent(m[2]) : null,
    };
}

export function App()
{
    const navigate = useNavigate();
    const location = useLocation();

    const [workspaces, setWorkspaces] = useState<string[]>([]);
    const [selectedWorkspace, setSelectedWorkspace] = useState<string | null>(null);
    const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
    const [openThread, setOpenThread] = useState<OpenThread | null>(null);
    const [workspacesLoaded, setWorkspacesLoaded] = useState(false);

    const emojiMap = useEmoji(selectedWorkspace);
    const { channels, isLoading: channelsLoading, error: channelsError } = useChannels(selectedWorkspace);
    const { recentChannels, addRecentChannel } = useRecentChannels(selectedWorkspace);
    const { log, addAction } = useActionLog();
    const { theme, setTheme } = useTheme();

    // Load workspaces once on mount
    useEffect(() =>
    {
        fetchWorkspaces()
            .then(result =>
            {
                const names = result.workspaces.map(w => w.name);
                setWorkspaces(names);
                setWorkspacesLoaded(true);
            })
            .catch(err => console.error('Failed to load workspaces:', err));
    }, []);

    // Sync workspace from URL once workspaces are loaded
    useEffect(() =>
    {
        if (!workspacesLoaded) return;
        const { ws: urlWs } = parseUrl(location.pathname);
        if (urlWs && workspaces.includes(urlWs))
        {
            setSelectedWorkspace(urlWs);
        }
        else if (workspaces.length > 0)
        {
            const first = workspaces[0]!;
            setSelectedWorkspace(first);
            navigate(`/workspaces/${encodeURIComponent(first)}`, { replace: true });
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [workspacesLoaded]);

    // Sync selected channel from URL when channels list loads
    useEffect(() =>
    {
        if (!channels.length) return;
        const { channelId: urlChannelId } = parseUrl(location.pathname);
        if (urlChannelId)
        {
            const ch = channels.find(c => c.id === urlChannelId);
            if (ch && ch.id !== selectedChannel?.id)
            {
                setSelectedChannel(ch);
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [channels]);

    function handleWorkspaceChange(name: string)
    {
        setSelectedWorkspace(name);
        setSelectedChannel(null);
        setOpenThread(null);
        navigate(`/workspaces/${encodeURIComponent(name)}`);
    }

    const handleChannelSelect = useCallback((channel: Channel) =>
    {
        setSelectedChannel(channel);
        setOpenThread(null);
        addRecentChannel(channel);
        addAction('channel', `#${channel.name}`);
        if (selectedWorkspace)
        {
            navigate(`/workspaces/${encodeURIComponent(selectedWorkspace)}/channels/${encodeURIComponent(channel.id)}`);
        }
    }, [selectedWorkspace, navigate, addRecentChannel, addAction]);

    function handleThreadOpen(channelId: string, threadTs: string)
    {
        if (!selectedChannel) return;
        setOpenThread({ channelId, channel: selectedChannel, threadTs });
        addAction('thread', `Thread in #${selectedChannel.name}`);
    }

    return (
        <TooltipProvider>
            <div data-theme={theme} className="flex h-full bg-background text-foreground overflow-hidden">
                {/* Sidebar — full height */}
                <div className="w-64 flex-shrink-0 flex flex-col bg-card">
                    <WorkspaceSwitcher
                        workspaces={workspaces}
                        current={selectedWorkspace}
                        onChange={handleWorkspaceChange}
                    />
                    <ChannelSidebar
                        channels={channels}
                        isLoading={channelsLoading}
                        error={channelsError}
                        selectedChannelId={selectedChannel?.id ?? null}
                        onSelect={handleChannelSelect}
                    />
                </div>

                {/* Main content column */}
                <div className="flex-1 flex flex-col min-w-0">
                    <div className="flex flex-1 min-h-0">
                        <div className="flex-1 flex flex-col min-w-0">
                            <RecentChannelsBar
                                recentChannels={recentChannels}
                                activeChannelId={selectedChannel?.id ?? null}
                                onSelect={handleChannelSelect}
                                theme={theme}
                                setTheme={setTheme}
                            />
                            {selectedWorkspace && selectedChannel
                                ? (
                                    <MessageFeed
                                        workspace={selectedWorkspace}
                                        channel={selectedChannel}
                                        onThreadOpen={handleThreadOpen}
                                        emojiMap={emojiMap}
                                        onExport={(label) => addAction('export', label)}
                                    />
                                )
                                : (
                                    <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3">
                                        <MessageSquare className="h-12 w-12 opacity-30" />
                                        <p className="text-sm">Select a channel to view messages</p>
                                    </div>
                                )
                            }
                        </div>

                        {/* Thread panel */}
                        {openThread && selectedWorkspace && (
                            <ThreadPanel
                                workspace={selectedWorkspace}
                                channel={openThread.channel}
                                threadTs={openThread.threadTs}
                                onClose={() => setOpenThread(null)}
                                emojiMap={emojiMap}
                            />
                        )}
                    </div>

                    {/* Action log — part of the main column, below all content */}
                    <ActionLogBar log={log} />
                </div>
            </div>
        </TooltipProvider>
    );
}
