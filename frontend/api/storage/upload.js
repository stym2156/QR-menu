import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";
import Busboy from "busboy";

export const config = {
  api: {
    bodyParser: false,
  },
};

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
]);

const PUBLIC_BUCKET_PREFIX = {
  "menu-images": "menu",
  "promotion-images": "promotions",
  "payment-qr": "payment-qr",
};

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed" });
  }

  if ((process.env.IMAGE_STORAGE_DRIVER ?? "r2") !== "r2") {
    return response.status(400).json({ error: "R2 storage is not enabled" });
  }

  const env = readEnv();
  if (!env.r2) {
    return response.status(500).json({ error: "R2 is not configured" });
  }
  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    return response.status(500).json({ error: "Supabase is not configured" });
  }

  const token = getBearerToken(request);
  if (!token) {
    return response.status(401).json({ error: "Unauthorized" });
  }

  const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: { persistSession: false },
  });
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) {
    return response.status(401).json({ error: "Unauthorized" });
  }

  const upload = await readMultipartUpload(request).catch((error) => ({
    error: error instanceof Error ? error.message : "Invalid upload",
  }));
  if ("error" in upload) {
    return response.status(400).json({ error: upload.error });
  }

  if (!upload.file) {
    return response.status(400).json({ error: "Missing file" });
  }
  if (!ALLOWED_TYPES.has(upload.file.mimeType)) {
    return response.status(400).json({ error: "Unsupported image type" });
  }

  const key = buildR2ObjectKey(upload.fields.bucket, upload.fields.path);
  if (!key) {
    return response.status(400).json({ error: "Invalid upload path" });
  }

  const restaurantId = getRestaurantIdFromPath(upload.fields.path);
  if (!restaurantId) {
    return response.status(400).json({ error: "Invalid upload path" });
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
    return response.status(403).json({ error: "Forbidden" });
  }

  const client = new S3Client({
    region: "auto",
    endpoint: `https://${env.r2.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.r2.accessKeyId,
      secretAccessKey: env.r2.secretAccessKey,
    },
  });

  await client.send(
    new PutObjectCommand({
      Bucket: env.r2.bucketName,
      Key: key,
      Body: upload.file.buffer,
      ContentLength: upload.file.buffer.byteLength,
      ContentType: upload.file.mimeType || "application/octet-stream",
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );

  return response.status(200).json({
    publicUrl: `${env.r2.publicBaseUrl}/${key}`,
  });
}

function readEnv() {
  const r2 = allPresent(
    process.env.R2_ACCOUNT_ID,
    process.env.R2_ACCESS_KEY_ID,
    process.env.R2_SECRET_ACCESS_KEY,
    process.env.R2_BUCKET_NAME,
    process.env.R2_PUBLIC_BASE_URL,
  )
    ? {
        accountId: process.env.R2_ACCOUNT_ID,
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
        bucketName: process.env.R2_BUCKET_NAME,
        publicBaseUrl: process.env.R2_PUBLIC_BASE_URL.replace(/\/+$/, ""),
      }
    : null;

  return {
    supabaseUrl: process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL,
    supabaseAnonKey:
      process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY,
    r2,
  };
}

function allPresent(...values) {
  return values.every((value) => typeof value === "string" && value.trim());
}

function getBearerToken(request) {
  const header = request.headers.authorization;
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match?.[1]?.trim() || null;
}

function readMultipartUpload(request) {
  return new Promise((resolve, reject) => {
    const fields = { bucket: "", path: "" };
    let file = null;
    let fileBytes = 0;
    let settled = false;

    const busboy = Busboy({
      headers: request.headers,
      limits: {
        fileSize: MAX_IMAGE_SIZE,
        files: 1,
        fields: 2,
      },
    });

    function fail(error) {
      if (settled) return;
      settled = true;
      reject(error);
    }

    busboy.on("field", (name, value) => {
      if (name === "bucket" || name === "path") {
        fields[name] = value;
      }
    });

    busboy.on("file", (_name, stream, info) => {
      const chunks = [];
      stream.on("data", (chunk) => {
        fileBytes += chunk.length;
        chunks.push(chunk);
      });
      stream.on("limit", () => {
        fail(new Error("File too large"));
      });
      stream.on("end", () => {
        if (settled) return;
        file = {
          buffer: Buffer.concat(chunks, fileBytes),
          mimeType: info.mimeType,
          filename: info.filename,
        };
      });
    });

    busboy.on("error", fail);
    busboy.on("finish", () => {
      if (settled) return;
      settled = true;
      resolve({ fields, file });
    });

    request.pipe(busboy);
  });
}

function buildR2ObjectKey(bucket, path) {
  const prefix = PUBLIC_BUCKET_PREFIX[bucket];
  if (!prefix || !isSafeObjectPath(path)) return null;
  return `${prefix}/${path}`;
}

function getRestaurantIdFromPath(path) {
  const firstSegment = path.split("/")[0];
  return isUuid(firstSegment) ? firstSegment : null;
}

function isSafeObjectPath(path) {
  return /^[a-zA-Z0-9][a-zA-Z0-9/_.,=-]*$/.test(path) && !path.includes("..");
}

function isUuid(value) {
  return Boolean(
    value &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i.test(
        value,
      ),
  );
}
