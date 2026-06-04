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
  const { error: uploadError } = await supabase.storage
    .from(options.bucket)
    .upload(path, compressed, { cacheControl: "3600", upsert: false });

  if (uploadError) return { error: uploadError.message };

  const { data } = supabase.storage.from(options.bucket).getPublicUrl(path);
  return { publicUrl: data.publicUrl };
}
