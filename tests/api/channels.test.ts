import { vi, describe, it, expect, beforeEach } from 'vitest'
import { createMockClient } from '../__fixtures__/mockClient.js'
import { fakeRawChannels } from '../__fixtures__/channels.js'
import { listChannels } from '../../src/api/channels.js'

describe('listChannels', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns channels with correct isMember flags', async () => {
    const client = createMockClient()
    vi.mocked(client.conversations.list).mockResolvedValue({
      ok: true,
      channels: [fakeRawChannels[0], fakeRawChannels[1]],
      response_metadata: { next_cursor: '' },
    } as never)

    const channels = await listChannels(client as never, 'T001')

    const general = channels.find(c => c.id === 'C001')
    const random = channels.find(c => c.id === 'C002')

    expect(general?.isMember).toBe(true)
    expect(random?.isMember).toBe(false)
  })

  it('paginates across two pages and returns merged results', async () => {
    const client = createMockClient()
    vi.mocked(client.conversations.list)
      .mockResolvedValueOnce({
        ok: true,
        channels: [fakeRawChannels[0]],
        response_metadata: { next_cursor: 'cursor-page-2' },
      } as never)
      .mockResolvedValueOnce({
        ok: true,
        channels: [fakeRawChannels[2]],
        response_metadata: { next_cursor: '' },
      } as never)

    const channels = await listChannels(client as never, 'T001')

    expect(channels).toHaveLength(2)
    expect(channels.map(c => c.id)).toContain('C001')
    expect(channels.map(c => c.id)).toContain('G001')
  })

  it('sets isMember false for unjoined public channel', async () => {
    const client = createMockClient()
    vi.mocked(client.conversations.list).mockResolvedValue({
      ok: true,
      channels: [fakeRawChannels[1]], // random, is_member: false
      response_metadata: { next_cursor: '' },
    } as never)

    const channels = await listChannels(client as never, 'T001')

    expect(channels[0].isMember).toBe(false)
    expect(channels[0].name).toBe('#random')
  })

  it('resolves IM partner display name as channel name', async () => {
    const client = createMockClient()
    vi.mocked(client.conversations.list).mockResolvedValue({
      ok: true,
      channels: [fakeRawChannels[3]], // DM with user U999
      response_metadata: { next_cursor: '' },
    } as never)
    vi.mocked(client.users.info).mockResolvedValue({
      ok: true,
      user: { id: 'U999', profile: { display_name: 'Alice' }, real_name: 'Alice Smith' },
    } as never)

    const channels = await listChannels(client as never, 'T001')

    expect(channels[0].type).toBe('im')
    expect(channels[0].name).toBe('Alice')
    expect(client.users.info).toHaveBeenCalledWith({ user: 'U999' })
  })
})
