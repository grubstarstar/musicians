import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import authRoutes from './routes/authRoutes.js';

const app = new Hono();

app.route('/api/auth', authRoutes);

serve({ fetch: app.fetch, port: 3001 }, () => {
  console.log('Server running on http://localhost:3001');
});
