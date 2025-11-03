const SUPPORTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;

export type SupportedImageMime = (typeof SUPPORTED_IMAGE_TYPES)[number];

export function isSupportedImageType(file: File): file is File & { type: SupportedImageMime } {
  return SUPPORTED_IMAGE_TYPES.includes(file.type as SupportedImageMime);
}

export type FileValidationError = "unsupported-type" | "file-too-large";

export function validateImageFile(file: File): FileValidationError | null {
  if (!isSupportedImageType(file)) {
    return "unsupported-type";
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return "file-too-large";
  }

  return null;
}

export function readImageDimensions(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = () => reject(new Error("Failed to load image for dimension check."));
    image.src = url;
  });
}
