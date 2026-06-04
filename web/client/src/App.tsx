import { useState, useEffect } from 'react';
import { MessageSquare } from 'lucide-react';
import { WorkspaceSwitcher } from '@/components/WorkspaceSwitcher';
import { ChannelSidebar } from '@/components/ChannelSidebar';
import { MessageFeed } from '@/components/MessageFeed';
import { ThreadPanel } from '@/components/ThreadPanel';
import { TooltipProvider } from '@/components/ui/tooltip';
import { fetchWorkspaces } from '@/api/client';
import type { Channel } from '@/types';

interface OpenThread
{
    channelId: string;
    channel: Channel;
    threadTs: string;
}

export function App()
{
    const [workspaces, setWorkspaces] = useState<string[]>([]);
    const [selectedWorkspace, setSelectedWorkspace] = useState<string | null>(null);
    const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
    const [openThread, setOpenThread] = useState<OpenThread | null>(null);

    useEffect(() =>
    {
        fetchWorkspaces()
            .then(result =>
            {
                const names = result.workspaces.map(w => w.name);
                setWorkspaces(names);
                if (names.length > 0 && names[0])
                {
                    setSelectedWorkspace(names[0]);
                }
            })
            .catch(err => console.error('Failed to load workspaces:', err));
    }, []);

    function handleWorkspaceChange(name: string)
    {
        setSelectedWorkspace(name);
        setSelectedChannel(null);
        setOpenThread(null);
    }

    function handleChannelSelect(channel: Channel)
    {
        setSelectedChannel(channel);
        setOpenThread(null);
    }

    function handleThreadOpen(channelId: string, threadTs: string)
    {
        if (!selectedChannel)
        {
            return;
        }
        setOpenThread({ channelId, channel: selectedChannel, threadTs });
    }

    return (
        <TooltipProvider>
            <div className="flex h-screen bg-background text-foreground overflow-hidden">
                {/* Sidebar */}
                <div className="w-64 flex-shrink-0 flex flex-col bg-card">
                    <WorkspaceSwitcher
                        workspaces={workspaces}
                        current={selectedWorkspace}
                        onChange={handleWorkspaceChange}
                    />
                    <ChannelSidebar
                        workspace={selectedWorkspace}
                        selectedChannelId={selectedChannel?.id ?? null}
                        onSelect={handleChannelSelect}
                    />
                </div>

                {/* Main content */}
                <div className="flex-1 flex flex-col min-w-0">
                    {selectedWorkspace && selectedChannel
                        ? (
                            <MessageFeed
                                workspace={selectedWorkspace}
                                channel={selectedChannel}
                                onThreadOpen={handleThreadOpen}
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
                    />
                )}
            </div>
        </TooltipProvider>
    );
}
