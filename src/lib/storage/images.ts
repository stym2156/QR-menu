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

  if (process.env.NEXT_PUBLIC_IMAGE_STORAGE_DRIVER === "r2") {
    const form = new FormData();
    form.append("bucket", options.bucket);
    form.append("path", path);
    form.append("file", compressed);

    const response = await fetch("/api/storage/upload", {
      method: "POST",
      body: form,
    });
    const result = (await response.json().catch(() => null)) as
      | { publicUrl?: string; error?: string }
      | null;

    if (!response.ok || !result?.publicUrl) {
      return { error: result?.error ?? "Upload failed" };
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
