import { execFile } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import chalk from 'chalk';
import { select, input } from '@inquirer/prompts';
import type { WebClient } from '@slack/web-api';
import { fetchHistory } from '../api/messages.js';
import { fetchThread, parseThreadUrl } from '../api/threads.js';
import { resolveMentionIds } from '../utils/mrkdwn.js';
import { spinner, confirm, inputPath, displayMessages } from './prompts.js';
import type { Channel } from '../types/slack.js';
import type { Message } from '../types/slack.js';
import {
  formatDoc,
  buildChannelExportDoc,
  buildThreadExportDoc,
  type ExportFormat,
} from '../export/index.js';

const EXT: Record<ExportFormat, string> = { json: 'json', markdown: 'md', html: 'html' };

function todayStr(): string 
{
  return new Date().toISOString().slice(0, 10);
}

function defaultExportPath(channel: Channel, fmt: ExportFormat): string 
{
  const name = channel.name.replace(/^[#🔒💬\s]+/, '').replace(/\s+/g, '-');
  return `./exports/${name}-${todayStr()}.${EXT[fmt]}`;
}

function dateToOldest(dateStr: string): string 
{
  return (Date.parse(`${dateStr}T00:00:00Z`) / 1000).toString();
}

function dateToLatest(dateStr: string): string 
{
  return ((Date.parse(`${dateStr}T00:00:00Z`) + 86_400_000) / 1000).toString();
}

async function runExportPrompts(
  channel: Channel,
): Promise<{ format: ExportFormat; oldest?: string; latest?: string; outPath: string }> 
{
  const format = await select<ExportFormat>({
    message: 'Export format:',
    choices: [
      { value: 'json', name: 'JSON' },
      { value: 'markdown', name: 'Markdown' },
      { value: 'html', name: 'HTML' },
    ],
  });

  const range = await select<'all' | '7d' | '30d' | 'custom'>({
    message: 'Date range:',
    choices: [
      { value: 'all', name: 'All time' },
      { value: '7d', name: 'Last 7 days' },
      { value: '30d', name: 'Last 30 days' },
      { value: 'custom', name: 'Custom dates…' },
    ],
  });

  let oldest: string | undefined;
  let latest: string | undefined;

  if (range === '7d') 
  {
    const d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    oldest = dateToOldest(d.toISOString().slice(0, 10));
  }
  else if (range === '30d') 
  {
    const d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    oldest = dateToOldest(d.toISOString().slice(0, 10));
  }
  else if (range === 'custom') 
  {
    const start = await input({
      message: 'Start date (YYYY-MM-DD):',
      validate: v => /^\d{4}-\d{2}-\d{2}$/.test(v) || 'Use YYYY-MM-DD format',
    });
    const end = await input({
      message: 'End date (YYYY-MM-DD):',
      validate: v => /^\d{4}-\d{2}-\d{2}$/.test(v) || 'Use YYYY-MM-DD format',
    });
    oldest = dateToOldest(start);
    latest = dateToLatest(end);
  }

  const outPath = await inputPath(defaultExportPath(channel, format));
  return { format, oldest, latest, outPath };
}

function openInBrowser(outPath: string): void 
{
  const opener = process.platform === 'darwin' ? 'open' : 'xdg-open';
  execFile(opener, [outPath]);
}

async function maybeOpenInBrowser(format: ExportFormat, outPath: string): Promise<void> 
{
  if (format !== 'html') 
  {
    return;
  }
  const open = await confirm('Open in browser?');
  if (open) 
  {
    openInBrowser(outPath);
  }
}

async function doChannelExport(
  client: WebClient,
  workspace: string,
  channel: Channel,
  format: ExportFormat,
  outPath: string,
  oldest?: string,
  latest?: string,
): Promise<void> 
{
  const spin = spinner('Fetching messages…');
  const allMessages: Message[] = [];
  let cursor: string | undefined;
  let page = 0;

  do 
  {
    page++;
    spin.text = `Fetching messages (page ${page}, ${allMessages.length} so far)…`;
    try 
    {
      const result = await fetchHistory(client, workspace, channel.id, { cursor, oldest, latest });
      allMessages.push(...result.messages);
      cursor = result.nextCursor;
    }
    catch (err) 
    {
      spin.stop();
      const apiErr = err as { data?: { error?: string } };
      if (apiErr.data?.error === 'not_in_channel') 
      {
        console.error(chalk.red(`You haven't joined ${channel.name} — join it in Slack to read its history.`));
        return;
      }
      throw err;
    }
  } while (cursor);

  spin.succeed(`Fetched ${allMessages.length} messages`);

  const exportMessages = format !== 'json'
    ? await Promise.all(allMessages.map(async m => ({ ...m, text: await resolveMentionIds(m.text, client, workspace) })))
    : allMessages;
  const doc = buildChannelExportDoc(workspace, channel, exportMessages);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, formatDoc(doc, format), 'utf8');
  console.log(chalk.green(`✓ Saved to ${outPath}`));
  await maybeOpenInBrowser(format, outPath);
}

async function doThreadExport(
  client: WebClient,
  workspace: string,
  channelId: string,
  threadMessages: Message[],
  format: ExportFormat,
  outPath: string,
): Promise<void> 
{
  const messages = format !== 'json'
    ? await Promise.all(threadMessages.map(async m => ({ ...m, text: await resolveMentionIds(m.text, client, workspace) })))
    : threadMessages;
  const doc = buildThreadExportDoc(workspace, channelId, messages);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, formatDoc(doc, format), 'utf8');
  console.log(chalk.green(`✓ Saved to ${outPath}`));
  await maybeOpenInBrowser(format, outPath);
}

