import { describe, it, expect } from 'vitest';
import { toMarkdown } from '../../src/export/markdown.js';
import { sampleExportDoc, sampleThreadExportDoc } from '../__fixtures__/exportDoc.js';

describe('toMarkdown', () => 
{
  it('starts with a # header containing channel and workspace', () => 
  {
    const md = toMarkdown(sampleExportDoc);
    expect(md).toMatch(/^# #general — Acme Corp/m);
  });

  it('includes the exportedAt timestamp', () => 
  {
    const md = toMarkdown(sampleExportDoc);
    expect(md).toContain('2026-05-29T10:00:00.000Z');
  });

  it('includes the resolved username', () => 
  {
    const md = toMarkdown(sampleExportDoc);
    expect(md).toContain('**Alice**');
    expect(md).toContain('**Bob**');
  });

  it('includes the message datetime', () => 
  {
    const md = toMarkdown(sampleExportDoc);
    expect(md).toContain('29/05/2026');
  });

  it('renders mrkdwn bold as markdown bold', () => 
  {
    const md = toMarkdown(sampleExportDoc);
    expect(md).toContain('**world**');
  });

  it('renders reactions as :name: ×N', () => 
  {
    const md = toMarkdown(sampleExportDoc);
    expect(md).toContain(':thumbsup: ×3');
    expect(md).toContain(':heart: ×1');
  });

  it('renders file attachments with 📎 prefix and URL', () => 
  {
    const md = toMarkdown(sampleExportDoc);
    expect(md).toContain('📎 report.pdf');
    expect(md).toContain('https://files.slack.com/report.pdf');
  });

  it('shows reply count for thread parents in channel export', () => 
  {
    const md = toMarkdown(sampleExportDoc);
    expect(md).toContain('↳ 2 replies');
  });

  it('separates top-level messages with ---', () => 
  {
    const md = toMarkdown(sampleExportDoc);
    expect(md).toContain('\n---\n');
  });

  it('renders thread replies as > blockquotes marked *(reply)*', () => 
  {
    const md = toMarkdown(sampleThreadExportDoc);
    expect(md).toContain('*(reply)*');
    expect(md).toContain('> **Bob**');
    expect(md).toContain('> **Carol**');
  });

  it('renders reply text as blockquote', () => 
  {
    const md = toMarkdown(sampleThreadExportDoc);
    expect(md).toContain('> Reply one from Bob');
  });
});
