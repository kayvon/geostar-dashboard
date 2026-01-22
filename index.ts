import { Hono } from 'hono';
import type { Env } from './types';
import dashboard from './routes/dashboard';

const app = new Hono<{ Bindings: Env }>();

// Mount dashboard routes
app.route('/', dashboard);

export default app;
