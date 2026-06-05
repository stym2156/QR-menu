import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const PUBLIC_BUCKET_PREFIX: Record<string, string> = {
  "menu-images": "menu",
  "promotion-images": "promotions",
  "payment-qr": "payment-qr",
};

interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicBaseUrl: string;
}

export function getR2Config(): R2Config | null {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET_NAME;
  const publicBaseUrl = process.env.R2_PUBLIC_BASE_URL;

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !publicBaseUrl) {
    return null;
  }

  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucket,
    publicBaseUrl: publicBaseUrl.replace(/\/+$/, ""),
  };
}

export function buildR2ObjectKey(bucket: string, path: string): string | null {
  const prefix = PUBLIC_BUCKET_PREFIX[bucket];
  if (!prefix || !isSafeObjectPath(path)) return null;
  return `${prefix}/${path}`;
}

export async function uploadToR2(options: {
  key: string;
  file: File;
  config: R2Config;
}): Promise<{ publicUrl: string } | { error: string }> {
  const body = Buffer.from(await options.file.arrayBuffer());
  const contentType = options.file.type || "application/octet-stream";

  const client = new S3Client({
    region: "auto",
    endpoint: `https://${options.config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: options.config.accessKeyId,
      secretAccessKey: options.config.secretAccessKey,
    },
  });

  try {
    await client.send(
      new PutObjectCommand({
        Bucket: options.config.bucket,
        Key: options.key,
        Body: body,
        ContentType: contentType,
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "R2 upload failed",
    };
  }

  return {
    publicUrl: `${options.config.publicBaseUrl}/${options.key}`,
  };
}

function isSafeObjectPath(path: string): boolean {
  return /^[a-zA-Z0-9][a-zA-Z0-9/_.,=-]*$/.test(path) && !path.includes("..");
}
