import type { WebClient } from '@slack/web-api';
import { withRateLimit } from './client.js';
import { getDisplayName, getUserInfo } from './users.js';
import type { Channel } from '../types/slack.js';

async function sleep(ms: number): Promise<void> 
{
    return new Promise(resolve => setTimeout(resolve, ms));
}

export async function listChannels(client: WebClient, teamId: string): Promise<Channel[]> 
{
  // Collect raw channel data across all pages first
  type RawEntry = {
    id: string
    type: Channel['type']
    name: string | null   // null means it's a DM needing resolution
    dmUserId?: string
    memberCount?: number
    isMember: boolean
    deleted?: boolean
  }

  const raw: RawEntry[] = [];
  let cursor: string | undefined;

  do 
  {
      const response = await withRateLimit(() =>
          client.conversations.list({
              types: 'public_channel,private_channel,mpim,im',
              exclude_archived: true,
              limit: 200,
              cursor,
          }),
      );

      for (const conv of response.channels ?? []) 
      {
          if (!conv.id) 
          {
              continue;
          }

          if (conv.is_im) 
          {
              raw.push({
                  id: conv.id,
                  type: 'im',
                  name: null,
                  dmUserId: conv.user,
                  isMember: true,
              });
          }
          else if (conv.is_mpim) 
          {
              raw.push({ id: conv.id, type: 'mpim', name: `#${conv.name ?? conv.id}`, memberCount: conv.num_members, isMember: true });
          }
          else if (conv.is_private) 
          {
              raw.push({ id: conv.id, type: 'private', name: `#${conv.name ?? conv.id}`, memberCount: conv.num_members, isMember: conv.is_member ?? false });
          }
          else 
          {
              raw.push({ id: conv.id, type: 'public', name: `#${conv.name ?? conv.id}`, memberCount: conv.num_members, isMember: conv.is_member ?? false });
          }
      }

      cursor = response.response_metadata?.next_cursor ?? undefined;
      if (cursor) 
      {
          await sleep(100);
      }
  } while (cursor);

  // Resolve all DM display names in parallel; mark deleted users
  const dmEntries = raw.filter(e => e.name === null);
  await Promise.all(
      dmEntries.map(async entry =>
      {
          if (entry.dmUserId)
          {
              const info = await getUserInfo(client, teamId, entry.dmUserId);
              entry.name = info.name;
              entry.deleted = info.deleted;
          }
          else
          {
              entry.name = entry.id;
          }
      }),
  );

  const channels: Channel[] = raw.filter(e => !e.deleted).map(e => ({
      id: e.id,
      type: e.type,
      name: e.name!,
      memberCount: e.memberCount,
      isMember: e.isMember,
  }));

  return channels.sort((a, b) => 
  {
      if (a.isMember !== b.isMember) 
      {
          return a.isMember ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
  });
}
