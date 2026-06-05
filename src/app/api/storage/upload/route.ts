import { NextResponse } from "next/server";
import { getDashboardSession } from "@/server/auth";
import { buildR2ObjectKey, getR2Config, uploadToR2 } from "@/lib/r2";

export const runtime = "nodejs";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
]);

export async function POST(request: Request) {
  const session = await getDashboardSession();
  if (!session || session.membership.role !== "owner") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const config = getR2Config();
  if (!config) {
    return NextResponse.json(
      { error: "R2 is not configured" },
      { status: 500 },
    );
  }

  const form = await request.formData();
  const bucket = String(form.get("bucket") ?? "");
  const path = String(form.get("path") ?? "");
  const file = form.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Unsupported image type" }, { status: 400 });
  }
  if (file.size > MAX_IMAGE_SIZE) {
    return NextResponse.json({ error: "Image is too large" }, { status: 400 });
  }

  const key = buildR2ObjectKey(bucket, path);
  if (!key || !key.includes(`/${session.membership.restaurantId}/`)) {
    return NextResponse.json({ error: "Invalid upload path" }, { status: 400 });
  }

  const uploaded = await uploadToR2({ key, file, config });
  if ("error" in uploaded) {
    return NextResponse.json({ error: uploaded.error }, { status: 500 });
  }

  return NextResponse.json({ publicUrl: uploaded.publicUrl });
}
