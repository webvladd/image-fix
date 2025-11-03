import { useMemo } from "react";
import type { IImageEditService } from "@services/IImageEditService";
import { HttpImageEditService } from "@services/HttpImageEditService";

export function useImageFixService(override?: IImageEditService) {
  return useMemo(() => override ?? new HttpImageEditService(), [override]);
}
