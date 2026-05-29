import chalk from 'chalk'
import { select, input } from '@inquirer/prompts'
import type { WebClient } from '@slack/web-api'
import { fetchHistory } from '../api/messages.js'
import { fetchThread, parseThreadUrl } from '../api/threads.js'
import { spinner, confirm, inputPath, displayMessages } from './prompts.js'
import type { Channel } from '../types/slack.js'

type ExportFormat = 'json' | 'markdown' | 'html'

const EXT: Record<ExportFormat, string> = { json: 'json', markdown: 'md', html: 'html' }

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

function defaultExportPath(channel: Channel, fmt: ExportFormat): string {
  const name = channel.name.replace(/^[#🔒💬\s]+/, '').replace(/\s+/g, '-')
  return `./exports/${name}-${todayStr()}.${EXT[fmt]}`
}

function dateToOldest(dateStr: string): string {
  return (Date.parse(`${dateStr}T00:00:00Z`) / 1000).toString()
}

function dateToLatest(dateStr: string): string {
  return ((Date.parse(`${dateStr}T00:00:00Z`) + 86_400_000) / 1000).toString()
}

async function runExportPrompts(
  channel: Channel
): Promise<{ format: ExportFormat; oldest?: string; latest?: string; outPath: string }> {
  const format = await select<ExportFormat>({
    message: 'Export format:',
    choices: [
      { value: 'json', name: 'JSON' },
      { value: 'markdown', name: 'Markdown' },
      { value: 'html', name: 'HTML' },
    ],
  })

  const range = await select<'all' | '7d' | '30d' | 'custom'>({
    message: 'Date range:',
    choices: [
      { value: 'all', name: 'All time' },
      { value: '7d', name: 'Last 7 days' },
      { value: '30d', name: 'Last 30 days' },
      { value: 'custom', name: 'Custom dates…' },
    ],
  })

  let oldest: string | undefined
  let latest: string | undefined

  if (range === '7d') {
    const d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    oldest = dateToOldest(d.toISOString().slice(0, 10))
  } else if (range === '30d') {
    const d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    oldest = dateToOldest(d.toISOString().slice(0, 10))
  } else if (range === 'custom') {
    const start = await input({
      message: 'Start date (YYYY-MM-DD):',
      validate: v => /^\d{4}-\d{2}-\d{2}$/.test(v) || 'Use YYYY-MM-DD format',
    })
    const end = await input({
      message: 'End date (YYYY-MM-DD):',
      validate: v => /^\d{4}-\d{2}-\d{2}$/.test(v) || 'Use YYYY-MM-DD format',
    })
    oldest = dateToOldest(start)
    latest = dateToLatest(end)
  }

  const outPath = await inputPath(defaultExportPath(channel, format))
  return { format, oldest, latest, outPath }
}

export async function selectAction(
  client: WebClient,
  workspace: string,
  channel: Channel
): Promise<void> {
  while (true) {
    console.log()
    console.log(`${chalk.bold(workspace)} ${chalk.dim('›')} ${chalk.cyan(channel.name)}`)

    const action = await select<'view' | 'thread' | 'export' | 'back'>({
      message: 'What would you like to do?',
      choices: [
        { value: 'view', name: '(v)iew recent messages' },
        { value: 'thread', name: '(t)hread — paste URL' },
        { value: 'export', name: '(e)xport channel…' },
        { value: 'back', name: '(b)ack to channels' },
      ],
    })

    if (action === 'back') return

    if (action === 'view') {
      let cursor: string | undefined
      let hasMore = false

      do {
        const spin = spinner('Fetching messages…')
        const result = await fetchHistory(client, workspace, channel.id, { cursor })
        spin.stop()

        await displayMessages(client, workspace, result.messages)

        hasMore = result.hasMore
        cursor = result.nextCursor

        if (hasMore) {
          const loadMore = await confirm('Load more messages?')
          if (!loadMore) break
        }
      } while (hasMore)
    }

    if (action === 'thread') {
      const url = await input({ message: 'Paste Slack thread URL:' })
      const parsed = parseThreadUrl(url)

      if (!parsed) {
        console.error(chalk.red('Could not parse that URL. Make sure it is a Slack thread link.'))
        continue
      }

      if (parsed.channelId !== channel.id) {
        console.log(chalk.yellow(`Note: this thread is from a different channel (${parsed.channelId}).`))
      }

      const spin = spinner('Fetching thread…')
      const messages = await fetchThread(client, workspace, parsed.channelId, parsed.threadTs)
      spin.stop()

      await displayMessages(client, workspace, messages)

      const threadAction = await select<'export' | 'back'>({
        message: 'Thread options:',
        choices: [
          { value: 'export', name: '(e)xport this thread' },
          { value: 'back', name: '(b)ack' },
        ],
      })

      if (threadAction === 'export') {
        const { outPath } = await runExportPrompts(channel)
        console.log(chalk.yellow(`Export coming in Phase 5`))
        console.log(chalk.dim(`(Would save to ${outPath})`))
      }
    }

    if (action === 'export') {
      const { outPath } = await runExportPrompts(channel)
      console.log(chalk.yellow(`Export coming in Phase 5`))
      console.log(chalk.dim(`(Would save to ${outPath})`))
    }
  }
}