export async function selectAction(
  client: WebClient,
  workspace: string,
  channel: Channel,
): Promise<void> 
{
  while (true) 
  {
    console.log();
    console.log(`${chalk.bold(workspace)} ${chalk.dim('›')} ${chalk.cyan(channel.name)}`);

    const action = await select<'view' | 'thread' | 'export' | 'jump' | 'back'>({
      message: 'What would you like to do?',
      choices: [
        { value: 'view', name: '(v)iew recent messages' },
        { value: 'thread', name: '(t)hread — paste URL' },
        { value: 'export', name: '(e)xport channel…' },
        { value: 'jump', name: '(j)ump to date…' },
        { value: 'back', name: '(b)ack to channels' },
      ],
    });

    if (action === 'back') 
    {
      return;
    }

    if (action === 'view') 
    {
      let cursor: string | undefined;
      let hasMore = false;

      do 
      {
        const spin = spinner('Fetching messages…');
        let result;
        try 
        {
          result = await fetchHistory(client, workspace, channel.id, { cursor });
        }
        catch (err) 
        {
          spin.stop();
          const apiErr = err as { data?: { error?: string } };
          if (apiErr.data?.error === 'not_in_channel') 
          {
            console.error(chalk.red(`You haven't joined ${channel.name} — join it in Slack to read its history.`));
            break;
          }
          throw err;
        }
        spin.stop();

        await displayMessages(client, workspace, result.messages);

        hasMore = result.hasMore;
        cursor = result.nextCursor;

        if (hasMore) 
        {
          const loadMore = await confirm('Load more messages?');
          if (!loadMore) 
          {
            break;
          }
        }
      } while (hasMore);
    }

    if (action === 'jump') 
    {
      const dateStr = await input({
        message: 'From date (YYYY-MM-DD):',
        validate: v => /^\d{4}-\d{2}-\d{2}$/.test(v) || 'Use YYYY-MM-DD format',
      });

      const oldest = (Date.parse(`${dateStr}T00:00:00Z`) / 1000).toString();
      const spin = spinner(`Fetching messages from ${dateStr}…`);
      let result;
      try 
      {
        result = await fetchHistory(client, workspace, channel.id, { oldest });
      }
      catch (err) 
      {
        spin.stop();
        const apiErr = err as { data?: { error?: string } };
        if (apiErr.data?.error === 'not_in_channel') 
        {
          console.error(chalk.red(`You haven't joined ${channel.name} — join it in Slack to read its history.`));
          continue;
        }
        throw err;
      }
      spin.stop();

      if (result.messages.length === 0) 
      {
        console.log(chalk.dim(`No messages found after ${dateStr}.`));
        continue;
      }

      await displayMessages(client, workspace, result.messages);

      let hasMore = result.hasMore;
      let cursor = result.nextCursor;

      while (hasMore) 
      {
        const loadMore = await confirm('Load more messages?');
        if (!loadMore) 
        {
          break;
        }
        const spin2 = spinner('Fetching more…');
        const more = await fetchHistory(client, workspace, channel.id, { cursor, oldest });
        spin2.stop();
        await displayMessages(client, workspace, more.messages);
        hasMore = more.hasMore;
        cursor = more.nextCursor;
      }
    }

    if (action === 'thread') 
    {
      const url = await input({ message: 'Paste Slack thread URL:' });
      const parsed = parseThreadUrl(url);

      if (!parsed) 
      {
        console.error(chalk.red('Could not parse that URL. Expected: https://workspace.slack.com/archives/C.../p...'));
        continue;
      }

      if (parsed.channelId !== channel.id) 
      {
        console.log(chalk.yellow(`Note: this thread is from a different channel (${parsed.channelId}).`));
      }

      const spin = spinner('Fetching thread…');
      const messages = await fetchThread(client, workspace, parsed.channelId, parsed.threadTs);
      spin.stop();

      await displayMessages(client, workspace, messages);

      const threadAction = await select<'export' | 'back'>({
        message: 'Thread options:',
        choices: [
          { value: 'export', name: '(e)xport this thread' },
          { value: 'back', name: '(b)ack' },
        ],
      });

      if (threadAction === 'export') 
      {
        const { format, outPath } = await runExportPrompts(channel);
        await doThreadExport(client, workspace, parsed.channelId, messages, format, outPath);
      }
    }

    if (action === 'export') 
    {
      const { format, oldest, latest, outPath } = await runExportPrompts(channel);
      await doChannelExport(client, workspace, channel, format, outPath, oldest, latest);
    }
  }
}
