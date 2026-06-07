import { config as loadDotenv } from "dotenv";

loadDotenv({ path: [".env.local", ".env"] });

export interface BackendEnv {
  nodeEnv: string;
  port: number;
  host: string;
  corsOrigin: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey: string | null;
  imageStorageDriver: string;
  r2AccountId: string | null;
  r2AccessKeyId: string | null;
  r2SecretAccessKey: string | null;
  r2BucketName: string | null;
  r2PublicBaseUrl: string | null;
}

function readOptional(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

function readRequired(name: string): string {
  const value = readOptional(name);
  if (!value) throw new Error(`Missing required env: ${name}`);
  return value;
}

function readPort(): number {
  const raw = process.env.PORT ?? "4000";
  const port = Number(raw);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid PORT: ${raw}`);
  }
  return port;
}

export function loadEnv(): BackendEnv {
  return {
    nodeEnv: process.env.NODE_ENV ?? "development",
    port: readPort(),
    host: process.env.HOST ?? "0.0.0.0",
    corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
    supabaseUrl: readRequired("SUPABASE_URL"),
    supabaseAnonKey: readRequired("SUPABASE_ANON_KEY"),
    supabaseServiceRoleKey: readOptional("SUPABASE_SERVICE_ROLE_KEY"),
    imageStorageDriver: process.env.IMAGE_STORAGE_DRIVER ?? "supabase",
    r2AccountId: readOptional("R2_ACCOUNT_ID"),
    r2AccessKeyId: readOptional("R2_ACCESS_KEY_ID"),
    r2SecretAccessKey: readOptional("R2_SECRET_ACCESS_KEY"),
    r2BucketName: readOptional("R2_BUCKET_NAME"),
    r2PublicBaseUrl: readOptional("R2_PUBLIC_BASE_URL"),
  };
}
