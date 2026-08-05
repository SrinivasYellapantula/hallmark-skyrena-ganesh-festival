const MAX_STORED_IMAGE_BYTES = 1024 * 1024;

async function canvasBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", quality));
}

export async function optimizeImageUpload(file: File, baseName = "image") {
  if (file.size <= MAX_STORED_IMAGE_BYTES) return file;
  const bitmap = await createImageBitmap(file);
  let width = bitmap.width;
  let height = bitmap.height;
  const initialScale = Math.min(1, 1600 / Math.max(width, height));
  width = Math.max(1, Math.round(width * initialScale));
  height = Math.max(1, Math.round(height * initialScale));
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new Error("This browser cannot optimize the selected image.");
  }

  let blob: Blob | null = null;
  for (const quality of [0.82, 0.7, 0.58]) {
    canvas.width = width;
    canvas.height = height;
    context.drawImage(bitmap, 0, 0, width, height);
    blob = await canvasBlob(canvas, quality);
    if (blob && blob.size <= MAX_STORED_IMAGE_BYTES) break;
    if (blob) {
      const scale = Math.min(0.9, Math.sqrt(MAX_STORED_IMAGE_BYTES / blob.size) * 0.9);
      width = Math.max(1, Math.round(width * scale));
      height = Math.max(1, Math.round(height * scale));
    }
  }
  bitmap.close();
  if (!blob || blob.size > MAX_STORED_IMAGE_BYTES)
    throw new Error("The image is still too large. Please take a screenshot or crop it and try again.");
  return new File([blob], `${file.name.replace(/\.[^.]+$/, "") || baseName}.webp`, {
    type: "image/webp",
    lastModified: Date.now(),
  });
}
