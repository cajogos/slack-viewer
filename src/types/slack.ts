export interface Channel {
  id: string
  name: string
  type: 'public' | 'private' | 'mpim' | 'im'
  memberCount?: number
  isMember: boolean
}

export interface Message {
  ts: string
  datetime: string
  userId: string
  user: string
  text: string
  reactions?: Reaction[]
  files?: FileAttachment[]
  replyCount?: number
  threadTs?: string
}

export interface Reaction {
  name: string
  count: number
}

export interface FileAttachment {
  name: string
  url: string
  mimetype?: string
}
