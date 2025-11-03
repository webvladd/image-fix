import { ChangeEvent, PointerEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LoadedImage, MaskUpdate } from "@types";
import { canvasToBlob, imageDataIsEmpty, resetCanvas } from "@utils/canvasHelpers";
import { readImageDimensions, validateImageFile } from "@utils/fileHelpers";
import { useTranslation } from "@i18n/TranslationProvider";
import type { TranslationKey } from "@i18n/translations";

import "@styles/components/_maskCanvas.scss";

type MaskCanvasProps = {
  image: LoadedImage | null;
  onImageSelected: (image: LoadedImage) => void;
  onMaskChange: (mask: MaskUpdate | null) => void;
  disabled?: boolean;
};

type Point = {
  x: number;
  y: number;
};

type HistoryItem = {
  mask: ImageData;
};

type PointerData = {
  canvas: Point;
  css: Point;
};

type Mode = "paint" | "pan";

const MIN_BRUSH_SIZE = 10;
const MAX_BRUSH_SIZE = 150;
const BRUSH_STEP = 10;
const HISTORY_LIMIT = 15;
const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.25;

const GREEN_PREVIEW_COLOR = "rgba(34, 197, 94, 1)";
const PREVIEW_ALPHA = 0.4;

export function MaskCanvas({ image, onImageSelected, onMaskChange, disabled = false }: MaskCanvasProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [brushSize, setBrushSize] = useState(40);
  const [maskEmpty, setMaskEmpty] = useState(true);
  const [isDrawing, setIsDrawing] = useState(false);
  const [mode, setMode] = useState<Mode>("paint");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [cursorPosition, setCursorPosition] = useState<Point | null>(null);
  const [errorKey, setErrorKey] = useState<TranslationKey | null>(null);
  const historyRef = useRef<HistoryItem[]>([]);
  const lastPointRef = useRef<Point | null>(null);
  const scaleRef = useRef({ x: 1, y: 1 });
  const panStateRef = useRef<{ active: boolean; pointerId: number | null; last: Point | null }>({
    active: false,
    pointerId: null,
    last: null,
  });
  const { t } = useTranslation();

  const hasImage = Boolean(image);
  const isInteractive = hasImage && !disabled && mode === "paint";

  const renderPreview = useCallback(() => {
    const previewCanvas = previewCanvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    if (!previewCanvas || !maskCanvas) {
      return;
    }

    const previewContext = previewCanvas.getContext("2d");
    if (!previewContext) {
      return;
    }

    previewContext.clearRect(0, 0, previewCanvas.width, previewCanvas.height);

    previewContext.save();
    previewContext.globalAlpha = PREVIEW_ALPHA;
    previewContext.globalCompositeOperation = "source-over";
    previewContext.fillStyle = GREEN_PREVIEW_COLOR;
    previewContext.fillRect(0, 0, previewCanvas.width, previewCanvas.height);

    previewContext.globalAlpha = 1;
    previewContext.globalCompositeOperation = "destination-in";
    previewContext.drawImage(maskCanvas, 0, 0);
    previewContext.restore();
  }, []);

  useEffect(() => {
    const previewCanvas = previewCanvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    if (!previewCanvas || !maskCanvas) {
      return;
    }

    if (!image) {
      resetCanvas(previewCanvas);
      resetCanvas(maskCanvas);
      historyRef.current = [];
      setMaskEmpty(true);
      onMaskChange(null);
      setCursorPosition(null);
      setZoom(1);
      setPan({ x: 0, y: 0 });
      setErrorKey(null);
      renderPreview();
      return;
    }

    previewCanvas.width = image.width;
    previewCanvas.height = image.height;
    maskCanvas.width = image.width;
    maskCanvas.height = image.height;

    resetCanvas(previewCanvas);
    resetCanvas(maskCanvas);
    historyRef.current = [];
    setMaskEmpty(true);
    onMaskChange(null);
    setCursorPosition(null);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setErrorKey(null);
    renderPreview();
  }, [image, onMaskChange, renderPreview]);

  const updateScaleRef = useCallback(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas) {
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const safeRectWidth = rect.width || 1;
    const safeRectHeight = rect.height || 1;
    const safeCanvasWidth = canvas.width || 1;
    const safeCanvasHeight = canvas.height || 1;

    scaleRef.current = {
      x: safeRectWidth / safeCanvasWidth,
      y: safeRectHeight / safeCanvasHeight,
    };
  }, []);

  useEffect(() => {
    updateScaleRef();
  }, [zoom, pan, image, updateScaleRef]);

  const pushHistory = useCallback(() => {
    const previewCanvas = previewCanvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    if (!previewCanvas || !maskCanvas) {
      return;
    }

    const maskContext = maskCanvas.getContext("2d");
    if (!maskContext) {
      return;
    }

    const maskSnapshot = maskContext.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
    historyRef.current.push({ mask: maskSnapshot });
    if (historyRef.current.length > HISTORY_LIMIT) {
      historyRef.current.shift();
    }
  }, []);

  const processFile = useCallback(
    async (file: File) => {
      const validationError = validateImageFile(file);
      if (validationError) {
        if (validationError === "unsupported-type") {
          setErrorKey("mask.errorUnsupportedType");
        } else if (validationError === "file-too-large") {
          setErrorKey("mask.errorTooLarge");
        }
        return;
      }

      setErrorKey(null);
      const objectUrl = URL.createObjectURL(file);
      try {
        const { width, height } = await readImageDimensions(objectUrl);
        onImageSelected({
          blob: file,
          url: objectUrl,
          width,
          height,
          name: file.name,
        });
      } catch (dimensionError) {
        URL.revokeObjectURL(objectUrl);
        setErrorKey("mask.errorRead");
      }
    },
    [onImageSelected]
  );

  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const [file] = event.target.files ?? [];
      if (!file) {
        return;
      }

      await processFile(file);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [processFile]
  );

  const emitMaskUpdate = useCallback(
    async (isEmpty: boolean) => {
      const maskCanvas = maskCanvasRef.current;
      if (!maskCanvas) {
        return;
      }

      if (isEmpty) {
        onMaskChange(null);
        return;
      }

      try {
        const blob = await canvasToBlob(maskCanvas);
        const maskUpdate: MaskUpdate = { blob, isEmpty: false };
        onMaskChange(maskUpdate);
      } catch (error) {
        console.error("Failed to export mask", error);
      }
    },
    [onMaskChange]
  );

  const extractPointerData = useCallback(
    (event: PointerEvent<HTMLCanvasElement>): PointerData | null => {
      const canvas = previewCanvasRef.current;
      if (!canvas) {
        return null;
      }

      const rect = canvas.getBoundingClientRect();
      const safeRectWidth = rect.width || 1;
      const safeRectHeight = rect.height || 1;
      const safeCanvasWidth = canvas.width || 1;
      const safeCanvasHeight = canvas.height || 1;

      const offsetX = event.clientX - rect.left;
      const offsetY = event.clientY - rect.top;
      const canvasScaleX = safeCanvasWidth / safeRectWidth;
      const canvasScaleY = safeCanvasHeight / safeRectHeight;

      scaleRef.current = {
        x: safeRectWidth / safeCanvasWidth,
        y: safeRectHeight / safeCanvasHeight,
      };

      return {
        canvas: { x: offsetX * canvasScaleX, y: offsetY * canvasScaleY },
        css: { x: offsetX, y: offsetY },
      };
    },
    []
  );

  const drawLine = useCallback(
    (from: Point, to: Point) => {
      const previewCanvas = previewCanvasRef.current;
      const maskCanvas = maskCanvasRef.current;
      if (!previewCanvas || !maskCanvas) {
        return;
      }

      const previewContext = previewCanvas.getContext("2d");
      const maskContext = maskCanvas.getContext("2d");
      if (!maskContext) {
        return;
      }

      maskContext.strokeStyle = "#ffffffff";
      maskContext.fillStyle = "#ffffffff";
      maskContext.lineCap = "round";
      maskContext.lineJoin = "round";
      maskContext.globalCompositeOperation = "source-over";
      maskContext.lineWidth = brushSize;

      maskContext.beginPath();
      maskContext.moveTo(from.x, from.y);
      maskContext.lineTo(to.x, to.y);
      maskContext.strokeStyle = "#ffffffff";
      maskContext.lineCap = "round";
      maskContext.lineJoin = "round";
      maskContext.lineWidth = brushSize;
      maskContext.stroke();
      maskContext.closePath();

      maskContext.beginPath();
      maskContext.fillStyle = "#ffffffff";
      maskContext.arc(to.x, to.y, brushSize / 2, 0, Math.PI * 2);
      maskContext.fill();
      maskContext.closePath();

      renderPreview();
    },
    [brushSize, renderPreview]
  );

  const startPan = useCallback((event: PointerEvent<HTMLCanvasElement>) => {
    panStateRef.current = {
      active: true,
      pointerId: event.pointerId,
      last: { x: event.clientX, y: event.clientY },
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }, []);

  const updatePan = useCallback((event: PointerEvent<HTMLCanvasElement>) => {
    if (!panStateRef.current.active || !panStateRef.current.last) {
      return;
    }

    const { last } = panStateRef.current;
    const deltaX = event.clientX - last.x;
    const deltaY = event.clientY - last.y;

    setPan((current) => ({
      x: current.x + deltaX,
      y: current.y + deltaY,
    }));

    panStateRef.current.last = { x: event.clientX, y: event.clientY };
  }, []);

  const finishPan = useCallback((event: PointerEvent<HTMLCanvasElement>) => {
    if (panStateRef.current.pointerId !== null) {
      try {
        event.currentTarget.releasePointerCapture(panStateRef.current.pointerId);
      } catch {
        // ignore if capture already released
      }
    }

    panStateRef.current = { active: false, pointerId: null, last: null };
  }, []);

  const handlePointerDown = useCallback(
    (event: PointerEvent<HTMLCanvasElement>) => {
      if (!image || disabled) {
        return;
      }

      if (mode === "pan") {
        event.preventDefault();
        startPan(event);
        setCursorPosition(null);
        return;
      }

      const pointer = extractPointerData(event);
      if (!pointer) {
        return;
      }

      event.preventDefault();
      pushHistory();
      setIsDrawing(true);
      lastPointRef.current = pointer.canvas;
      setCursorPosition(pointer.css);

      drawLine(pointer.canvas, pointer.canvas);
      setMaskEmpty(false);
    },
    [disabled, drawLine, extractPointerData, image, mode, pushHistory, startPan]
  );

  const handlePointerMove = useCallback(
    (event: PointerEvent<HTMLCanvasElement>) => {
      if (mode === "pan") {
        if (!disabled && panStateRef.current.active) {
          event.preventDefault();
          updatePan(event);
        }
        return;
      }

      const pointer = extractPointerData(event);
      if (!pointer) {
        return;
      }

      setCursorPosition(pointer.css);

      if (!isDrawing) {
        return;
      }

      const lastPoint = lastPointRef.current;
      if (!lastPoint) {
        return;
      }

      event.preventDefault();
      drawLine(lastPoint, pointer.canvas);
      lastPointRef.current = pointer.canvas;
    },
    [disabled, drawLine, extractPointerData, isDrawing, mode, updatePan]
  );

  const finishDrawing = useCallback(() => {
    if (!isDrawing) {
      return;
    }

    setIsDrawing(false);
    lastPointRef.current = null;
    setMaskEmpty(false);
    void emitMaskUpdate(false);
  }, [emitMaskUpdate, isDrawing]);

  const handlePointerUp = useCallback(
    (event: PointerEvent<HTMLCanvasElement>) => {
      if (mode === "pan") {
        event.preventDefault();
        finishPan(event);
        return;
      }

      event.preventDefault();
      finishDrawing();
    },
    [finishDrawing, finishPan, mode]
  );

  const handlePointerLeave = useCallback(
    (event: PointerEvent<HTMLCanvasElement>) => {
      if (mode === "pan") {
        finishPan(event);
        return;
      }

      setCursorPosition(null);
      if (!isDrawing) {
        return;
      }

      finishDrawing();
    },
    [finishDrawing, finishPan, isDrawing, mode]
  );

  const handlePointerEnter = useCallback(
    (event: PointerEvent<HTMLCanvasElement>) => {
      if (mode === "pan") {
        return;
      }

      const pointer = extractPointerData(event);
      if (pointer) {
        setCursorPosition(pointer.css);
      }
    },
    [extractPointerData, mode]
  );

  const handleUndo = useCallback(async () => {
    const previewCanvas = previewCanvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    if (!previewCanvas || !maskCanvas) {
      return;
    }

    const maskContext = maskCanvas.getContext("2d");
    if (!maskContext) {
      return;
    }

    const previous = historyRef.current.pop();
    if (!previous) {
      resetCanvas(previewCanvas);
      resetCanvas(maskCanvas);
      setMaskEmpty(true);
      onMaskChange(null);
      renderPreview();
      return;
    }

    maskContext.putImageData(previous.mask, 0, 0);
    const empty = imageDataIsEmpty(previous.mask);
    setMaskEmpty(empty);
    await emitMaskUpdate(empty);
    renderPreview();
  }, [emitMaskUpdate, onMaskChange, renderPreview]);

  const handleClear = useCallback(() => {
    const previewCanvas = previewCanvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    if (!previewCanvas || !maskCanvas) {
      return;
    }

    resetCanvas(previewCanvas);
    resetCanvas(maskCanvas);
    historyRef.current = [];
    setMaskEmpty(true);
    onMaskChange(null);
    setCursorPosition(null);
    renderPreview();
  }, [onMaskChange, renderPreview]);

  const increaseBrush = useCallback(() => {
    setBrushSize((current) => Math.min(current + BRUSH_STEP, MAX_BRUSH_SIZE));
  }, []);

  const decreaseBrush = useCallback(() => {
    setBrushSize((current) => Math.max(current - BRUSH_STEP, MIN_BRUSH_SIZE));
  }, []);

  const handleZoomIn = useCallback(() => {
    setZoom((current) => Math.min(MAX_ZOOM, Number((current + ZOOM_STEP).toFixed(2))));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((current) => Math.max(MIN_ZOOM, Number((current - ZOOM_STEP).toFixed(2))));
  }, []);

  useEffect(() => {
    if (mode === "paint") {
      return;
    }
    setCursorPosition(null);
  }, [mode]);

  useEffect(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas) {
      return;
    }

    const handleContextMenu = (event: MouseEvent) => {
      event.preventDefault();
    };

    canvas.addEventListener("contextmenu", handleContextMenu);
    return () => {
      canvas.removeEventListener("contextmenu", handleContextMenu);
    };
  }, []);

  const cursorSize = useMemo(() => {
    const scale = Math.min(scaleRef.current.x, scaleRef.current.y);
    return Math.max(1, brushSize * scale);
  }, [brushSize, zoom]);

  const cursorStyle = cursorPosition
    ? {
        width: `${cursorSize}px`,
        height: `${cursorSize}px`,
        left: `${cursorPosition.x}px`,
        top: `${cursorPosition.y}px`,
      }
    : undefined;

  const errorMessage = errorKey ? t(errorKey) : null;

  return (
    <section className="mask-canvas">
      <header className="mask-canvas__toolbar">
        <div className="mask-canvas__toolbar-row">
          <button
            type="button"
            className="mask-canvas__primary-button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
          >
            {t("mask.addImage")}
          </button>
          <div className="mask-canvas__mode">
            <button
              type="button"
              className={mode === "paint" ? "is-active" : ""}
              onClick={() => setMode("paint")}
              disabled={!hasImage || disabled}
            >
              {t("mask.modeMask")}
            </button>
            <button
              type="button"
              className={mode === "pan" ? "is-active" : ""}
              onClick={() => setMode("pan")}
              disabled={!hasImage || disabled}
            >
              {t("mask.modePan")}
            </button>
          </div>
        </div>
        <div className="mask-canvas__toolbar-row">
          <div className="mask-canvas__group">
            <span className="mask-canvas__group-label">{t("mask.brushLabel")}</span>
            <div className="mask-canvas__group-controls">
              <button type="button" onClick={decreaseBrush} disabled={!hasImage || disabled}>
                –
              </button>
              <span>{brushSize}px</span>
              <button type="button" onClick={increaseBrush} disabled={!hasImage || disabled}>
                +
              </button>
            </div>
          </div>
          <div className="mask-canvas__group">
            <span className="mask-canvas__group-label">{t("mask.zoomLabel")}</span>
            <div className="mask-canvas__group-controls">
              <button type="button" onClick={handleZoomOut} disabled={!hasImage || disabled || zoom <= MIN_ZOOM}>
                –
              </button>
              <span>{Math.round(zoom * 100)}%</span>
              <button type="button" onClick={handleZoomIn} disabled={!hasImage || disabled || zoom >= MAX_ZOOM}>
                +
              </button>
            </div>
          </div>
          <div className="mask-canvas__actions">
            <button type="button" onClick={handleUndo} disabled={maskEmpty || disabled}>
              {t("mask.undo")}
            </button>
            <button type="button" onClick={handleClear} disabled={maskEmpty || disabled}>
              {t("mask.clear")}
            </button>
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="mask-canvas__file-input"
          onChange={handleFileChange}
        />
      </header>

      {errorMessage ? <p className="mask-canvas__error">{errorMessage}</p> : null}

      <div className="mask-canvas__viewport">
        {image ? (
          <div
            className="mask-canvas__workspace"
            style={{ cursor: disabled ? "not-allowed" : mode === "pan" ? "grab" : "crosshair" }}
          >
            <div
              className="mask-canvas__pan-layer"
              style={{ transform: `translate(${pan.x}px, ${pan.y}px)` }}
            >
              <div
                className="mask-canvas__zoom-layer"
                style={{ transform: `scale(${zoom})` }}
              >
                <img src={image.url} alt={image.name} className="mask-canvas__image" draggable={false} />
                <canvas
                  ref={previewCanvasRef}
                  className="mask-canvas__draw-layer"
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={handlePointerUp}
                  onPointerLeave={handlePointerLeave}
                  onPointerEnter={handlePointerEnter}
                />
                {isInteractive && cursorStyle ? (
                  <span className="mask-canvas__cursor" style={cursorStyle} />
                ) : null}
              </div>
            </div>
            <canvas ref={maskCanvasRef} className="mask-canvas__hidden-canvas" aria-hidden />
          </div>
        ) : (
          <p className="mask-canvas__placeholder">{t("mask.placeholder")}</p>
        )}
      </div>
    </section>
  );
}
