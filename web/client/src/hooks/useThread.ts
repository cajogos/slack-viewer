import { useState, useEffect } from 'react';
import { fetchThread } from '@/api/client';
import type { Message } from '@/types';

export interface UseThreadResult
{
    messages: Message[];
    isLoading: boolean;
    error: string | null;
}

export function useThread(
    workspace: string | null,
    channelId: string | null,
    threadTs: string | null,
): UseThreadResult
{
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() =>
    {
        if (!workspace || !channelId || !threadTs)
        {
            setMessages([]);
            return;
        }

        let cancelled = false;
        setIsLoading(true);
        setError(null);

        fetchThread(workspace, channelId, threadTs)
            .then(result =>
            {
                if (!cancelled)
                {
                    setMessages(result.messages);
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
    }, [workspace, channelId, threadTs]);

    return { messages, isLoading, error };
}
