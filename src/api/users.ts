import type { WebClient } from '@slack/web-api';
import { withRateLimit } from './client.js';

type UserInfo = { name: string; deleted: boolean; imageUrl?: string };

const cache = new Map<string, Map<string, UserInfo>>();

async function fetchUserInfo(
    client: WebClient,
    teamId: string,
    userId: string,
): Promise<UserInfo>
{
    const teamCache = cache.get(teamId);
    if (teamCache?.has(userId))
    {
        return teamCache.get(userId)!;
    }

    let info: UserInfo;
    try
    {
        const result = await withRateLimit(() => client.users.info({ user: userId }));
        const user = result.user;
        info = {
            name: user?.profile?.display_name?.trim() || user?.real_name?.trim() || userId,
            deleted: user?.deleted ?? false,
            imageUrl: (user?.profile as Record<string, unknown> | undefined)?.['image_72'] as string | undefined,
        };
    }
    catch
    {
        info = { name: userId, deleted: false };
    }

    let bucket = cache.get(teamId);
    if (!bucket)
    {
        bucket = new Map();
        cache.set(teamId, bucket);
    }
    bucket.set(userId, info);
    return info;
}

export async function getDisplayName(
    client: WebClient,
    teamId: string,
    userId: string,
): Promise<string>
{
    return (await fetchUserInfo(client, teamId, userId)).name;
}

export async function getUserInfo(
    client: WebClient,
    teamId: string,
    userId: string,
): Promise<UserInfo>
{
    return fetchUserInfo(client, teamId, userId);
}
