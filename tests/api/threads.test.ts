import { describe, it, expect } from 'vitest';
import { parseThreadUrl } from '../../src/api/threads.js';

describe('parseThreadUrl', () => 
{
  it('parses a standard Slack thread URL', () => 
  {
    const result = parseThreadUrl(
      'https://acme.slack.com/archives/C12345678/p1234567890123456',
    );
    expect(result).toEqual({ channelId: 'C12345678', threadTs: '1234567890.123456' });
  });

  it('prefers thread_ts query param over p-number', () => 
  {
    const result = parseThreadUrl(
      'https://acme.slack.com/archives/C12345678/p1234567890123456?thread_ts=1234567890.999000&cid=C12345678',
    );
    expect(result).toEqual({ channelId: 'C12345678', threadTs: '1234567890.999000' });
  });

  it('returns null for an unrecognised URL', () => 
  {
    expect(parseThreadUrl('https://example.com/not-slack')).toBeNull();
    expect(parseThreadUrl('not-a-url')).toBeNull();
    expect(parseThreadUrl('')).toBeNull();
  });

  it('inserts dot exactly 10 digits from the left of the p-number', () => 
  {
    const result = parseThreadUrl(
      'https://workspace.slack.com/archives/C001/p1700000000500000',
    );
    expect(result?.threadTs).toBe('1700000000.500000');
  });
});
