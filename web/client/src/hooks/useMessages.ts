import { useState, useEffect, useCallback } from 'react';
import { fetchMessages } from '@/api/client';
import type { Message } from '@/types';

export interface UseMessagesResult
{
    messages: Message[];
    hasMore: boolean;
    isLoading: boolean;
    error: string | null;
    loadMore: () => void;
}

export function useMessages(workspace: string | null, channelId: string | null): UseMessagesResult
{
    const [messages, setMessages] = useState<Message[]>([]);
    const [cursor, setCursor] = useState<string | undefined>(undefined);
    const [hasMore, setHasMore] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() =>
    {
        if (!workspace || !channelId)
        {
            setMessages([]);
            setCursor(undefined);
            setHasMore(false);
            return;
        }

        let cancelled = false;
        setIsLoading(true);
        setError(null);
        setMessages([]);
        setCursor(undefined);
        setHasMore(false);

        fetchMessages(workspace, channelId)
            .then(result =>
            {
                if (!cancelled)
                {
                    setMessages(result.messages);
                    setHasMore(result.hasMore);
                    setCursor(result.nextCursor);
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
    }, [workspace, channelId]);

    const loadMore = useCallback(() =>
    {
        if (!workspace || !channelId || !cursor || isLoading)
        {
            return;
        }

        setIsLoading(true);
        fetchMessages(workspace, channelId, { cursor })
            .then(result =>
            {
                setMessages(prev => [...result.messages, ...prev]);
                setHasMore(result.hasMore);
                setCursor(result.nextCursor);
            })
            .catch(err =>
            {
                setError((err as Error).message);
            })
            .finally(() =>
            {
                setIsLoading(false);
            });
    }, [workspace, channelId, cursor, isLoading]);

    return { messages, hasMore, isLoading, error, loadMore };
}
