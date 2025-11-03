export function canvasToBlob(canvas: HTMLCanvasElement, type = "image/png", quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Failed to export mask canvas."));
        return;
      }

      resolve(blob);
    }, type, quality);
  });
}

export function resetCanvas(canvas: HTMLCanvasElement) {
  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }

  context.clearRect(0, 0, canvas.width, canvas.height);
}

export function imageDataIsEmpty(imageData: ImageData): boolean {
  for (let i = 3; i < imageData.data.length; i += 4) {
    if (imageData.data[i] !== 0) {
      return false;
    }
  }

  return true;
}
