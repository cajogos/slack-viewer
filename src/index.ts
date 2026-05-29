#!/usr/bin/env node
import { parseArgs } from 'node:util';
import chalk from 'chalk';
import { loadWorkspaces } from './config/workspaces.js';
import { createClient } from './api/client.js';
import { spinner } from './cli/prompts.js';
import { selectWorkspace } from './cli/selectWorkspace.js';
import { selectChannel } from './cli/selectChannel.js';
import { selectAction } from './cli/selectAction.js';
import { runExportCommand, runThreadCommand } from './export/index.js';
import type { Channel } from './types/slack.js';

const VERSION = '0.1.0';

const HELP = `\
Usage: slack-viewer [subcommand] [options]

A read-only Slack explorer and export tool.

Subcommands:
  (none)                         Interactive mode
  export                         Export a channel (non-interactive)
  thread <url>                   Export a thread by URL (non-interactive)

Options:
  --help, -h                     Show this help message
  --version, -v                  Show version

Export options:
  --channel <name|id>            Channel name or ID (required for export)
  --format json|markdown|html    Output format (required)
  --output <path>                Output file path (default: ./exports/<name>-<date>.<ext>)
  --from YYYY-MM-DD              Start date (inclusive)
  --to YYYY-MM-DD                End date (inclusive)

Configuration:
  Create workspaces.json in the project directory:
  {
    "my-workspace": "xoxp-your-token-here"
  }

Keyboard shortcuts (during navigation):
  Arrow keys   Navigate lists
  Enter        Select
  Type         Filter channel list
  Ctrl+C       Exit

In-channel shortcuts (shown in action menu):
  v   View recent messages
  t   Paste thread URL
  e   Export channel
  j   Jump to date
  b   Back to channel list`;

let parsed: ReturnType<typeof parseArgs>;
try 
{
    parsed = parseArgs({
        args: process.argv.slice(2),
        allowPositionals: true,
        options: {
            channel: { type: 'string' },
            format: { type: 'string' },
            output: { type: 'string' },
            from: { type: 'string' },
            to: { type: 'string' },
            help: { type: 'boolean', short: 'h' },
            version: { type: 'boolean', short: 'v' },
        },
    });
}
catch (err) 
{
    console.error(chalk.red('Error:'), (err as Error).message);
    process.exit(1);
}

const { values, positionals } = parsed;
const subcommand = positionals[0];

if (values['help']) 
{
    console.log(HELP);
    process.exit(0);
}

if (values['version']) 
{
    console.log(`slack-viewer v${VERSION}`);
    process.exit(0);
}

if (subcommand === 'export') 
{
    runExportCommand({
        channel: values['channel'] as string | undefined,
        format: values['format'] as string | undefined,
        output: values['output'] as string | undefined,
        from: values['from'] as string | undefined,
        to: values['to'] as string | undefined,
    }).catch(err => 
    {
        console.error(chalk.red('Error:'), (err as Error).message);
        process.exit(1);
    });
}
else if (subcommand === 'thread') 
{
    runThreadCommand({
        url: positionals[1],
        format: values['format'] as string | undefined,
        output: values['output'] as string | undefined,
    }).catch(err => 
    {
        console.error(chalk.red('Error:'), (err as Error).message);
        process.exit(1);
    });
}
else 
{
    main().catch(err => 
    {
        console.error(chalk.red('Error:'), (err as Error).message);
        process.exit(1);
    });
}

async function main(): Promise<void> 
{
    const profiles = await loadWorkspaces();
    let profile = await selectWorkspace(profiles);
    const recentChannels: Channel[] = [];

    outer: while (true) 
    {
        const client = createClient(profile.token);
        const spin = spinner(`Connecting to ${profile.name}…`);

        let auth;
        try 
        {
            auth = await client.auth.test();
        }
        catch 
        {
            spin.stop();
            console.error(chalk.red(`Token for '${profile.name}' is invalid. Check workspaces.json.`));
            process.exit(1);
        }

        spin.succeed(`Connected to ${auth.team ?? profile.name}`);

        while (true) 
        {
            const result = await selectChannel(client, profiles, profile, recentChannels);

            if (result === 'switch-workspace') 
            {
                profile = await selectWorkspace(profiles);
                recentChannels.length = 0;
                continue outer;
            }

            const channel = result;
            const idx = recentChannels.findIndex(c => c.id === channel.id);
            if (idx !== -1) 
            {
                recentChannels.splice(idx, 1);
            }
            recentChannels.unshift(channel);
            if (recentChannels.length > 5) 
            {
                recentChannels.pop();
            }

            await selectAction(client, auth.team ?? profile.name, channel);
        }
    }
}
