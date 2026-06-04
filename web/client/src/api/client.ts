import type { Channel, Message } from '@/types';

const BASE = '/api';

async function apiFetch<T>(url: string): Promise<T>
{
    const res = await fetch(url);
    if (!res.ok)
    {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    return res.json() as Promise<T>;
}

export async function fetchWorkspaces(): Promise<{ workspaces: Array<{ name: string }> }>
{
    return apiFetch(`${BASE}/workspaces`);
}

export async function fetchChannels(workspace: string): Promise<{ channels: Channel[] }>
{
    return apiFetch(`${BASE}/workspaces/${encodeURIComponent(workspace)}/channels`);
}

export interface MessagesResult
{
    messages: Message[];
    hasMore: boolean;
    nextCursor?: string;
}

export async function fetchMessages(
    workspace: string,
    channelId: string,
    opts?: { cursor?: string; oldest?: string; latest?: string },
): Promise<MessagesResult>
{
    const params = new URLSearchParams();
    if (opts?.cursor)
    {
        params.set('cursor', opts.cursor);
    }
    if (opts?.oldest)
    {
        params.set('oldest', opts.oldest);
    }
    if (opts?.latest)
    {
        params.set('latest', opts.latest);
    }
    const qs = params.toString();
    return apiFetch(
        `${BASE}/workspaces/${encodeURIComponent(workspace)}/channels/${encodeURIComponent(channelId)}/messages${qs ? `?${qs}` : ''}`,
    );
}

export async function fetchThread(
    workspace: string,
    channelId: string,
    threadTs: string,
): Promise<{ messages: Message[] }>
{
    return apiFetch(
        `${BASE}/workspaces/${encodeURIComponent(workspace)}/channels/${encodeURIComponent(channelId)}/thread?ts=${encodeURIComponent(threadTs)}`,
    );
}

export async function downloadExport(
    workspace: string,
    channelId: string,
    channelName: string,
    format: string,
    opts?: { oldest?: string; latest?: string; threadTs?: string },
): Promise<{ blob: Blob; filename: string }>
{
    const params = new URLSearchParams({ format, channelName });
    if (opts?.oldest)
    {
        params.set('oldest', opts.oldest);
    }
    if (opts?.latest)
    {
        params.set('latest', opts.latest);
    }
    if (opts?.threadTs)
    {
        params.set('ts', opts.threadTs);
    }

    const res = await fetch(
        `${BASE}/workspaces/${encodeURIComponent(workspace)}/channels/${encodeURIComponent(channelId)}/export?${params}`,
    );
    if (!res.ok)
    {
        throw new Error(`Export failed: HTTP ${res.status}`);
    }

    const disposition = res.headers.get('content-disposition') ?? '';
    const match = disposition.match(/filename="([^"]+)"/);
    const filename = match?.[1] ?? `export.${format === 'markdown' ? 'md' : format}`;
    const blob = await res.blob();
    return { blob, filename };
}
