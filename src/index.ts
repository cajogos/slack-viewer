#!/usr/bin/env node
import chalk from 'chalk'
import { loadWorkspaces } from './config/workspaces.js'
import { createClient } from './api/client.js'
import { spinner } from './cli/prompts.js'
import { selectWorkspace } from './cli/selectWorkspace.js'
import { selectChannel } from './cli/selectChannel.js'
import { selectAction } from './cli/selectAction.js'
import type { Channel } from './types/slack.js'

const subcommand = process.argv[2]

if (subcommand === 'export' || subcommand === 'thread') {
  console.log(chalk.yellow('Export coming in Phase 5'))
  process.exit(0)
}

if (subcommand === '--version' || subcommand === '-v') {
  console.log('slack-viewer v0.1.0')
  process.exit(0)
}

if (subcommand === '--help' || subcommand === '-h') {
  console.log(`Usage: slack-viewer [subcommand] [options]

Subcommands:
  (none)                         Interactive mode
  export --channel <name> --format json|markdown|html [--output <path>] [--from YYYY-MM-DD] [--to YYYY-MM-DD]
  thread <slack-url> --format json|markdown|html [--output <path>]

Options:
  --version, -v                  Print version
  --help, -h                     Print this help`)
  process.exit(0)
}

async function main() {
  const profiles = await loadWorkspaces()
  let profile = await selectWorkspace(profiles)
  const recentChannels: Channel[] = []

  outer: while (true) {
    const client = createClient(profile.token)
    const spin = spinner(`Connecting to ${profile.name}…`)
    const auth = await client.auth.test()
    spin.succeed(`Connected to ${auth.team ?? profile.name}`)

    while (true) {
      const result = await selectChannel(client, profiles, profile, recentChannels)

      if (result === 'switch-workspace') {
        profile = await selectWorkspace(profiles)
        recentChannels.length = 0
        continue outer
      }

      const channel = result
      const idx = recentChannels.findIndex(c => c.id === channel.id)
      if (idx !== -1) recentChannels.splice(idx, 1)
      recentChannels.unshift(channel)
      if (recentChannels.length > 5) recentChannels.pop()

      await selectAction(client, auth.team ?? profile.name, channel)
    }
  }
}

main().catch(err => {
  console.error(chalk.red('Error:'), (err as Error).message)
  process.exit(1)
})
