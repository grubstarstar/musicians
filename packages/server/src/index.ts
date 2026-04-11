import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import authRoutes from './routes/authRoutes.js';
import bandRoutes from './routes/bandRoutes.js';
import userRoutes from './routes/userRoutes.js';

const app = new Hono();

app.route('/api/auth', authRoutes);
app.route('/api/bands', bandRoutes);
app.route('/api/users', userRoutes);

serve({ fetch: app.fetch, port: 3001 }, () => {
  console.log('Server running on http://localhost:3001');
});
