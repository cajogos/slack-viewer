import { useState, useEffect } from 'react';
import { fetchEmoji } from '@/api/client';

export function useEmoji(workspace: string | null): Record<string, string>
{
    const [emojiMap, setEmojiMap] = useState<Record<string, string>>({});

    useEffect(() =>
    {
        if (!workspace)
        {
            setEmojiMap({});
            return;
        }
        fetchEmoji(workspace)
            .then(data => setEmojiMap(data.emoji))
            .catch(() => setEmojiMap({}));
    }, [workspace]);

    return emojiMap;
}
