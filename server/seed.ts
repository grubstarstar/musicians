import bcrypt from 'bcrypt';
import { db } from './db.js';

const username = 'admin';
const password = 'password123';
const hash = await bcrypt.hash(password, 12);

const result = db
  .prepare('INSERT OR IGNORE INTO users (username, password_hash) VALUES (?, ?)')
  .run(username, hash);

if (result.changes > 0) {
  console.log(`Created user: ${username} / ${password}`);
} else {
  console.log(`User '${username}' already exists — skipped.`);
}
