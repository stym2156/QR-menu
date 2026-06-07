import { createApp } from "./app";
import { loadEnv } from "./config/env";

async function main(): Promise<void> {
  const env = loadEnv();
  const app = await createApp(env);

  await app.listen({ host: env.host, port: env.port });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
