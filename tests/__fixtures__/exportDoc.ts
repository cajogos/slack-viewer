import type { ExportDoc } from '../../src/export/types.js';

export const sampleExportDoc: ExportDoc = {
  workspace: 'Acme Corp',
  channel: 'general',
  channelType: 'public',
  exportedAt: '2026-05-29T10:00:00.000Z',
  messageCount: 2,
  messages: [
    {
      ts: '1748512800.000000',
      datetime: '29/05/2026, 10:00:00',
      userId: 'U001',
      user: 'Alice',
      text: 'Hello *world*! Check out <https://example.com|this link>.',
      reactions: [
        { name: 'thumbsup', count: 3 },
        { name: 'heart', count: 1 },
      ],
      files: [
        { name: 'report.pdf', url: 'https://files.slack.com/report.pdf', mimetype: 'application/pdf' },
        { name: 'screenshot.png', url: 'images/screenshot.png', mimetype: 'image/png' },
      ],
      replyCount: 2,
    },
    {
      ts: '1748512860.000000',
      datetime: '29/05/2026, 10:01:00',
      userId: 'U002',
      user: 'Bob',
      text: 'Thanks Alice!',
    },
  ],
};

export const sampleThreadExportDoc: ExportDoc = {
  workspace: 'Acme Corp',
  channel: 'C01234567',
  channelType: 'public',
  exportedAt: '2026-05-29T10:00:00.000Z',
  messageCount: 3,
  messages: [
    {
      ts: '1748512800.000000',
      datetime: '29/05/2026, 10:00:00',
      userId: 'U001',
      user: 'Alice',
      text: '&lt;script&gt;alert(1)&lt;/script&gt; — xss test',
      replyCount: 2,
      replies: [
        {
          ts: '1748512860.000000',
          datetime: '29/05/2026, 10:01:00',
          userId: 'U002',
          user: 'Bob',
          text: 'Reply one from Bob',
        },
        {
          ts: '1748512920.000000',
          datetime: '29/05/2026, 10:02:00',
          userId: 'U003',
          user: 'Carol',
          text: 'Reply two from Carol',
        },
      ],
    },
  ],
};
