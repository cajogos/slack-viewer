import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export interface WorkspaceProfile {
  name: string
  token: string
}

export async function loadWorkspaces(): Promise<WorkspaceProfile[]> 
{
    const configPath = fileURLToPath(new URL('../../workspaces.json', import.meta.url));

    let raw: string;
    try 
    {
        raw = await readFile(configPath, 'utf8');
    }
    catch (err) 
    {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') 
        {
            throw new Error(
                'workspaces.json not found. Create it from workspaces.json.example and add your Slack user token(s).',
            );
        }
        throw err;
    }

    let data: unknown;
    try 
    {
        data = JSON.parse(raw);
    }
    catch 
    {
        throw new Error('workspaces.json contains invalid JSON.');
    }

    if (typeof data !== 'object' || data === null || Array.isArray(data)) 
    {
        throw new Error('workspaces.json must be a JSON object mapping workspace names to tokens.');
    }

    const entries = Object.entries(data as Record<string, unknown>);

    if (entries.length === 0) 
    {
        throw new Error('workspaces.json is empty. Add at least one workspace profile.');
    }

    return entries.map(([name, token]) => 
    {
        if (typeof token !== 'string') 
        {
            throw new Error(`Workspace "${name}": token must be a string.`);
        }
        if (!token.startsWith('xoxp-')) 
        {
            console.warn(
                `Warning: token for workspace "${name}" does not start with "xoxp-". Only user tokens (xoxp-) are supported.`,
            );
        }
        return { name, token };
    });
}
