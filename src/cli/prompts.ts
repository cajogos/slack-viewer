import chalk from 'chalk';
import ora from 'ora';
import { input, confirm as inquirerConfirm } from '@inquirer/prompts';
import type { WebClient } from '@slack/web-api';
import { mrkdwnToTextAsync } from '../utils/mrkdwn.js';
import type { Message } from '../types/slack.js';

const PALETTE = [
  chalk.cyan,
  chalk.green,
  chalk.yellow,
  chalk.magenta,
  chalk.blue,
  chalk.red,
] as const;

export function spinner(text: string) 
{
  return ora(text).start();
}

export function confirm(message: string): Promise<boolean> 
{
  return inquirerConfirm({ message });
}

export function inputPath(defaultPath: string): Promise<string> 
{
  return input({ message: 'Output file path:', default: defaultPath });
}

export function userColor(userId: string): (text: string) => string 
{
  const idx = userId.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % PALETTE.length;
  return PALETTE[idx];
}

export function formatRelativeTime(ts: string): string 
{
  const msgMs = parseFloat(ts) * 1000;
  const nowMs = Date.now();
  const diffSec = Math.floor((nowMs - msgMs) / 1000);

  if (diffSec < 60) 
  {
    return 'just now';
  }
  if (diffSec < 3600) 
  {
    return `${Math.floor(diffSec / 60)}m ago`;
  }
  if (diffSec < 86400) 
  {
    return `${Math.floor(diffSec / 3600)}h ago`;
  }

  const msgDate = new Date(msgMs);
  const nowDate = new Date(nowMs);

  const yesterday = new Date(nowDate);
  yesterday.setDate(nowDate.getDate() - 1);
  if (
    msgDate.getFullYear() === yesterday.getFullYear() &&
    msgDate.getMonth() === yesterday.getMonth() &&
    msgDate.getDate() === yesterday.getDate()
  ) 
  {
    return 'yesterday';
  }

  if (nowMs - msgMs < 7 * 24 * 60 * 60 * 1000) 
  {
    return new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(msgDate);
  }

  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(msgDate);
}

function wrapText(text: string, maxWidth: number, indent: string): string 
{
  if (!text.trim()) 
  {
    return '';
  }
  const lines = text.split('\n');
  const wrapped: string[] = [];
  for (const line of lines) 
  {
    if (line.length <= maxWidth) 
    {
      wrapped.push(line);
      continue;
    }
    const words = line.split(' ');
    let current = '';
    for (const word of words) 
    {
      if (current && current.length + 1 + word.length > maxWidth) 
      {
        wrapped.push(current);
        current = word;
      }
      else 
      {
        current = current ? current + ' ' + word : word;
      }
    }
    if (current) 
    {
      wrapped.push(current);
    }
  }
  return wrapped.join('\n' + indent);
}

export async function displayMessages(
  client: WebClient,
  teamId: string,
  messages: Message[],
): Promise<void> 
{
  const cols = process.stdout.columns ?? 80;
  const textWidth = Math.max(40, cols - 6);
  const indent = '      ';

  for (const msg of messages) 
  {
    const initials = msg.user.slice(0, 2).toUpperCase().padEnd(2, ' ');
    const color = userColor(msg.userId);
    const badge = color(`[${initials}]`);
    const absTime = new Date(parseFloat(msg.ts) * 1000).toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    });
    const relTime = formatRelativeTime(msg.ts);
    const timeStr = chalk.dim(`${absTime} · ${relTime}`);
    const username = chalk.bold(color(msg.user));

    console.log(`${badge} ${timeStr}  ${username}`);

    const resolvedText = await mrkdwnToTextAsync(msg.text, client, teamId);
    const wrapped = wrapText(resolvedText, textWidth, indent);
    if (wrapped) 
    {
      console.log(`${indent}${chalk.white(wrapped)}`);
    }

    if (msg.reactions && msg.reactions.length > 0) 
    {
      const reactionStr = msg.reactions.map(r => `:${r.name}: ×${r.count}`).join('  ');
      console.log(`${indent}${chalk.dim.yellow(reactionStr)}`);
    }

    if (msg.files && msg.files.length > 0) 
    {
      for (const f of msg.files) 
      {
        console.log(`${indent}${chalk.dim(`📎 ${f.name}`)}`);
      }
    }

    if (msg.replyCount && msg.replyCount > 0) 
    {
      const word = msg.replyCount === 1 ? 'reply' : 'replies';
      console.log(`${indent}${chalk.dim(`↳ ${msg.replyCount} ${word}`)}`);
    }
  }

  console.log();
  console.log(chalk.dim('  ↑↓ scroll · L load more · T paste thread URL · E export · B back'));
}
