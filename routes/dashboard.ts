import { Hono } from 'hono';
import type { Env } from '../types';
import { shell } from '../templates/shell';

const app = new Hono<{ Bindings: Env }>();

app.get('/', (c) => c.html(shell({ timezone: c.env.TIMEZONE || 'America/New_York' })));
app.get('/daily', (c) => c.html(shell({ timezone: c.env.TIMEZONE || 'America/New_York' })));
app.get('/readings', (c) => c.html(shell({ timezone: c.env.TIMEZONE || 'America/New_York' })));

export default app;
