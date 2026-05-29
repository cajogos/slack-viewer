import type { WebClient } from '@slack/web-api';
import { withRateLimit } from './client.js';

const cache = new Map<string, Map<string, string>>();

export async function getDisplayName(
    client: WebClient,
    teamId: string,
    userId: string,
): Promise<string> 
{
    const teamCache = cache.get(teamId);
    if (teamCache?.has(userId)) 
    {
        return teamCache.get(userId)!;
    }

    try 
    {
        const result = await withRateLimit(() => client.users.info({ user: userId }));
        const user = result.user;
        const name =
      user?.profile?.display_name?.trim() ||
      user?.real_name?.trim() ||
      userId;

        let bucket = cache.get(teamId);
        if (!bucket) 
        {
            bucket = new Map();
            cache.set(teamId, bucket);
        }
        bucket.set(userId, name);
        return name;
    }
    catch 
    {
        return userId;
    }
}
