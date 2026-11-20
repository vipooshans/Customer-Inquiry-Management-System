import express from 'express';
import cookieParser from 'cookie-parser';
import { authRouter } from './routes/auth.js';
import { inquiriesRouter } from './routes/inquiries.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

// Builds the app without listening, so tests can drive it with supertest.
export function createApp() {
  const app = express();
  app.use(express.json({ limit: '50kb' }));
  app.use(cookieParser());

  app.get('/api/health', (req, res) => res.json({ ok: true }));
  app.use('/api/auth', authRouter);
  app.use('/api/inquiries', inquiriesRouter);

  app.use('/api', notFoundHandler);
  app.use(errorHandler);
  return app;
}
