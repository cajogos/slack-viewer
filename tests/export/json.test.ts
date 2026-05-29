import { describe, it, expect } from 'vitest';
import { toJson } from '../../src/export/json.js';
import { sampleExportDoc } from '../__fixtures__/exportDoc.js';

describe('toJson', () => 
{
  it('produces valid JSON', () => 
  {
    expect(() => JSON.parse(toJson(sampleExportDoc))).not.toThrow();
  });

  it('includes all messages', () => 
  {
    const parsed = JSON.parse(toJson(sampleExportDoc));
    expect(parsed.messages).toHaveLength(sampleExportDoc.messages.length);
  });

  it('serialises reactions with name and count', () => 
  {
    const parsed = JSON.parse(toJson(sampleExportDoc));
    const reactions = parsed.messages[0].reactions;
    expect(reactions).toEqual([
      { name: 'thumbsup', count: 3 },
      { name: 'heart', count: 1 },
    ]);
  });

  it('serialises file attachments with name, url, mimetype', () => 
  {
    const parsed = JSON.parse(toJson(sampleExportDoc));
    const files = parsed.messages[0].files;
    expect(files[0].name).toBe('report.pdf');
    expect(files[0].url).toBe('https://files.slack.com/report.pdf');
    expect(files[0].mimetype).toBe('application/pdf');
  });

  it('includes workspace, channel, exportedAt metadata', () => 
  {
    const parsed = JSON.parse(toJson(sampleExportDoc));
    expect(parsed.workspace).toBe('Acme Corp');
    expect(parsed.channel).toBe('general');
    expect(parsed.exportedAt).toBe('2026-05-29T10:00:00.000Z');
  });

  it('pretty-prints with 2-space indent', () => 
  {
    const output = toJson(sampleExportDoc);
    expect(output).toContain('\n  ');
  });
});
