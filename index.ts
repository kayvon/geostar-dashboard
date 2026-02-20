import { Hono } from 'hono';
import type { Env } from './types';
import dashboard from './routes/dashboard';
import api from './routes/api';

const app = new Hono<{ Bindings: Env }>();

// Mount API routes
app.route('/api', api);

// Mount HTML shell routes
app.route('/', dashboard);

export default app;
