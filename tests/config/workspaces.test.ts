import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
}));

import { readFile } from 'node:fs/promises';
import { loadWorkspaces } from '../../src/config/workspaces.js';

 
const mockedReadFile = readFile as unknown as { mockResolvedValue: (v: string) => void; mockResolvedValueOnce: (v: string) => void; mockRejectedValue: (v: unknown) => void };

describe('loadWorkspaces', () => 
{
  beforeEach(() => 
  {
    vi.clearAllMocks();
  });

  it('loads a valid workspaces.json and returns WorkspaceProfile[]', async () => 
  {
    mockedReadFile.mockResolvedValue(JSON.stringify({ 'my-workspace': 'xoxp-abc123' }));
    const profiles = await loadWorkspaces();
    expect(profiles).toEqual([{ name: 'my-workspace', token: 'xoxp-abc123' }]);
  });

  it('returns multiple profiles when multiple workspaces are configured', async () => 
  {
    mockedReadFile.mockResolvedValue(JSON.stringify({ alpha: 'xoxp-aaa', beta: 'xoxp-bbb' }));
    const profiles = await loadWorkspaces();
    expect(profiles).toHaveLength(2);
    expect(profiles[0]).toEqual({ name: 'alpha', token: 'xoxp-aaa' });
    expect(profiles[1]).toEqual({ name: 'beta', token: 'xoxp-bbb' });
  });

  it('throws with a clear message when the file is missing', async () => 
  {
    const err = Object.assign(new Error('not found'), { code: 'ENOENT' });
    mockedReadFile.mockRejectedValue(err);
    await expect(loadWorkspaces()).rejects.toThrow('workspaces.json');
  });

  it('throws when the JSON is malformed', async () => 
  {
    mockedReadFile.mockResolvedValue('{ invalid json');
    await expect(loadWorkspaces()).rejects.toThrow();
  });

  it('throws when the config is empty', async () => 
  {
    mockedReadFile.mockResolvedValue('{}');
    await expect(loadWorkspaces()).rejects.toThrow('empty');
  });

  it('warns but still returns profile when token does not start with xoxp-', async () => 
  {
    mockedReadFile.mockResolvedValue(JSON.stringify({ 'my-workspace': 'xoxb-bot-token' }));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => 
    {});
    const profiles = await loadWorkspaces();
    expect(profiles).toHaveLength(1);
    expect(profiles[0].token).toBe('xoxb-bot-token');
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('xoxp-'));
    warnSpy.mockRestore();
  });
});
