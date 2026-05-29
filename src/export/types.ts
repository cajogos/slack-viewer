export interface ExportDoc {
  workspace: string
  channel: string
  channelType: 'public' | 'private' | 'mpim' | 'im'
  exportedAt: string       // ISO 8601
  messageCount: number
  messages: ExportMessage[]
}

export interface ExportMessage {
  ts: string               // raw Slack timestamp
  datetime: string         // human-readable, local timezone
  userId: string
  user: string             // resolved display name
  text: string             // raw Slack mrkdwn
  reactions?: ExportReaction[]
  files?: ExportFile[]
  replyCount?: number      // present on thread parents in a channel export
  replies?: ExportMessage[]  // populated ONLY for a thread export
}

export interface ExportReaction {
  name: string
  count: number
}

export interface ExportFile {
  name: string
  url: string
  mimetype?: string
}
