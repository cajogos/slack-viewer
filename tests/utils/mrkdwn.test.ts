import { describe, it, expect } from 'vitest';
import { mrkdwnToText } from '../../src/utils/mrkdwn.js';

describe('mrkdwnToText', () => 
{
    describe('user mentions (sync)', () => 
    {
        it('renders @userId in plain mode when no name is present', () => 
        {
            expect(mrkdwnToText('<@U123>')).toBe('@U123');
        });

        it('renders mention span in html mode when no name is present', () => 
        {
            expect(mrkdwnToText('<@U123>', { format: 'html' })).toBe(
                '<span class="mention">@U123</span>',
            );
        });

        it('renders @displayname in plain mode when name is resolved', () => 
        {
            expect(mrkdwnToText('<@U123|Alice>')).toBe('@Alice');
        });

        it('renders mention link in html mode when name is resolved', () => 
        {
            expect(mrkdwnToText('<@U123|Alice>', { format: 'html' })).toBe(
                '<a class="mention" href="https://slack.com/team/U123" target="_blank" rel="noopener noreferrer">@Alice</a>',
            );
        });
    });

    describe('channel mentions', () => 
    {
        it('renders #name in plain mode', () => 
        {
            expect(mrkdwnToText('<#C123|general>')).toBe('#general');
        });

        it('renders channel span in html mode', () => 
        {
            expect(mrkdwnToText('<#C123|general>', { format: 'html' })).toBe(
                '<span class="channel">#general</span>',
            );
        });
    });

    describe('links', () => 
    {
        it('renders link with text in plain mode', () => 
        {
            expect(mrkdwnToText('<https://example.com|click here>')).toBe('click here (https://example.com)');
        });

        it('renders markdown link in markdown mode', () => 
        {
            expect(mrkdwnToText('<https://example.com|click here>', { format: 'markdown' })).toBe(
                '[click here](https://example.com)',
            );
        });

        it('renders anchor tag in html mode', () => 
        {
            expect(mrkdwnToText('<https://example.com|click here>', { format: 'html' })).toBe(
                '<a href="https://example.com" target="_blank" rel="noopener noreferrer">click here</a>',
            );
        });

        it('renders bare URL in plain mode', () => 
        {
            expect(mrkdwnToText('<https://example.com>')).toBe('https://example.com');
        });
    });

    describe('bold', () => 
    {
        it('strips bold markers in plain mode', () => 
        {
            expect(mrkdwnToText('*bold text*')).toBe('bold text');
        });

        it('converts to ** in markdown mode', () => 
        {
            expect(mrkdwnToText('*bold text*', { format: 'markdown' })).toBe('**bold text**');
        });

        it('wraps in <strong> in html mode', () => 
        {
            expect(mrkdwnToText('*bold text*', { format: 'html' })).toBe('<strong>bold text</strong>');
        });
    });

    describe('italic', () => 
    {
        it('strips italic markers in plain mode', () => 
        {
            expect(mrkdwnToText('_italic text_')).toBe('italic text');
        });

        it('leaves italic as-is in markdown mode', () => 
        {
            expect(mrkdwnToText('_italic text_', { format: 'markdown' })).toBe('_italic text_');
        });

        it('wraps in <em> in html mode', () => 
        {
            expect(mrkdwnToText('_italic text_', { format: 'html' })).toBe('<em>italic text</em>');
        });
    });

    describe('inline code', () => 
    {
        it('leaves inline code unchanged in plain mode', () => 
        {
            expect(mrkdwnToText('`code`')).toBe('`code`');
        });

        it('wraps in <code> in html mode', () => 
        {
            expect(mrkdwnToText('`code`', { format: 'html' })).toBe('<code>code</code>');
        });
    });

    describe('code blocks', () => 
    {
        it('leaves code block unchanged in plain mode', () => 
        {
            expect(mrkdwnToText('```block```')).toBe('```block```');
        });

        it('wraps in <pre><code> in html mode', () => 
        {
            expect(mrkdwnToText('```block```', { format: 'html' })).toBe(
                '<pre><code>block</code></pre>',
            );
        });
    });

    describe('HTML entities', () => 
    {
        it('decodes &amp; to & in plain mode', () => 
        {
            expect(mrkdwnToText('hello &amp; world')).toBe('hello & world');
        });

        it('leaves &amp; as-is in html mode', () => 
        {
            expect(mrkdwnToText('hello &amp; world', { format: 'html' })).toBe('hello &amp; world');
        });

        it('decodes &lt;&gt; to <> in plain mode', () => 
        {
            expect(mrkdwnToText('&lt;script&gt;')).toBe('<script>');
        });

        it('leaves &lt;&gt; as-is in html mode (XSS safe)', () => 
        {
            expect(mrkdwnToText('&lt;script&gt;', { format: 'html' })).toBe('&lt;script&gt;');
        });
    });
});
