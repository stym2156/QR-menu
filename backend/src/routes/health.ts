import type { FastifyInstance } from "fastify";
import type { BackendEnv } from "../config/env";

export async function registerHealthRoutes(
  app: FastifyInstance,
  env: BackendEnv,
): Promise<void> {
  app.get("/health", async () => ({
    ok: true,
    service: "shopqr-backend",
    env: env.nodeEnv,
    time: new Date().toISOString(),
  }));
}
