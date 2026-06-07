import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import Fastify, { type FastifyInstance } from "fastify";
import type { BackendEnv } from "./config/env";
import { createSupabaseClients, type SupabaseClients } from "./plugins/supabase";
import { registerHealthRoutes } from "./routes/health";
import { registerStorageRoutes } from "./routes/storage";

declare module "fastify" {
  interface FastifyInstance {
    supabase: SupabaseClients;
  }
}

export async function createApp(env: BackendEnv): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: env.nodeEnv === "production" ? "info" : "debug",
    },
  });

  app.decorate("supabase", createSupabaseClients(env));

  await app.register(cors, {
    origin: env.corsOrigin === "*" ? true : env.corsOrigin.split(",").map((x) => x.trim()),
    credentials: true,
  });
  await app.register(multipart);

  await app.register(registerHealthRoutes, env);
  await app.register(registerStorageRoutes, env);

  app.setNotFoundHandler(async (_request, reply) => {
    return reply.status(404).send({ ok: false, error: "NOT_FOUND" });
  });

  app.setErrorHandler((error, _request, reply) => {
    app.log.error(error);
    return reply.status(500).send({ ok: false, error: "INTERNAL_SERVER_ERROR" });
  });

  return app;
}
