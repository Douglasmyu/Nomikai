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

/** Photos ride to the API as multipart; the API derives the storage path. */
export function photoForm(blob: Blob): FormData {
  const form = new FormData();
  form.append("file", blob, "photo.jpg");
  return form;
}
