import { describe, it, expect } from 'vitest';
import { toHtml } from '../../src/export/html.js';
import { sampleExportDoc, sampleThreadExportDoc } from '../__fixtures__/exportDoc.js';

describe('toHtml', () => 
{
  it('starts with <!DOCTYPE html> and ends with </html>', () => 
  {
    const html = toHtml(sampleExportDoc);
    expect(html.trimStart()).toMatch(/^<!DOCTYPE html>/);
    expect(html.trimEnd()).toMatch(/<\/html>$/);
  });

  it('contains channel name in title and h1', () => 
  {
    const html = toHtml(sampleExportDoc);
    expect(html).toContain('<title>#general');
    expect(html).toContain('<h1>#general</h1>');
  });

  it('contains workspace name', () => 
  {
    const html = toHtml(sampleExportDoc);
    expect(html).toContain('Acme Corp');
  });

  it('has no external URLs in <link>, <script>, or @import (fully offline)', () => 
  {
    const html = toHtml(sampleExportDoc);
    // No <link> or <script> tags with http(s) sources
    expect(html).not.toMatch(/<link[^>]+https?:\/\//);
    expect(html).not.toMatch(/<script[^>]+https?:\/\//);
    expect(html).not.toMatch(/@import\s+['"]https?:\/\//);
  });

  it('XSS: API-encoded script tag appears as HTML entities', () => 
  {
    const html = toHtml(sampleThreadExportDoc);
    // The fixture has &lt;script&gt; which the mrkdwn converter leaves as &lt;script&gt; in html mode
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>alert(1)</script>');
  });

  it('wraps thread replies in <details open> elements', () => 
  {
    const html = toHtml(sampleThreadExportDoc);
    expect(html).toContain('<details class="replies" open>');
    expect(html).toContain('<summary>');
  });

  it('renders reaction badges as <span class="reaction">', () => 
  {
    const html = toHtml(sampleExportDoc);
    expect(html).toContain('<span class="reaction">');
    expect(html).toContain(':thumbsup: 3');
  });

  it('renders non-image file attachments as links', () => 
  {
    const html = toHtml(sampleExportDoc);
    expect(html).toContain('report.pdf');
    expect(html).toContain('href="https://files.slack.com/report.pdf"');
  });

  it('renders image attachments as <img> tags', () => 
  {
    const html = toHtml(sampleExportDoc);
    expect(html).toContain('<img src="images/screenshot.png"');
    expect(html).toContain('alt="screenshot.png"');
    expect(html).not.toContain('href="images/screenshot.png"');
  });

  it('has a dark background color in the <style> block', () => 
  {
    const html = toHtml(sampleExportDoc);
    // dark theme: background in the style block
    expect(html).toMatch(/<style>[\s\S]*background[\s\S]*<\/style>/);
    expect(html).toContain('#1a1a2e');
  });

  it('HTML-escapes user display names', () => 
  {
    const docWithXssUser = {
      ...sampleExportDoc,
      messages: [{
        ...sampleExportDoc.messages[0],
        user: '<script>bad</script>',
      }],
    };
    const html = toHtml(docWithXssUser);
    expect(html).toContain('&lt;script&gt;bad&lt;/script&gt;');
    expect(html).not.toContain('<script>bad</script>');
  });
});
