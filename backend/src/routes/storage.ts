import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { BackendEnv } from "../config/env";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
]);

const PUBLIC_BUCKET_PREFIX: Record<string, string> = {
  "menu-images": "menu",
  "promotion-images": "promotions",
  "payment-qr": "payment-qr",
};

interface UploadFields {
  bucket: string;
  path: string;
}

export async function registerStorageRoutes(
  app: FastifyInstance,
  env: BackendEnv,
): Promise<void> {
  app.post("/api/storage/upload", async (request, reply) => {
    if (env.imageStorageDriver !== "r2") {
      return reply.status(400).send({ error: "R2 storage is not enabled" });
    }

    const r2 = getR2Config(env);
    if (!r2) {
      return reply.status(500).send({ error: "R2 is not configured" });
    }

    const token = getBearerToken(request);
    if (!token) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const { data: userData, error: userError } =
      await app.supabase.anon.auth.getUser(token);
    if (userError || !userData.user) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const part = await request.file({
      limits: {
        fileSize: MAX_IMAGE_SIZE,
        files: 1,
      },
    });
    if (!part) {
      return reply.status(400).send({ error: "Missing file" });
    }
    if (!ALLOWED_TYPES.has(part.mimetype)) {
      return reply.status(400).send({ error: "Unsupported image type" });
    }
    const body = await part.toBuffer();

    const fields = readUploadFields(part.fields);
    const key = buildR2ObjectKey(fields.bucket, fields.path);
    if (!key) {
      return reply.status(400).send({ error: "Invalid upload path" });
    }

    const restaurantId = getRestaurantIdFromPath(fields.path);
    if (!restaurantId) {
      return reply.status(400).send({ error: "Invalid upload path" });
    }

    const userSupabase = createClient(env.supabaseUrl, env.supabaseAnonKey, {
      auth: { persistSession: false },
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    const { data: membership, error: membershipError } = await userSupabase
      .from("restaurant_members")
      .select("role")
      .eq("restaurant_id", restaurantId)
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (membershipError || membership?.role !== "owner") {
      return reply.status(403).send({ error: "Forbidden" });
    }

    const client = new S3Client({
      region: "auto",
      endpoint: `https://${r2.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: r2.accessKeyId,
        secretAccessKey: r2.secretAccessKey,
      },
    });

    await client.send(
      new PutObjectCommand({
        Bucket: r2.bucketName,
        Key: key,
        Body: body,
        ContentLength: body.byteLength,
        ContentType: part.mimetype || "application/octet-stream",
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );

    return reply.send({
      publicUrl: `${r2.publicBaseUrl}/${key}`,
    });
  });
}

function getBearerToken(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match?.[1]?.trim() || null;
}

function readUploadFields(fields: Record<string, unknown>): UploadFields {
  return {
    bucket: readTextField(fields.bucket),
    path: readTextField(fields.path),
  };
}

function readTextField(field: unknown): string {
  if (!field || typeof field !== "object") return "";
  const value = (field as { value?: unknown }).value;
  return typeof value === "string" ? value : "";
}

function buildR2ObjectKey(bucket: string, path: string): string | null {
  const prefix = PUBLIC_BUCKET_PREFIX[bucket];
  if (!prefix || !isSafeObjectPath(path)) return null;
  return `${prefix}/${path}`;
}

function getRestaurantIdFromPath(path: string): string | null {
  const firstSegment = path.split("/")[0];
  return isUuid(firstSegment) ? firstSegment : null;
}

function isSafeObjectPath(path: string): boolean {
  return /^[a-zA-Z0-9][a-zA-Z0-9/_.,=-]*$/.test(path) && !path.includes("..");
}

function isUuid(value: string | undefined): value is string {
  return Boolean(
    value &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value,
      ),
  );
}

function getR2Config(env: BackendEnv):
  | {
      accountId: string;
      accessKeyId: string;
      secretAccessKey: string;
      bucketName: string;
      publicBaseUrl: string;
    }
  | null {
  if (
    !env.r2AccountId ||
    !env.r2AccessKeyId ||
    !env.r2SecretAccessKey ||
    !env.r2BucketName ||
    !env.r2PublicBaseUrl
  ) {
    return null;
  }

  return {
    accountId: env.r2AccountId,
    accessKeyId: env.r2AccessKeyId,
    secretAccessKey: env.r2SecretAccessKey,
    bucketName: env.r2BucketName,
    publicBaseUrl: env.r2PublicBaseUrl.replace(/\/+$/, ""),
  };
}
