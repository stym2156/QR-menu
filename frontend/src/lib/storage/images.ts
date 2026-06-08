import type { SupabaseClient } from "@supabase/supabase-js";
import { compressImage } from "@/lib/image";
import { randomId } from "@/lib/uuid";

export type PublicImageBucket =
  | "menu-images"
  | "promotion-images"
  | "payment-qr";

interface UploadPublicImageOptions {
  bucket: PublicImageBucket;
  ownerId: string;
  file: File;
  maxDimension?: number;
}

export async function uploadPublicImage(
  supabase: SupabaseClient,
  options: UploadPublicImageOptions,
): Promise<{ publicUrl: string } | { error: string }> {
  const compressed = await compressImage(
    options.file,
    options.maxDimension ? { maxDimension: options.maxDimension } : undefined,
  ).catch(() => options.file);
  const ext = compressed.name.split(".").pop() ?? "jpg";
  const path = `${options.ownerId}/${randomId()}.${ext}`;

  if (import.meta.env.VITE_IMAGE_STORAGE_DRIVER === "r2") {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return { error: "Authentication required" };

    const form = new FormData();
    form.append("bucket", options.bucket);
    form.append("path", path);
    form.append("file", compressed);

    const apiBaseUrl = (import.meta.env.VITE_API_URL ?? "").replace(/\/+$/, "");
    const response = await fetch(`${apiBaseUrl}/api/storage/upload`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: form,
    });
    const result = (await response.json().catch(() => null)) as
      | { publicUrl?: string; error?: string; code?: string }
      | null;

    if (!response.ok || !result?.publicUrl) {
      const message = result?.error ?? "Upload failed";
      return { error: result?.code ? `${result.code}: ${message}` : message };
    }
    return { publicUrl: result.publicUrl };
  }

  const { error: uploadError } = await supabase.storage
    .from(options.bucket)
    .upload(path, compressed, { cacheControl: "3600", upsert: false });

  if (uploadError) return { error: uploadError.message };

  const { data } = supabase.storage.from(options.bucket).getPublicUrl(path);
  return { publicUrl: data.publicUrl };
}
