import { createHmac, createHash } from "crypto";

const REGION = "auto";
const SERVICE = "s3";

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
  const endpoint = `https://${options.config.accountId}.r2.cloudflarestorage.com`;
  const encodedKey = options.key
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
  const url = new URL(`/${options.config.bucket}/${encodedKey}`, endpoint);
  const body = Buffer.from(await options.file.arrayBuffer());
  const now = new Date();
  const amzDate = toAmzDate(now);
  const dateStamp = amzDate.slice(0, 8);
  const contentType = options.file.type || "application/octet-stream";
  const payloadHash = sha256Hex(body);

  const headers: Record<string, string> = {
    "content-type": contentType,
    host: url.host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
  };
  const canonicalHeaders = Object.entries(headers)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}:${value}`)
    .join("\n");
  const signedHeaders = Object.keys(headers).sort().join(";");
  const canonicalRequest = [
    "PUT",
    url.pathname,
    "",
    `${canonicalHeaders}\n`,
    signedHeaders,
    payloadHash,
  ].join("\n");
  const credentialScope = `${dateStamp}/${REGION}/${SERVICE}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");
  const signingKey = getSigningKey(
    options.config.secretAccessKey,
    dateStamp,
    REGION,
    SERVICE,
  );
  const signature = hmacHex(signingKey, stringToSign);
  const authorization = [
    `AWS4-HMAC-SHA256 Credential=${options.config.accessKeyId}/${credentialScope}`,
    `SignedHeaders=${signedHeaders}`,
    `Signature=${signature}`,
  ].join(", ");

  const response = await fetch(url, {
    method: "PUT",
    body,
    headers: {
      ...headers,
      authorization,
      "cache-control": "public, max-age=31536000, immutable",
    },
  });

  if (!response.ok) {
    return { error: `R2 upload failed (${response.status})` };
  }

  return {
    publicUrl: `${options.config.publicBaseUrl}/${options.key}`,
  };
}

function isSafeObjectPath(path: string): boolean {
  return /^[a-zA-Z0-9][a-zA-Z0-9/_.,=-]*$/.test(path) && !path.includes("..");
}

function toAmzDate(date: Date): string {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

function sha256Hex(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function hmac(key: Buffer | string, value: string): Buffer {
  return createHmac("sha256", key).update(value).digest();
}

function hmacHex(key: Buffer, value: string): string {
  return createHmac("sha256", key).update(value).digest("hex");
}

function getSigningKey(
  secretAccessKey: string,
  dateStamp: string,
  region: string,
  service: string,
): Buffer {
  const dateKey = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const regionKey = hmac(dateKey, region);
  const serviceKey = hmac(regionKey, service);
  return hmac(serviceKey, "aws4_request");
}
