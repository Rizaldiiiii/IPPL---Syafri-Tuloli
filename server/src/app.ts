import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { analysisRouter } from './routes/analysis.js';
import { assignmentRouter } from './routes/assignments.js';
import { authRouter } from './routes/auth.js';
import { calendarRouter } from './routes/calendar.js';
import { dependencyRouter } from './routes/dependencies.js';
import { projectRouter } from './routes/projects.js';
import { resourceRouter } from './routes/resources.js';
import { taskRouter } from './routes/tasks.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';

/**
 * Origin yang diizinkan mengakses API secara langsung.
 * Client Vite memakai proxy `/api`, jadi daftar ini hanya untuk pemakaian langsung.
 */
function allowedOrigins(): string[] {
  const configured = process.env.CORS_ORIGIN;
  if (configured && configured.trim().length > 0) {
    return configured.split(',').map((value) => value.trim()).filter(Boolean);
  }
  return ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:4173'];
}

export function createApp(): express.Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: allowedOrigins() }));
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.use('/api/auth', authRouter);
  app.use('/api', calendarRouter);
  app.use('/api', projectRouter);
  app.use('/api', taskRouter);
  app.use('/api', dependencyRouter);
  app.use('/api', resourceRouter);
  app.use('/api', assignmentRouter);
  app.use('/api', analysisRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
