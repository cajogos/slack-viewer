import { useState, useEffect } from 'react';
import { fetchChannels } from '@/api/client';
import type { Channel } from '@/types';

export interface UseChannelsResult
{
    channels: Channel[];
    isLoading: boolean;
    error: string | null;
}

export function useChannels(workspace: string | null): UseChannelsResult
{
    const [channels, setChannels] = useState<Channel[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() =>
    {
        if (!workspace)
        {
            setChannels([]);
            return;
        }

        let cancelled = false;
        setIsLoading(true);
        setError(null);

        fetchChannels(workspace)
            .then(result =>
            {
                if (!cancelled)
                {
                    setChannels(result.channels);
                }
            })
            .catch(err =>
            {
                if (!cancelled)
                {
                    setError((err as Error).message);
                }
            })
            .finally(() =>
            {
                if (!cancelled)
                {
                    setIsLoading(false);
                }
            });

        return () =>
        {
            cancelled = true;
        };
    }, [workspace]);

    return { channels, isLoading, error };
}
