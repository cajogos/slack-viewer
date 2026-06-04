import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { getRegistry } from './context.js';
import { workspacesRoute } from './routes/workspaces.js';
import { channelsRoute } from './routes/channels.js';
import { messagesRoute } from './routes/messages.js';
import { threadsRoute } from './routes/threads.js';
import { exportRoute } from './routes/export.js';
import { emojiRoute } from './routes/emoji.js';
import { avatarsRoute } from './routes/avatars.js';
import { filesRoute } from './routes/files.js';

const app = new Hono();

app.route('/api', workspacesRoute);
app.route('/api', channelsRoute);
app.route('/api', messagesRoute);
app.route('/api', threadsRoute);
app.route('/api', exportRoute);
app.route('/api', emojiRoute);
app.route('/api', avatarsRoute);
app.route('/api', filesRoute);

const port = Number(process.env['PORT'] ?? 3001);

console.log('Initialising workspace connections…');
await getRegistry();

serve({ fetch: app.fetch, port }, () =>
{
    console.log(`Hono server running on http://localhost:${port}`);
});
