import type { SupabaseClient } from "@supabase/supabase-js";

// Compress to JPEG targeting <500KB — not WebP: Safari/iOS can't encode it
// and silently falls back to PNG.
export async function compressPhoto(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Could not process photo"))),
      "image/jpeg",
      0.8
    )
  );
}

// The photos bucket is private, so every render goes through signed URLs.
// Batch-signs the given paths (nulls and duplicates dropped) → path → URL.
export async function signPhotoPaths(
  supabase: SupabaseClient,
  paths: (string | null | undefined)[]
): Promise<Map<string, string>> {
  const unique = [...new Set(paths.filter((p): p is string => !!p))];
  if (!unique.length) return new Map();
  const { data } = await supabase.storage
    .from("photos")
    .createSignedUrls(unique, 3600);
  const map = new Map<string, string>();
  for (const d of data ?? []) {
    if (d.path && d.signedUrl) map.set(d.path, d.signedUrl);
  }
  return map;
}
