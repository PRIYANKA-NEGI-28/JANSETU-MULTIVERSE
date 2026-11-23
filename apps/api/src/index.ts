import { app, createApp } from './app.js';
import { getBootEnv } from './config/env.js';

// Strict environment validation on boot
getBootEnv();

export { app, createApp };
export default app;
