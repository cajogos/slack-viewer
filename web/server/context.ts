import { loadWorkspaces } from '../../src/config/workspaces.js';
import { createClient } from '../../src/api/client.js';
import type { WebClient } from '@slack/web-api';

export interface WorkspaceContext
{
    client: WebClient;
    teamId: string;
    name: string;
}

let registry: Map<string, WorkspaceContext> | null = null;

export async function getRegistry(): Promise<Map<string, WorkspaceContext>>
{
    if (registry)
    {
        return registry;
    }

    const profiles = await loadWorkspaces();
    registry = new Map();

    for (const profile of profiles)
    {
        const client = createClient(profile.token);
        const auth = await client.auth.test();
        const teamId = (auth.team_id as string | undefined) ?? profile.name;
        registry.set(profile.name, { client, teamId, name: profile.name });
    }

    return registry;
}

export async function getWorkspace(name: string): Promise<WorkspaceContext | null>
{
    const reg = await getRegistry();
    return reg.get(name) ?? null;
}
