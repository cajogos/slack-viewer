import { select } from '@inquirer/prompts'
import type { WorkspaceProfile } from '../config/workspaces.js'

export async function selectWorkspace(profiles: WorkspaceProfile[]): Promise<WorkspaceProfile> {
  if (profiles.length === 1) return profiles[0]

  const chosen = await select({
    message: 'Select a workspace:',
    choices: profiles.map(p => ({
      value: p,
      name: `${p.name}  (xoxp-...${p.token.slice(-4)})`,
    })),
  })

  return chosen
}
