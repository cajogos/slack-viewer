// Raw Slack API message objects (newest-first as the API returns them)
export const fakeRawMessages = [
  {
    ts: '1700000003.000000',
    type: 'message',
    user: 'U003',
    text: 'Third message',
    reply_count: 2,
    thread_ts: '1700000003.000000',
  },
  {
    ts: '1700000002.000000',
    type: 'message',
    subtype: 'bot_message',
    username: 'MyBot',
    text: 'Bot says hello',
  },
  {
    ts: '1700000002.500000',
    type: 'message',
    subtype: 'bot_message',
    username: 'Slackbot',
    text: '',
  },
  {
    ts: '1700000001.000000',
    type: 'message',
    subtype: 'channel_join',
    user: 'U001',
    text: 'U001 has joined the channel',
  },
  {
    ts: '1700000000.000000',
    type: 'message',
    user: 'U001',
    text: 'First message',
    reactions: [{ name: 'thumbsup', count: 3, users: ['U002'] }],
  },
]
