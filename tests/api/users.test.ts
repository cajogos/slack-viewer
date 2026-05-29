import { vi, describe, it, expect, beforeEach } from 'vitest';
import { createMockClient } from '../__fixtures__/mockClient.js';

describe('getDisplayName', () => 
{
  let getDisplayName: (client: ReturnType<typeof createMockClient>, teamId: string, userId: string) => Promise<string>;
  let client: ReturnType<typeof createMockClient>;

  beforeEach(async () => 
  {
    vi.resetModules();
    const mod = await import('../../src/api/users.js');
    getDisplayName = mod.getDisplayName as typeof getDisplayName;
    client = createMockClient();
  });

  it('resolves profile.display_name when present', async () => 
  {
    vi.mocked(client.users.info).mockResolvedValue({
      ok: true,
      user: { profile: { display_name: 'Alice Smith' }, real_name: 'Alice Real' },
    } as never);

    const name = await getDisplayName(client, 'T1', 'U1');
    expect(name).toBe('Alice Smith');
  });

  it('falls back to real_name when display_name is absent', async () => 
  {
    vi.mocked(client.users.info).mockResolvedValue({
      ok: true,
      user: { profile: { display_name: '' }, real_name: 'Bob Real' },
    } as never);

    const name = await getDisplayName(client, 'T1', 'U2');
    expect(name).toBe('Bob Real');
  });

  it('falls back to userId when both display_name and real_name are absent', async () => 
  {
    vi.mocked(client.users.info).mockResolvedValue({
      ok: true,
      user: { profile: {}, real_name: '' },
    } as never);

    const name = await getDisplayName(client, 'T1', 'U3');
    expect(name).toBe('U3');
  });

  it('falls back to userId when the users.info call fails', async () => 
  {
    vi.mocked(client.users.info).mockRejectedValue(new Error('deleted user'));

    const name = await getDisplayName(client, 'T1', 'U4');
    expect(name).toBe('U4');
  });

  it('caches result: second call with same (teamId, userId) does not call users.info again', async () => 
  {
    vi.mocked(client.users.info).mockResolvedValue({
      ok: true,
      user: { profile: { display_name: 'Cached' }, real_name: '' },
    } as never);

    await getDisplayName(client, 'T1', 'U5');
    await getDisplayName(client, 'T1', 'U5');
    expect(client.users.info).toHaveBeenCalledTimes(1);
  });

  it('cache is scoped by teamId: same userId in a different team triggers a fresh lookup', async () => 
  {
    vi.mocked(client.users.info)
      .mockResolvedValueOnce({
        ok: true,
        user: { profile: { display_name: 'Team A User' }, real_name: '' },
      } as never)
      .mockResolvedValueOnce({
        ok: true,
        user: { profile: { display_name: 'Team B User' }, real_name: '' },
      } as never);

    const nameA = await getDisplayName(client, 'T_A', 'U_SAME');
    const nameB = await getDisplayName(client, 'T_B', 'U_SAME');

    expect(nameA).toBe('Team A User');
    expect(nameB).toBe('Team B User');
    expect(client.users.info).toHaveBeenCalledTimes(2);
  });
});
