import { vi, describe, it, expect, beforeEach } from 'vitest'
import { createMockClient } from '../__fixtures__/mockClient.js'
import { fakeRawMessages } from '../__fixtures__/messages.js'
import { fetchHistory } from '../../src/api/messages.js'

describe('fetchHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns messages in chronological order (oldest first)', async () => {
    const client = createMockClient()
    vi.mocked(client.conversations.history).mockResolvedValue({
      ok: true,
      messages: [fakeRawMessages[0], fakeRawMessages[4]], // newest-first (ts desc)
      has_more: false,
      response_metadata: { next_cursor: '' },
    } as never)
    vi.mocked(client.users.info).mockResolvedValue({
      ok: true,
      user: { id: 'U001', profile: { display_name: 'Alice' }, real_name: 'Alice Smith' },
    } as never)

    const { messages } = await fetchHistory(client as never, 'T001', 'C001')

    expect(messages[0].ts).toBe('1700000000.000000') // oldest first
    expect(messages[1].ts).toBe('1700000003.000000')
  })

  it('resolves user IDs to display names', async () => {
    const client = createMockClient()
    vi.mocked(client.conversations.history).mockResolvedValue({
      ok: true,
      messages: [fakeRawMessages[4]], // user U001
      has_more: false,
      response_metadata: { next_cursor: '' },
    } as never)
    vi.mocked(client.users.info).mockResolvedValue({
      ok: true,
      user: { id: 'U001', profile: { display_name: 'Alice' }, real_name: 'Alice Smith' },
    } as never)

    const { messages } = await fetchHistory(client as never, 'T001', 'C001')

    expect(messages[0].user).toBe('Alice')
    expect(messages[0].userId).toBe('U001')
  })

  it('uses username field for bot messages without calling getDisplayName', async () => {
    const client = createMockClient()
    vi.mocked(client.conversations.history).mockResolvedValue({
      ok: true,
      messages: [fakeRawMessages[1]], // bot_message
      has_more: false,
      response_metadata: { next_cursor: '' },
    } as never)

    const { messages } = await fetchHistory(client as never, 'T001', 'C001')

    expect(messages[0].user).toBe('MyBot')
    expect(messages[0].userId).toBe('bot')
    expect(client.users.info).not.toHaveBeenCalled()
  })

  it('filters out system subtypes', async () => {
    const client = createMockClient()
    vi.mocked(client.conversations.history).mockResolvedValue({
      ok: true,
      messages: [fakeRawMessages[4], fakeRawMessages[3], fakeRawMessages[1]], // includes channel_join
      has_more: false,
      response_metadata: { next_cursor: '' },
    } as never)
    vi.mocked(client.users.info).mockResolvedValue({
      ok: true,
      user: { id: 'U001', profile: { display_name: 'Alice' }, real_name: 'Alice' },
    } as never)

    const { messages } = await fetchHistory(client as never, 'T001', 'C001')

    expect(messages.every(m => m.userId !== '' || m.user !== '')).toBe(true)
    // channel_join should be absent
    expect(messages.find(m => m.text === 'U001 has joined the channel')).toBeUndefined()
  })

  it('filters out bot messages with empty text', async () => {
    const client = createMockClient()
    vi.mocked(client.conversations.history).mockResolvedValue({
      ok: true,
      messages: [fakeRawMessages[1], fakeRawMessages[2]], // bot with text, bot with empty text
      has_more: false,
      response_metadata: { next_cursor: '' },
    } as never)

    const { messages } = await fetchHistory(client as never, 'T001', 'C001')

    expect(messages).toHaveLength(1)
    expect(messages[0].user).toBe('MyBot')
  })

  it('returns hasMore and nextCursor when more pages exist', async () => {
    const client = createMockClient()
    vi.mocked(client.conversations.history).mockResolvedValue({
      ok: true,
      messages: [fakeRawMessages[0]],
      has_more: true,
      response_metadata: { next_cursor: 'cursor-abc' },
    } as never)
    vi.mocked(client.users.info).mockResolvedValue({
      ok: true,
      user: { id: 'U003', profile: { display_name: 'Charlie' }, real_name: 'Charlie' },
    } as never)

    const result = await fetchHistory(client as never, 'T001', 'C001')

    expect(result.hasMore).toBe(true)
    expect(result.nextCursor).toBe('cursor-abc')
  })
})
