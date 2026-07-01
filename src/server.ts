import dotenv from 'dotenv';
dotenv.config();

import app from './app';
import { prisma } from './config/database';

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

const shutdown = async () => {
  await prisma.$disconnect();
  server.close();
  process.exit(0);
};

// process.on('SIGINT', shutdown);
// process.on('SIGTERM', shutdown);
