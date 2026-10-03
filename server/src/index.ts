import { config } from "./config.js";
import { createApp } from "./app.js";
import { prisma } from "./db.js";
import { startScheduler } from "./services/scheduler.js";

const app = createApp();
const server = app.listen(config.port, () => {
  console.log(`[habitflow] API listening on http://localhost:${config.port}`);
  if (config.runScheduler) startScheduler();
});

const shutdown = async () => {
  server.close();
  await prisma.$disconnect();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
