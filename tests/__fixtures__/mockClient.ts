import { vi } from 'vitest'
import type { WebClient } from '@slack/web-api'

export function createMockClient(overrides: Record<string, unknown> = {}): WebClient {
  return {
    auth: {
      test: vi.fn().mockResolvedValue({
        ok: true,
        user_id: 'U123',
        team_id: 'T456',
        team: 'Test Workspace',
      }),
    },
    users: {
      info: vi.fn(),
    },
    conversations: {
      list: vi.fn(),
      history: vi.fn(),
      replies: vi.fn(),
      members: vi.fn(),
    },
    ...overrides,
  } as unknown as WebClient
}
