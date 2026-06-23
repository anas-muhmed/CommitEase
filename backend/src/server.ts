import app from './app';
import { env, validateAuthSecrets } from './config/env';
import { prisma } from './config/database';

async function startServer(): Promise<void> {
  try {
    validateAuthSecrets();
    await prisma.$connect();
    console.log('Database connected.');

    app.listen(env.port, () => {
      console.log(`CommitEase API running on port ${env.port} [${env.nodeEnv}]`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

void startServer();
