import { search, Separator } from '@inquirer/prompts'
import type { WebClient } from '@slack/web-api'
import { listChannels } from '../api/channels.js'
import { spinner } from './prompts.js'
import type { WorkspaceProfile } from '../config/workspaces.js'
import type { Channel } from '../types/slack.js'

type ChannelChoice = {
  value: Channel | 'switch-workspace'
  name: string
  disabled?: boolean | string
}

function channelLabel(ch: Channel): string {
  const prefix = ch.type === 'private'
    ? '🔒'
    : ch.type === 'im' || ch.type === 'mpim'
      ? '💬'
      : '#'
  const suffix = ch.memberCount != null ? ` (${ch.memberCount})` : ''
  if (!ch.isMember && ch.type === 'public') {
    return `${prefix} ${ch.name} [no access]`
  }
  return `${prefix} ${ch.name}${suffix}`
}

function buildChoices(
  allChannels: Channel[],
  recentChannels: Channel[],
  profiles: WorkspaceProfile[],
  term: string | undefined
): (ChannelChoice | Separator)[] {
  const q = (term ?? '').toLowerCase()

  const switchChoice: ChannelChoice = {
    value: 'switch-workspace',
    name: '↩  Switch workspace',
  }

  if (q) {
    const matches = allChannels
      .filter(ch => ch.name.toLowerCase().includes(q))
      .map(ch => ({
        value: ch as Channel | 'switch-workspace',
        name: channelLabel(ch),
        ...((!ch.isMember && ch.type === 'public') ? { disabled: true } : {}),
      }))

    if (profiles.length > 1 && '↩ switch workspace'.includes(q)) {
      return [switchChoice, ...matches]
    }
    return matches
  }

  const items: (ChannelChoice | Separator)[] = []

  if (profiles.length > 1) {
    items.push(switchChoice)
    items.push(new Separator())
  }

  if (recentChannels.length > 0) {
    items.push(new Separator('── Recent ──'))
    for (const ch of recentChannels) {
      items.push({ value: ch, name: channelLabel(ch) })
    }
    items.push(new Separator())
  }

  const regularChannels = allChannels.filter(
    ch => ch.type === 'public' || ch.type === 'private'
  )
  const dmChannels = allChannels.filter(
    ch => ch.type === 'im' || ch.type === 'mpim'
  )

  items.push(new Separator('── Channels ──'))
  for (const ch of regularChannels) {
    items.push({
      value: ch,
      name: channelLabel(ch),
      ...((!ch.isMember && ch.type === 'public') ? { disabled: true } : {}),
    })
  }

  if (dmChannels.length > 0) {
    items.push(new Separator('── Direct Messages ──'))
    for (const ch of dmChannels) {
      items.push({ value: ch, name: channelLabel(ch) })
    }
  }

  return items
}

export async function selectChannel(
  client: WebClient,
  profiles: WorkspaceProfile[],
  currentProfile: WorkspaceProfile,
  recentChannels: Channel[]
): Promise<Channel | 'switch-workspace'> {
  const spin = spinner(`Loading channels for ${currentProfile.name}…`)
  const allChannels = await listChannels(client, currentProfile.name)
  spin.succeed(`${allChannels.length} channels loaded`)

  return search<Channel | 'switch-workspace'>({
    message: 'Select a channel:',
    source: term => buildChoices(allChannels, recentChannels, profiles, term),
    pageSize: 15,
  })
}
