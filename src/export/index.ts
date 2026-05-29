import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, basename, extname, join } from 'node:path';
import chalk from 'chalk';
import type { ExportDoc, ExportMessage } from './types.js';
import { toJson } from './json.js';
import { toMarkdown } from './markdown.js';
import { toHtml } from './html.js';
import { loadWorkspaces } from '../config/workspaces.js';
import { createClient } from '../api/client.js';
import { listChannels } from '../api/channels.js';
import { fetchHistory } from '../api/messages.js';
import { fetchThread, parseThreadUrl } from '../api/threads.js';
import { resolveMentionIds } from '../utils/mrkdwn.js';
import type { WebClient } from '@slack/web-api';
import type { Message } from '../types/slack.js';
import type { Channel } from '../types/slack.js';

export type { ExportDoc, ExportMessage, ExportReaction, ExportFile } from './types.js';
export type ExportFormat = 'json' | 'markdown' | 'html'

const EXT: Record<ExportFormat, string> = { json: 'json', markdown: 'md', html: 'html' };

export function formatDoc(doc: ExportDoc, format: ExportFormat): string 
{
  if (format === 'json') 
  {
    return toJson(doc);
  }
  if (format === 'markdown') 
  {
    return toMarkdown(doc);
  }
  return toHtml(doc);
}

export function getExtension(format: ExportFormat): string 
{
  return EXT[format];
}

