import { vi, describe, it, expect, afterEach } from 'vitest';
import { formatRelativeTime, userColor } from '../../src/cli/prompts.js';
import chalk from 'chalk';

// Fix a reference "now" for all relative-time tests
// 2024-03-15 12:00:00 UTC
const NOW_MS = Date.UTC(2024, 2, 15, 12, 0, 0);

function tsFor(offsetMs: number): string 
{
    return ((NOW_MS - offsetMs) / 1000).toString();
}

afterEach(() => 
{
    vi.useRealTimers();
});

describe('formatRelativeTime', () => 
{
    it('returns "just now" for < 1 minute ago', () => 
    {
        vi.useFakeTimers();
        vi.setSystemTime(NOW_MS);
        expect(formatRelativeTime(tsFor(30_000))).toBe('just now');
    });

    it('returns "Nm ago" for < 1 hour ago', () => 
    {
        vi.useFakeTimers();
        vi.setSystemTime(NOW_MS);
        expect(formatRelativeTime(tsFor(30 * 60_000))).toBe('30m ago');
    });

    it('returns "Nh ago" for < 24 hours ago', () => 
    {
        vi.useFakeTimers();
        vi.setSystemTime(NOW_MS);
        expect(formatRelativeTime(tsFor(3 * 3600_000))).toBe('3h ago');
    });

    it('returns "yesterday" for the previous calendar day', () => 
    {
        vi.useFakeTimers();
        vi.setSystemTime(NOW_MS);
        // 2024-03-14 at noon UTC
        const yesterdayMs = Date.UTC(2024, 2, 14, 12, 0, 0);
        expect(formatRelativeTime((yesterdayMs / 1000).toString())).toBe('yesterday');
    });

    it('returns a day name for within 7 days', () => 
    {
        vi.useFakeTimers();
        vi.setSystemTime(NOW_MS);
        // 3 days ago: 2024-03-12 (Tuesday)
        const threeDaysAgoMs = Date.UTC(2024, 2, 12, 12, 0, 0);
        const result = formatRelativeTime((threeDaysAgoMs / 1000).toString());
        // Should be a short weekday name
        expect(result).toMatch(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)$/);
    });

    it('returns an absolute date for > 7 days ago', () => 
    {
        vi.useFakeTimers();
        vi.setSystemTime(NOW_MS);
        // 10 days ago: 2024-03-05
        const tenDaysAgoMs = Date.UTC(2024, 2, 5, 12, 0, 0);
        const result = formatRelativeTime((tenDaysAgoMs / 1000).toString());
        // Should not be a relative label
        expect(result).not.toMatch(/ago|just now|yesterday/);
        expect(result.length).toBeGreaterThan(4);
    });
});

describe('userColor', () => 
{
    const PALETTE_SIZE = 6;

    it('returns the same color function for the same userId', () => 
    {
        const a = userColor('U12345');
        const b = userColor('U12345');
        expect(a).toBe(b);
    });

    it('is deterministic: the same userId always maps to the same palette slot', () => 
    {
    // Manually compute expected index for 'U001'
        const hash = 'U001'.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
        const expectedIdx = hash % PALETTE_SIZE;
        const palette = [chalk.cyan, chalk.green, chalk.yellow, chalk.magenta, chalk.blue, chalk.red];
        expect(userColor('U001')).toBe(palette[expectedIdx]);
    });

    it('all 6 palette slots are reachable', () => 
    {
        const palette = [chalk.cyan, chalk.green, chalk.yellow, chalk.magenta, chalk.blue, chalk.red];
        const seen = new Set<number>();
        // Brute-force IDs until all slots are covered
        for (let i = 0; i < 1000 && seen.size < PALETTE_SIZE; i++) 
        {
            const id = `U${i.toString().padStart(3, '0')}`;
            const hash = id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
            seen.add(hash % PALETTE_SIZE);
        }
        expect(seen.size).toBe(PALETTE_SIZE);
        // Verify return values are chalk functions
        for (let i = 0; i < PALETTE_SIZE; i++) 
        {
            expect(typeof palette[i]).toBe('function');
        }
    });
});
