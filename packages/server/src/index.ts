import { serve } from '@hono/node-server';
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { Hono } from 'hono';
import authRoutes from './routes/authRoutes.js';
import bandRoutes from './routes/bandRoutes.js';
import userRoutes from './routes/userRoutes.js';
import { createContext } from './trpc/context.js';
import { appRouter } from './trpc/router.js';

export type { AppRouter } from './trpc/router.js';

const app = new Hono();

app.route('/api/auth', authRoutes);
app.route('/api/bands', bandRoutes);
app.route('/api/users', userRoutes);

app.all('/trpc/*', (c) =>
  fetchRequestHandler({
    endpoint: '/trpc',
    req: c.req.raw,
    router: appRouter,
    createContext: ({ req }) => createContext({ req }),
  }),
);

serve({ fetch: app.fetch, port: 3001 }, () => {
  console.log('Server running on http://localhost:3001');
});
