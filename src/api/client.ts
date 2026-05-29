import { WebClient, LogLevel, ErrorCode } from '@slack/web-api';
import type { WebAPIRateLimitedError } from '@slack/web-api';

export function createClient(token: string): WebClient 
{
    return new WebClient(token, {
        retryConfig: { retries: 3 },
        logLevel: LogLevel.WARN,
    });
}

function isRateLimitError(err: unknown): err is WebAPIRateLimitedError 
{
    return (
        typeof err === 'object' &&
    err !== null &&
    (err as WebAPIRateLimitedError).code === ErrorCode.RateLimitedError
    );
}

async function sleep(ms: number): Promise<void> 
{
    return new Promise(resolve => setTimeout(resolve, ms));
}

export async function withRateLimit<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> 
{
    let lastError: unknown;
    for (let attempt = 0; attempt < maxAttempts; attempt++) 
    {
        try 
        {
            return await fn();
        }
        catch (err) 
        {
            if (isRateLimitError(err)) 
            {
                lastError = err;
                if (attempt < maxAttempts - 1) 
                {
                    const retryAfter = err.retryAfter ?? 1;
                    await sleep(retryAfter * 1000 + 500);
                }
            }
            else 
            {
                throw err;
            }
        }
    }
    throw lastError;
}
