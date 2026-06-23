import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import { requestLogger } from './middleware/requestLogger';
import { notFound } from './middleware/notFound';
import { errorHandler } from './middleware/errorHandler';
import authRoutes from './routes/auth.routes';

const app = express();

app.use(requestLogger);
app.use(
  cors({
    origin: env.corsOrigin,
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser());

app.get('/health', (_req, res) => {
  res.json({ success: true, message: 'CommitEase API is running.', data: null });
});

app.use('/api/v1/auth', authRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