export function defaultFilename(channel: string, format: ExportFormat): string 
{
  const safe = channel.replace(/^[#🔒💬\s]+/, '').replace(/\s+/g, '-');
  const date = new Date().toISOString().slice(0, 10);
  return `${safe}-${date}.${EXT[format]}`;
}

export function defaultOutputPath(channel: string, format: ExportFormat): string 
{
  mkdirSync('./exports', { recursive: true });
  return resolve(`./exports/${defaultFilename(channel, format)}`);
}

function msgToExport(m: Message): ExportMessage 
{
  return {
    ts: m.ts,
    datetime: m.datetime,
    userId: m.userId,
    user: m.user,
    text: m.text,
    ...(m.reactions ? { reactions: m.reactions } : {}),
    ...(m.files ? { files: m.files.map(f => ({ name: f.name, url: f.url, mimetype: f.mimetype })) } : {}),
    ...(m.replyCount != null ? { replyCount: m.replyCount } : {}),
  };
}

export function buildChannelExportDoc(workspace: string, channel: Channel, messages: Message[]): ExportDoc 
{
  return {
    workspace,
    channel: channel.name.replace(/^#/, ''),
    channelType: channel.type,
    exportedAt: new Date().toISOString(),
    messageCount: messages.length,
    messages: messages.map(msgToExport),
  };
}

export function buildThreadExportDoc(workspace: string, channelId: string, messages: Message[]): ExportDoc 
{
  const [root, ...replies] = messages;
  return {
    workspace,
    channel: channelId,
    channelType: 'public',
    exportedAt: new Date().toISOString(),
    messageCount: messages.length,
    messages: root
      ? [{
        ...msgToExport(root),
        replies: replies.map(msgToExport),
      }]
      : [],
  };
}

async function resolveMessageTexts(messages: Message[], client: WebClient, teamId: string): Promise<Message[]> 
{
  return Promise.all(messages.map(async m => ({
    ...m,
    text: await resolveMentionIds(m.text, client, teamId),
  })));
}

async function downloadImages(
  messages: Message[],
  outputPath: string,
  token: string,
): Promise<Message[]> 
{
  const imageFiles = messages.flatMap(m =>
    (m.files ?? []).filter(f => f.urlPrivate && f.mimetype?.startsWith('image/')),
  );
  if (imageFiles.length === 0) 
  {
    return messages;
  }

  const fileExt = extname(outputPath);
  const base = fileExt ? outputPath.slice(0, -fileExt.length) : outputPath;
  const filesDir = `${base}_files`;
  const dirName = basename(filesDir);
  mkdirSync(filesDir, { recursive: true });

  const urlToRelative = new Map<string, string>();
  const usedNames = new Set<string>();

  for (const file of imageFiles) 
  {
    const privateUrl = file.urlPrivate!;
    if (urlToRelative.has(privateUrl)) 
    {
      continue;
    }

    try 
    {
      const res = await fetch(privateUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) 
      {
        console.error(`Warning: failed to download ${file.name} (HTTP ${res.status})`);
        continue;
      }

      let safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_') || `image_${urlToRelative.size}.bin`;
      if (usedNames.has(safeName)) 
      {
        const dot = safeName.lastIndexOf('.');
        const ext = dot !== -1 ? safeName.slice(dot) : '';
        const stem = dot !== -1 ? safeName.slice(0, dot) : safeName;
        let n = 2;
        while (usedNames.has(`${stem}_${n}${ext}`)) 
        {
          n++;
        }
        safeName = `${stem}_${n}${ext}`;
      }
      usedNames.add(safeName);

      writeFileSync(join(filesDir, safeName), Buffer.from(await res.arrayBuffer()));
      urlToRelative.set(privateUrl, `${dirName}/${safeName}`);
    }
    catch (err) 
    {
      console.error(`Warning: failed to download ${file.name}: ${(err as Error).message}`);
    }
  }

  if (urlToRelative.size === 0) 
  {
    return messages;
  }

  return messages.map(m => 
  {
    if (!m.files) 
    {
      return m;
    }
    return {
      ...m,
      files: m.files.map(f =>
        f.urlPrivate && urlToRelative.has(f.urlPrivate)
          ? { ...f, url: urlToRelative.get(f.urlPrivate)! }
          : f,
      ),
    };
  });
}

export interface ExportCommandOpts {
  channel?: string
  format?: string
  output?: string
  from?: string
  to?: string
}

export interface ThreadCommandOpts {
  url?: string
  format?: string
  output?: string
}

export async function runExportCommand(opts: ExportCommandOpts): Promise<void> 
{
  const { channel, format: formatStr, output: outputArg, from, to } = opts;

  if (!channel) 
  {
    console.error('Error: --channel is required');
    console.error('Usage: slack-viewer export --channel <name> --format json|markdown|html');
    process.exit(1);
  }
  if (!formatStr || !['json', 'markdown', 'html'].includes(formatStr)) 
  {
    console.error('Error: --format must be one of: json, markdown, html');
    process.exit(1);
  }
  const format = formatStr as ExportFormat;

  const profiles = await loadWorkspaces();
  const profile = profiles[0];
  if (profiles.length > 1) 
  {
    console.log(chalk.dim(`Using workspace: ${profile.name}`));
  }

  const client = createClient(profile.token);
  const auth = await client.auth.test();
  const teamId = (auth.team as string | undefined) ?? profile.name;

  console.error('Loading channels…');
  const channels = await listChannels(client, teamId);

  const found = channels.find(c =>
    c.id === channel || c.name === channel || c.name === `#${channel}`,
  );
  if (!found) 
  {
    console.error(`Error: Channel "${channel}" not found`);
    process.exit(1);
  }

  let oldest: string | undefined;
  let latest: string | undefined;
  if (from) 
  {
    oldest = (Date.parse(`${from}T00:00:00Z`) / 1000).toString();
  }
  if (to) 
  {
    latest = ((Date.parse(`${to}T00:00:00Z`) + 86_400_000) / 1000).toString();
  }

  const allMessages: Message[] = [];
  let cursor: string | undefined;
  let page = 0;

  do 
  {
    page++;
    console.error(`Fetching messages (page ${page}, ${allMessages.length} so far)…`);
    const result = await fetchHistory(client, teamId, found.id, { cursor, oldest, latest });
    allMessages.push(...result.messages);
    cursor = result.nextCursor;
  } while (cursor);

  console.error(`Fetched ${allMessages.length} messages`);

  let exportMessages = format !== 'json' ? await resolveMessageTexts(allMessages, client, teamId) : allMessages;

  const outPath = outputArg ?? defaultOutputPath(found.name.replace(/^#/, ''), format);

  if (format === 'html') 
  {
    exportMessages = await downloadImages(exportMessages, outPath, profile.token);
  }

  const doc = buildChannelExportDoc(teamId, found, exportMessages);
  writeFileSync(outPath, formatDoc(doc, format), 'utf8');
  console.log(chalk.green(`✓ Saved to ${outPath}`));
}

export async function runThreadCommand(opts: ThreadCommandOpts): Promise<void> 
{
  const { url, format: formatStr, output: outputArg } = opts;

  if (!url) 
  {
    console.error('Error: thread URL is required');
    console.error('Usage: slack-viewer thread <url> --format json|markdown|html');
    process.exit(1);
  }
  if (!formatStr || !['json', 'markdown', 'html'].includes(formatStr)) 
  {
    console.error('Error: --format must be one of: json, markdown, html');
    process.exit(1);
  }
  const format = formatStr as ExportFormat;

  const parsed = parseThreadUrl(url);
  if (!parsed) 
  {
    console.error('Error: Could not parse thread URL');
    console.error('Expected: https://workspace.slack.com/archives/C12345678/p1234567890123456');
    process.exit(1);
  }

  const profiles = await loadWorkspaces();
  const profile = profiles[0];
  if (profiles.length > 1) 
  {
    console.log(chalk.dim(`Using workspace: ${profile.name}`));
  }

  const client = createClient(profile.token);
  const auth = await client.auth.test();
  const teamId = (auth.team as string | undefined) ?? profile.name;

  console.error('Fetching thread…');
  let messages = await fetchThread(client, teamId, parsed.channelId, parsed.threadTs);
  console.error(`Fetched ${messages.length} messages`);

  if (messages.length === 0) 
  {
    console.error('Error: No messages found in thread');
    process.exit(1);
  }

  if (format !== 'json') 
  {
    messages = await resolveMessageTexts(messages, client, teamId);
  }

  const outPath = outputArg ?? defaultOutputPath(parsed.channelId.toLowerCase(), format);

  if (format === 'html') 
  {
    messages = await downloadImages(messages, outPath, profile.token);
  }

  const doc = buildThreadExportDoc(teamId, parsed.channelId, messages);
  writeFileSync(outPath, formatDoc(doc, format), 'utf8');
  console.log(chalk.green(`✓ Saved to ${outPath}`));
}
