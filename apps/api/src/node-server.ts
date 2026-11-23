import { serve } from '@hono/node-server';
import { app } from './app.js';

const port = Number(process.env.PORT) || 3000;

const server = serve(
  {
    fetch: app.fetch,
    port,
    hostname: '0.0.0.0',
  },
  (info) => {
    console.log(`JanSetu API listening at http://localhost:${info.port}`);
  }
);

export default server;
