import { serve } from '@hono/node-server';
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { Hono } from 'hono';
import authRoutes from './routes/authRoutes.js';
import bandRoutes from './routes/bandRoutes.js';
import testRoutes from './routes/testRoutes.js';
import userRoutes from './routes/userRoutes.js';
import { createContext } from './trpc/context.js';
import { appRouter } from './trpc/router.js';

export type { AppRouter } from './trpc/router.js';

const app = new Hono();

app.route('/api/auth', authRoutes);
app.route('/api/bands', bandRoutes);
app.route('/api/users', userRoutes);

// Test-only reset endpoint. Mounted exclusively when NODE_ENV=test so the
// regular dev server (NODE_ENV=development) never exposes it. The Maestro
// e2e tooling (MUS-71) calls `POST /test/reset` to wipe + reseed between
// runs; the dev server returns 404 for the same path, by design.
if (process.env.NODE_ENV === 'test') {
  app.route('/test', testRoutes);
}

app.all('/trpc/*', (c) =>
  fetchRequestHandler({
    endpoint: '/trpc',
    req: c.req.raw,
    router: appRouter,
    createContext: ({ req }) => createContext({ req }),
  }),
);

// Port is configurable so the e2e server can run on 3002 in parallel with the
// dev server on 3001. Defaults to 3001 to preserve `pnpm dev` behaviour.
const port = Number(process.env.PORT ?? 3001);

serve({ fetch: app.fetch, port }, () => {
  console.log(`Server running on http://localhost:${port}`);
});
