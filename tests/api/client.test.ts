import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { ErrorCode } from '@slack/web-api'
import type { WebAPIRateLimitedError } from '@slack/web-api'
import { withRateLimit } from '../../src/api/client.js'

function makeRateLimitError(retryAfter: number): WebAPIRateLimitedError {
  const err = new Error('Too Many Requests') as WebAPIRateLimitedError
  ;(err as unknown as Record<string, unknown>).code = ErrorCode.RateLimitedError
  ;(err as unknown as Record<string, unknown>).retryAfter = retryAfter
  return err
}

describe('withRateLimit', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('resolves normally on success', async () => {
    const fn = vi.fn().mockResolvedValue('ok')
    await expect(withRateLimit(fn)).resolves.toBe('ok')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('retries after a 429, sleeping (retry_after * 1000) + 500ms', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(makeRateLimitError(2))
      .mockResolvedValue('ok')

    const promise = withRateLimit(fn)
    await vi.advanceTimersByTimeAsync(2500)
    await expect(promise).resolves.toBe('ok')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('loops through repeated 429s and succeeds on a later attempt', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(makeRateLimitError(1))
      .mockRejectedValueOnce(makeRateLimitError(1))
      .mockResolvedValue('ok')

    const promise = withRateLimit(fn, 3)
    await vi.advanceTimersByTimeAsync(3000)
    await expect(promise).resolves.toBe('ok')
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('re-throws the last 429 error after exhausting maxAttempts', async () => {
    const rateLimitError = makeRateLimitError(1)
    const fn = vi.fn().mockRejectedValue(rateLimitError)

    const promise = withRateLimit(fn, 3)
    // Attach the rejection handler BEFORE advancing timers so the promise is never
    // briefly unhandled (which would trigger a Node.js unhandledRejection warning).
    const assertion = expect(promise).rejects.toBe(rateLimitError)
    // maxAttempts=3: 3 calls to fn, sleep only between retries → 2 sleeps of 1500ms
    await vi.advanceTimersByTimeAsync(3000)
    await assertion
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('propagates non-429 errors immediately without retrying', async () => {
    const otherError = new Error('something else')
    const fn = vi.fn().mockRejectedValue(otherError)

    await expect(withRateLimit(fn)).rejects.toBe(otherError)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('defaults retry_after to 1s when absent', async () => {
    const errWithoutRetryAfter = makeRateLimitError(0)
    ;(errWithoutRetryAfter as unknown as Record<string, unknown>).retryAfter = undefined

    const fn = vi.fn()
      .mockRejectedValueOnce(errWithoutRetryAfter)
      .mockResolvedValue('done')

    const promise = withRateLimit(fn)
    await vi.advanceTimersByTimeAsync(1500)
    await expect(promise).resolves.toBe('done')
  })
})
