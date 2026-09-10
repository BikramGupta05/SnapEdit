import { useEffect, useRef } from "react";
import { Circle, FabricImage, IText, PencilBrush, Point, Rect } from "fabric";

import { useFabricCanvas } from "../hooks/useFabricCanvas";

import type {
  EditorTool,
  ImageMetadata,
  SelectedAnnotation,
} from "../types/editor";

interface CanvasEditorProps {
  imageFile: File | null;

  activeTool: EditorTool;

  brushColor: string;
  brushWidth: number;

  textFontSize: number;
  textValue: string;

  rotationRequest: {
    id: number;
    direction: "left" | "right";
  };

  zoomRequest: {
    id: number;
    action: "in" | "out" | "reset";
  };

  onImageLoaded: (metadata: ImageMetadata) => void;

  onImageRotated: (rotation: number, scaleX: number, scaleY: number) => void;

  onCropApplied: (metadata: ImageMetadata) => void;

  onCropModeChange: (cropping: boolean) => void;

  onAnnotationSelected: (annotation: SelectedAnnotation | null) => void;

  onLoadingChange: (loading: boolean, message?: string) => void;

  onError: (message: string) => void;

  historyRequest: {
    id: number;
    direction: "undo" | "redo";
    snapshot: string;
  };

  onHistoryStateChange: (snapshot: string) => void;

  exportRequest: {
    id: number;
    type: "image" | "json";
  };
}

const CanvasEditor = ({
  imageFile,
  activeTool,

  brushColor,
  brushWidth,

  textFontSize,
  textValue,

  rotationRequest,

  zoomRequest,

  onImageLoaded,
  onImageRotated,

  onCropApplied,
  onCropModeChange,
  onAnnotationSelected,
  onLoadingChange,
  onError,

  historyRequest,
  onHistoryStateChange,

  exportRequest,
}: CanvasEditorProps) => {
  const { canvasElementRef, fabricCanvasRef, canvasWidth, canvasHeight } =
    useFabricCanvas();

  const imageRef = useRef<FabricImage | null>(null);

  const cropRectRef = useRef<Rect | null>(null);

  const isDrawingShapeRef = useRef(false);

  const shapeStartRef = useRef({
    x: 0,
    y: 0,
  });

  const isApplyingCropRef = useRef(false);

  const fileUrlRef = useRef<string | null>(null);

  const textValueRef = useRef(textValue);

  const lastRotationRequestRef = useRef(0);

  const rotationRef = useRef(0);

  const baseImageScaleRef = useRef(1);

  const isRestoringHistoryRef = useRef(false);

  const isApplyingOperationRef = useRef(false);

  const historyTimerRef = useRef<number | null>(null);

  const lastHistoryRequestRef = useRef(0);

  const zoomPointRef = useRef(new Point(canvasWidth / 2, canvasHeight / 2));

  const emitHistoryState = (force = false) => {
    const canvas = fabricCanvasRef.current;

    if (
      !canvas ||
      isRestoringHistoryRef.current ||
      (isApplyingOperationRef.current && !force)
    ) {
      return;
    }

    if (historyTimerRef.current !== null) {
      window.clearTimeout(historyTimerRef.current);
    }

    historyTimerRef.current = window.setTimeout(() => {
      historyTimerRef.current = null;

      if (
        isRestoringHistoryRef.current ||
        (isApplyingOperationRef.current && !force)
      ) {
        return;
      }

      const snapshot = JSON.stringify({
        canvas: canvas.toObject(["annotationType", "isTemporaryShape"]),
        rotation: rotationRef.current,
        baseImageScale: baseImageScaleRef.current,
      });

      onHistoryStateChange(snapshot);
    }, 120);
  };

  useEffect(() => {
    return () => {
      if (historyTimerRef.current !== null) {
        window.clearTimeout(historyTimerRef.current);
      }
    };
  }, []);

  /*
   * ============================================================
   * KEEP LATEST TEXT VALUE
   * ============================================================
   */

  useEffect(() => {
    textValueRef.current = textValue;
  }, [textValue]);

  /*
   * ============================================================
   * HELPERS
   * ============================================================
   */

  const isAnnotation = (object: any) => {
    const type = object.get("annotationType");

    return (
      type === "drawing" ||
      type === "rectangle" ||
      type === "circle" ||
      type === "text"
    );
  };

  const getCompositionObjects = (canvas: any) => {
    return canvas
      .getObjects()
      .filter(
        (object: any) =>
          object !== imageRef.current &&
          object !== cropRectRef.current &&
          isAnnotation(object),
      );
  };

  /*
   * Apply a fixed crop boundary to an annotation.
   *
   * The crop boundary is absolute to the canvas so moving an
   * annotation cannot make pixels outside the crop visible.
   * It is transformed together with the composition during
   * rotation. This keeps drawings/text editable while ensuring
   * that their portions outside the cropped image are hidden.
   */
  const setAnnotationCropClip = (
    object: any,
    left: number,
    top: number,
    width: number,
    height: number,
  ) => {
    object.set({
      clipPath: new Rect({
        originX: "center",
        originY: "center",
        left: left + width / 2,
        top: top + height / 2,
        width,
        height,
        scaleX: 1,
        scaleY: 1,
        angle: 0,
        absolutePositioned: true,
      }),
    });

    object.setCoords();
  };

  /*
   * Rotate a point around a center.
   */
  const rotatePoint = (
    x: number,
    y: number,
    centerX: number,
    centerY: number,
    angleDegrees: number,
  ) => {
    const radians = (angleDegrees * Math.PI) / 180;

    const cos = Math.cos(radians);
    const sin = Math.sin(radians);

    const translatedX = x - centerX;
    const translatedY = y - centerY;

    return {
      x: centerX + translatedX * cos - translatedY * sin,

      y: centerY + translatedX * sin + translatedY * cos,
    };
  };

  /*
   * ============================================================
   * LOAD IMAGE
   * ============================================================
   */

  useEffect(() => {
    const canvas = fabricCanvasRef.current;

    if (!canvas) {
      return;
    }

    if (!imageFile) {
      canvas.clear();

      canvas.backgroundColor = "#ffffff";

      imageRef.current = null;

      cropRectRef.current = null;

      rotationRef.current = 0;

      lastRotationRequestRef.current = 0;

      onAnnotationSelected(null);

      canvas.requestRenderAll();

      return;
    }

    const objectUrl = URL.createObjectURL(imageFile);

    if (fileUrlRef.current) {
      URL.revokeObjectURL(fileUrlRef.current);
    }

    fileUrlRef.current = objectUrl;

    const loadImage = async () => {
      onLoadingChange(true, "Loading image…");

      try {
        const canvas = fabricCanvasRef.current;

        if (!canvas) {
          return;
        }

        const image = await FabricImage.fromURL(objectUrl, {
          crossOrigin: "anonymous",
        });

        canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
        canvas.setZoom(1);
        canvas.clear();

        canvas.backgroundColor = "#ffffff";

        imageRef.current = image;

        cropRectRef.current = null;

        rotationRef.current = 0;

        const originalWidth = image.width || 1;

        const originalHeight = image.height || 1;

        /*
         * Fit the original image inside the editor.
         *
         * IMPORTANT:
         * scaleX and scaleY are intentionally identical.
         * This preserves the image aspect ratio.
         */

        const scale = Math.min(
          canvasWidth / originalWidth,
          canvasHeight / originalHeight,
        );

        image.set({
          originX: "center",
          originY: "center",

          left: canvasWidth / 2,
          top: canvasHeight / 2,

          scaleX: scale,
          scaleY: scale,

          angle: 0,

          selectable: false,
          evented: false,
        });

        baseImageScaleRef.current = scale;

        canvas.add(image);

        canvas.sendObjectToBack(image);

        canvas.requestRenderAll();

        onImageLoaded({
          originalWidth,
          originalHeight,

          rotation: 0,

          scaleX: scale,
          scaleY: scale,
        });

        emitHistoryState();
      } catch (error) {
        console.error("Failed to load image:", error);
        onError(
          "The image could not be loaded. Please try another image file.",
        );
      } finally {
        onLoadingChange(false);
      }
    };

    loadImage();

    return () => {
      URL.revokeObjectURL(objectUrl);

      if (fileUrlRef.current === objectUrl) {
        fileUrlRef.current = null;
      }
    };
  }, [
    imageFile,
    canvasWidth,
    canvasHeight,
    fabricCanvasRef,
    onImageLoaded,
    onAnnotationSelected,
    onLoadingChange,
    onError,
  ]);

  /*
   * ============================================================
   * ROTATE ENTIRE COMPOSITION
   * ============================================================
   *
   * IMPORTANT:
   *
   * A crop is destructive. After a crop is applied, the current
   * image becomes a brand-new independent Fabric image.
   *
   * Therefore rotation NEVER rotates a crop rectangle or a
   * clipPath. It only rotates the current image and annotations.
   *
   * This gives us:
   *
   * Crop -> independent image
   * Rotate -> independent image rotates normally
   * Crop again -> another independent image
   *
   * No crop state survives after a crop is applied.
   * ============================================================
   */

  useEffect(() => {
    if (rotationRequest.id === 0) {
      return;
    }

    if (rotationRequest.id === lastRotationRequestRef.current) {
      return;
    }

    lastRotationRequestRef.current = rotationRequest.id;

    const canvas = fabricCanvasRef.current;
    const image = imageRef.current;

    if (!canvas || !image) {
      return;
    }

    /*
     * A crop rectangle is only an editing UI.
     * Never allow rotation while it is present.
     */
    if (cropRectRef.current) {
      return;
    }

    isApplyingOperationRef.current = true;

    const direction = rotationRequest.direction === "right" ? 90 : -90;

    const previousRotation = rotationRef.current;

    const nextRotation = (((previousRotation + direction) % 360) + 360) % 360;

    const sourceWidth = image.width || 1;
    const sourceHeight = image.height || 1;

    /*
     * The source image dimensions are independent of
     * its current Fabric scale.
     *
     * For 90° / 270° the visual width and height swap.
     */
    const quarterTurn = nextRotation === 90 || nextRotation === 270;

    const rotatedWidth = quarterTurn ? sourceHeight : sourceWidth;

    const rotatedHeight = quarterTurn ? sourceWidth : sourceHeight;

    /*
     * Calculate the correct display scale from the
     * ORIGINAL dimensions of the current image.
     *
     * This prevents cumulative shrinking:
     *
     * landscape -> portrait -> landscape
     *
     * returns to the same scale.
     */
    /*
     * Keep the current image at its established base size
     * whenever that size fits the editor.
     *
     * Only scale down when a 90° rotation would make the
     * image larger than the canvas.
     *
     * This is especially important after cropping: a cropped
     * image keeps its own dimensions instead of being enlarged
     * just because it was rotated.
     */
    const maxFitScale = Math.min(
      canvasWidth / rotatedWidth,
      canvasHeight / rotatedHeight,
    );

    const targetScale = Math.min(baseImageScaleRef.current, maxFitScale);

    const currentScale = image.scaleX || 1;

    const compositionScale = targetScale / currentScale;

    /*
     * The image center is the single rotation center
     * for the entire composition.
     */
    const center = image.getCenterPoint();

    const annotations = getCompositionObjects(canvas);

    /*
     * ----------------------------------------------------------
     * 1. Rotate the image.
     * ----------------------------------------------------------
     */
    image.set({
      angle: nextRotation,
      scaleX: targetScale,
      scaleY: targetScale,
    });

    image.setCoords();

    /*
     * ----------------------------------------------------------
     * 2. Rotate every annotation around the image center.
     * ----------------------------------------------------------
     */
    annotations.forEach((object: any) => {
      const objectCenter = object.getCenterPoint();

      const rotatedCenter = rotatePoint(
        objectCenter.x,
        objectCenter.y,
        center.x,
        center.y,
        direction,
      );

      object.rotate(Number(object.angle || 0) + direction);

      object.setPositionByOrigin(rotatedCenter, "center", "center");

      /*
       * If this annotation belongs to a previously cropped
       * composition, rotate its fixed crop boundary as well.
       * The crop boundary belongs to the current image, not to
       * the annotation itself.
       */
      const annotationClip = object.clipPath;

      if (annotationClip) {
        const clipCenter = annotationClip.getCenterPoint();

        const rotatedClipCenter = rotatePoint(
          clipCenter.x,
          clipCenter.y,
          center.x,
          center.y,
          direction,
        );

        annotationClip.set({
          left: rotatedClipCenter.x,
          top: rotatedClipCenter.y,
          angle: Number(annotationClip.angle || 0) + direction,
        });

        annotationClip.setCoords();
      }

      object.setCoords();
    });

    /*
     * ----------------------------------------------------------
     * 3. Scale annotations by exactly the same amount
     *    as the image.
     * ----------------------------------------------------------
     *
     * The cropped image itself is a raster image whose
     * dimensions are already in canvas pixels. Therefore
     * annotations must follow the same scale when the
     * rotated image is fitted to the editor.
     */
    if (Math.abs(compositionScale - 1) > 0.000001) {
      annotations.forEach((object: any) => {
        const objectCenter = object.getCenterPoint();

        const scaledCenter = {
          x: center.x + (objectCenter.x - center.x) * compositionScale,

          y: center.y + (objectCenter.y - center.y) * compositionScale,
        };

        object.set({
          scaleX: (object.scaleX || 1) * compositionScale,

          scaleY: (object.scaleY || 1) * compositionScale,
        });

        object.setPositionByOrigin(scaledCenter, "center", "center");

        const annotationClip = object.clipPath;

        if (annotationClip) {
          const clipCenter = annotationClip.getCenterPoint();

          annotationClip.set({
            left: center.x + (clipCenter.x - center.x) * compositionScale,

            top: center.y + (clipCenter.y - center.y) * compositionScale,

            scaleX: (annotationClip.scaleX || 1) * compositionScale,

            scaleY: (annotationClip.scaleY || 1) * compositionScale,
          });

          annotationClip.setCoords();
        }

        object.setCoords();
      });
    }

    /*
     * ----------------------------------------------------------
     * 4. Always keep the image centered.
     * ----------------------------------------------------------
     *
     * Cropped images are already created centered, but this
     * also protects against any small position drift.
     */
    const finalImageCenter = image.getCenterPoint();

    const offsetX = canvasWidth / 2 - finalImageCenter.x;

    const offsetY = canvasHeight / 2 - finalImageCenter.y;

    if (Math.abs(offsetX) > 0.000001 || Math.abs(offsetY) > 0.000001) {
      image.left = (image.left || 0) + offsetX;

      image.top = (image.top || 0) + offsetY;

      image.setCoords();

      annotations.forEach((object: any) => {
        object.left = (object.left || 0) + offsetX;

        object.top = (object.top || 0) + offsetY;

        const annotationClip = object.clipPath;

        if (annotationClip) {
          annotationClip.left = (annotationClip.left || 0) + offsetX;

          annotationClip.top = (annotationClip.top || 0) + offsetY;

          annotationClip.setCoords();
        }

        object.setCoords();
      });
    }

    rotationRef.current = nextRotation;

    canvas.sendObjectToBack(image);

    canvas.requestRenderAll();

    onAnnotationSelected(null);

    onImageRotated(nextRotation, targetScale, targetScale);

    isApplyingOperationRef.current = false;
    emitHistoryState();
  }, [
    rotationRequest,
    canvasWidth,
    canvasHeight,
    fabricCanvasRef,
    onImageRotated,
    onAnnotationSelected,
  ]);

  /*
   * ============================================================
   * CURSOR-BASED ZOOM
   * ============================================================
   *
   * The zoom buttons use the last position of the mouse over the
   * canvas. This means the user can move the cursor to the top,
   * bottom, left, right, or any specific area and then click Zoom In
   * or Zoom Out to zoom around that exact point.
   *
   * Ctrl/Cmd + mouse wheel also zooms directly around the cursor.
   * Zoom changes only the Fabric viewport and therefore do not affect
   * the actual image, annotations, or Undo/Redo history.
   */

  useEffect(() => {
    const canvas = fabricCanvasRef.current;

    if (!canvas) {
      return;
    }

    zoomPointRef.current = new Point(canvasWidth / 2, canvasHeight / 2);

    const handleMouseMove = (event: any) => {
      const pointer = new Point(event.e.offsetX, event.e.offsetY);

      zoomPointRef.current = new Point(
        Math.max(0, Math.min(canvasWidth, pointer.x)),
        Math.max(0, Math.min(canvasHeight, pointer.y)),
      );
    };

    canvas.on("mouse:move", handleMouseMove);

    return () => {
      canvas.off("mouse:move", handleMouseMove);
    };
  }, [canvasWidth, canvasHeight, fabricCanvasRef]);

  useEffect(() => {
    if (zoomRequest.id === 0) {
      return;
    }

    const canvas = fabricCanvasRef.current;

    if (!canvas) {
      return;
    }

    const currentZoom = canvas.getZoom();
    let nextZoom = currentZoom;

    if (zoomRequest.action === "in") {
      nextZoom = Math.min(3, currentZoom + 0.25);
    } else if (zoomRequest.action === "out") {
      nextZoom = Math.max(0.5, currentZoom - 0.25);
    } else {
      nextZoom = 1;
    }

    const zoomPoint =
      zoomRequest.action === "reset"
        ? new Point(canvasWidth / 2, canvasHeight / 2)
        : zoomPointRef.current;

    canvas.zoomToPoint(zoomPoint, nextZoom);
    canvas.requestRenderAll();
  }, [zoomRequest, canvasWidth, canvasHeight, fabricCanvasRef]);

  useEffect(() => {
    const canvas = fabricCanvasRef.current;

    if (!canvas) {
      return;
    }

    const handleMouseWheel = (event: any) => {
      const nativeEvent = event.e as WheelEvent;

      // Keep normal scrolling available. Ctrl/Cmd + wheel performs zoom.
      if (!nativeEvent.ctrlKey && !nativeEvent.metaKey) {
        return;
      }

      nativeEvent.preventDefault();

      const pointer = new Point(nativeEvent.offsetX, nativeEvent.offsetY);

      const zoomPoint = new Point(
        Math.max(0, Math.min(canvasWidth, pointer.x)),
        Math.max(0, Math.min(canvasHeight, pointer.y)),
      );

      zoomPointRef.current = zoomPoint;

      const currentZoom = canvas.getZoom();
      const zoomFactor = nativeEvent.deltaY < 0 ? 1.1 : 0.9;
      const nextZoom = Math.max(0.5, Math.min(3, currentZoom * zoomFactor));

      canvas.zoomToPoint(zoomPoint, nextZoom);
      canvas.requestRenderAll();
    };

    canvas.on("mouse:wheel", handleMouseWheel);

    return () => {
      canvas.off("mouse:wheel", handleMouseWheel);
    };
  }, [canvasWidth, canvasHeight, fabricCanvasRef]);

  /*
   * ============================================================
   * TOOL / SELECTION STATE
   * ============================================================
   */

  useEffect(() => {
    const canvas = fabricCanvasRef.current;

    if (!canvas) {
      return;
    }

    canvas.getObjects().forEach((object: any) => {
      if (object === imageRef.current) {
        object.set({
          selectable: false,
          evented: false,
        });

        return;
      }

      if (object === cropRectRef.current) {
        object.set({
          selectable: activeTool === "crop",

          evented: activeTool === "crop",
        });

        return;
      }

      if (isAnnotation(object)) {
        object.set({
          selectable: activeTool === "select",

          evented: activeTool === "select",
        });
      }
    });

    if (activeTool !== "select" && activeTool !== "crop") {
      canvas.discardActiveObject();

      onAnnotationSelected(null);
    }

    canvas.requestRenderAll();
  }, [activeTool, fabricCanvasRef, onAnnotationSelected]);

  /*
   * ============================================================
   * SELECTED ANNOTATION
   * ============================================================
   */

  useEffect(() => {
    const canvas = fabricCanvasRef.current;

    if (!canvas) {
      return;
    }

    const updateSelectedAnnotation = () => {
      const activeObject = canvas.getActiveObject();

      if (!activeObject) {
        onAnnotationSelected(null);

        return;
      }

      if (
        activeObject === imageRef.current ||
        activeObject === cropRectRef.current
      ) {
        onAnnotationSelected(null);

        return;
      }

      if (activeObject.type === "activeSelection") {
        onAnnotationSelected(null);

        return;
      }

      const annotationType = activeObject.get("annotationType") as
        | string
        | undefined;

      if (
        annotationType !== "drawing" &&
        annotationType !== "rectangle" &&
        annotationType !== "circle" &&
        annotationType !== "text"
      ) {
        onAnnotationSelected(null);

        return;
      }

      const stroke = activeObject.get("stroke");

      const fill = activeObject.get("fill");

      const color =
        typeof stroke === "string"
          ? stroke
          : typeof fill === "string"
            ? fill
            : "#111827";

      const width = Number(activeObject.get("strokeWidth")) || 1;

      const fontSize = Number(activeObject.get("fontSize")) || 28;

      const text =
        typeof activeObject.get("text") === "string"
          ? (activeObject.get("text") as string)
          : "";

      onAnnotationSelected({
        type: annotationType as "drawing" | "rectangle" | "circle" | "text",

        color,

        width,

        fontSize,

        text,
      });
    };

    canvas.on("selection:created", updateSelectedAnnotation);

    canvas.on("selection:updated", updateSelectedAnnotation);

    canvas.on("selection:cleared", updateSelectedAnnotation);

    return () => {
      canvas.off("selection:created", updateSelectedAnnotation);

      canvas.off("selection:updated", updateSelectedAnnotation);

      canvas.off("selection:cleared", updateSelectedAnnotation);
    };
  }, [fabricCanvasRef, onAnnotationSelected]);

  /*
   * ============================================================
   * DIRECT TEXT EDITING SYNC
   * ============================================================
   */

  useEffect(() => {
    const canvas = fabricCanvasRef.current;

    if (!canvas) {
      return;
    }

    const handleTextChanged = (event: { target?: any }) => {
      const target = event.target;

      if (!target) {
        return;
      }

      if (target.get("annotationType") !== "text") {
        return;
      }

      if (canvas.getActiveObject() !== target) {
        return;
      }

      onAnnotationSelected({
        type: "text",

        color:
          typeof target.get("fill") === "string"
            ? (target.get("fill") as string)
            : "#111827",

        width: Number(target.get("strokeWidth")) || 1,

        fontSize: Number(target.get("fontSize")) || 28,

        text:
          typeof target.get("text") === "string"
            ? (target.get("text") as string)
            : "",
      });
    };

    canvas.on("text:changed", handleTextChanged);

    return () => {
      canvas.off("text:changed", handleTextChanged);
    };
  }, [fabricCanvasRef, onAnnotationSelected]);

  /*
   * ============================================================
   * SELECTED ANNOTATION PROPERTY EDITING
   * ============================================================
   */

  useEffect(() => {
    const canvas = fabricCanvasRef.current;

    if (!canvas || activeTool !== "select") {
      return;
    }

    const activeObject = canvas.getActiveObject();

    if (!activeObject) {
      return;
    }

    if (
      activeObject === imageRef.current ||
      activeObject === cropRectRef.current
    ) {
      return;
    }

    if (activeObject.type === "activeSelection") {
      return;
    }

    const annotationType = activeObject.get("annotationType") as
      | string
      | undefined;

    if (
      annotationType === "drawing" ||
      annotationType === "rectangle" ||
      annotationType === "circle"
    ) {
      activeObject.set({
        stroke: brushColor,

        strokeWidth: brushWidth,
      });

      activeObject.setCoords();

      canvas.requestRenderAll();

      emitHistoryState();

      return;
    }

    if (annotationType === "text") {
      const textObject = activeObject as IText;

      if (textObject.isEditing) {
        return;
      }

      activeObject.set({
        fill: brushColor,

        fontSize: textFontSize,

        text: textValue,
      });

      activeObject.setCoords();

      canvas.requestRenderAll();

      emitHistoryState();
    }
  }, [
    activeTool,
    brushColor,
    brushWidth,
    textFontSize,
    textValue,
    fabricCanvasRef,
  ]);

  /*
   * ============================================================
   * HISTORY TRACKING
   * ============================================================
   *
   * Fabric events capture user-driven edits such as drawing,
   * moving, resizing, deleting, and text editing. Individual
   * operations such as rotation/crop also call emitHistoryState
   * explicitly after they finish.
   */

  useEffect(() => {
    const canvas = fabricCanvasRef.current;

    if (!canvas) {
      return;
    }

    const handleObjectModified = (event: any) => {
      if (isRestoringHistoryRef.current) {
        return;
      }

      const target = event?.target;

      if (
        target?.get?.("annotationType") === "crop" ||
        target?.get?.("isTemporaryShape") === true
      ) {
        return;
      }

      emitHistoryState();
    };

    const handleCanvasChange = () => {
      if (isRestoringHistoryRef.current) {
        return;
      }

      emitHistoryState();
    };

    canvas.on("object:modified", handleObjectModified);
    canvas.on("object:removed", handleCanvasChange);
    canvas.on("path:created", handleCanvasChange);
    canvas.on("text:changed", handleCanvasChange);

    return () => {
      canvas.off("object:modified", handleObjectModified);
      canvas.off("object:removed", handleCanvasChange);
      canvas.off("path:created", handleCanvasChange);
      canvas.off("text:changed", handleCanvasChange);
    };
  }, [fabricCanvasRef, onHistoryStateChange]);

  /*
   * ============================================================
   * UNDO / REDO RESTORE
   * ============================================================
   */

  useEffect(() => {
    if (historyRequest.id === 0) {
      return;
    }

    if (historyRequest.id === lastHistoryRequestRef.current) {
      return;
    }

    lastHistoryRequestRef.current = historyRequest.id;

    const canvas = fabricCanvasRef.current;

    if (!canvas) {
      return;
    }

    const restoreSnapshot = async () => {
      isRestoringHistoryRef.current = true;

      try {
        const payload = JSON.parse(historyRequest.snapshot);

        await canvas.loadFromJSON(payload.canvas);

        const objects = canvas.getObjects();

        const restoredImage = objects.find(
          (object: any) => object.type === "image",
        ) as FabricImage | undefined;

        const restoredCrop = objects.find(
          (object: any) => object.get("annotationType") === "crop",
        ) as Rect | undefined;

        imageRef.current = restoredImage || null;
        cropRectRef.current = restoredCrop || null;

        rotationRef.current = Number(payload.rotation) || 0;

        baseImageScaleRef.current = Number(payload.baseImageScale) || 1;

        if (restoredImage) {
          restoredImage.set({
            selectable: false,
            evented: false,
          });

          canvas.sendObjectToBack(restoredImage);
        }

        objects.forEach((object: any) => {
          if (object === restoredImage) {
            return;
          }

          if (object === restoredCrop) {
            object.set({
              selectable: activeTool === "crop",
              evented: activeTool === "crop",
            });
            return;
          }

          if (isAnnotation(object)) {
            object.set({
              selectable: activeTool === "select",
              evented: activeTool === "select",
            });
          }

          object.setCoords();
        });

        canvas.discardActiveObject();
        canvas.requestRenderAll();

        onAnnotationSelected(null);

        if (restoredImage) {
          onImageRotated(
            rotationRef.current,
            restoredImage.scaleX || 1,
            restoredImage.scaleY || 1,
          );
        }
      } catch (error) {
        console.error("Failed to restore history state:", error);
      } finally {
        isRestoringHistoryRef.current = false;
      }
    };

    void restoreSnapshot();
  }, [
    historyRequest,
    activeTool,
    fabricCanvasRef,
    onAnnotationSelected,
    onImageRotated,
  ]);

  /*
   * ============================================================
   * DELETE ANNOTATION
   * ============================================================
   */

  useEffect(() => {
    const canvas = fabricCanvasRef.current;

    if (!canvas) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (activeTool !== "select") {
        return;
      }

      const activeObject = canvas.getActiveObject();

      if (!activeObject) {
        return;
      }

      if (activeObject.type === "i-text") {
        const textObject = activeObject as IText;

        if (textObject.isEditing) {
          return;
        }
      }

      if (
        activeObject === imageRef.current ||
        activeObject === cropRectRef.current
      ) {
        return;
      }

      if (activeObject.type === "activeSelection") {
        return;
      }

      const annotationType = activeObject.get("annotationType");

      if (!annotationType) {
        return;
      }

      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();

        canvas.remove(activeObject);

        canvas.discardActiveObject();

        onAnnotationSelected(null);

        canvas.requestRenderAll();

        emitHistoryState();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeTool, fabricCanvasRef, onAnnotationSelected]);

  /*
   * ============================================================
   * PENCIL
   * ============================================================
   */

  useEffect(() => {
    const canvas = fabricCanvasRef.current;

    if (!canvas) {
      return;
    }

    if (activeTool !== "pencil") {
      canvas.isDrawingMode = false;

      return;
    }

    const brush = new PencilBrush(canvas);

    brush.color = brushColor;

    brush.width = brushWidth;

    canvas.freeDrawingBrush = brush;

    canvas.isDrawingMode = true;

    const handlePathCreated = (event: { path?: any }) => {
      const path = event.path;

      if (!path) {
        return;
      }

      path.set({
        annotationType: "drawing",

        selectable: false,

        evented: false,
      });

      canvas.requestRenderAll();
      emitHistoryState();
    };

    canvas.on("path:created", handlePathCreated);

    return () => {
      canvas.isDrawingMode = false;

      canvas.off("path:created", handlePathCreated);
    };
  }, [activeTool, brushColor, brushWidth, fabricCanvasRef]);

  /*
   * ============================================================
   * RECTANGLE / CIRCLE
   * ============================================================
   */

  useEffect(() => {
    const canvas = fabricCanvasRef.current;

    if (!canvas) {
      return;
    }

    if (activeTool !== "rectangle" && activeTool !== "circle") {
      return;
    }

    const handleMouseDown = (event: any) => {
      const pointer = canvas.getScenePoint(event.e);

      isDrawingShapeRef.current = true;

      shapeStartRef.current = {
        x: pointer.x,
        y: pointer.y,
      };
    };

    const handleMouseMove = (event: any) => {
      if (!isDrawingShapeRef.current) {
        return;
      }

      const pointer = canvas.getScenePoint(event.e);

      const start = shapeStartRef.current;

      const width = Math.abs(pointer.x - start.x);

      const height = Math.abs(pointer.y - start.y);

      const left = Math.min(start.x, pointer.x);

      const top = Math.min(start.y, pointer.y);

      let shape = canvas
        .getObjects()
        .find((object: any) => object.get("isTemporaryShape") === true);

      if (!shape) {
        if (activeTool === "rectangle") {
          shape = new Rect({
            originX: "left",
            originY: "top",

            left,
            top,

            width,
            height,

            fill: "transparent",

            stroke: brushColor,

            strokeWidth: brushWidth,

            selectable: false,

            evented: false,

            annotationType: "rectangle",

            isTemporaryShape: true,
          });
        } else {
          const radius = Math.max(width, height) / 2;

          shape = new Circle({
            originX: "left",
            originY: "top",

            left,
            top,

            radius,

            fill: "transparent",

            stroke: brushColor,

            strokeWidth: brushWidth,

            selectable: false,

            evented: false,

            annotationType: "circle",

            isTemporaryShape: true,
          });
        }

        canvas.add(shape);
      } else if (activeTool === "rectangle") {
        shape.set({
          left,
          top,

          width,
          height,
        });
      } else {
        const radius = Math.max(width, height) / 2;

        shape.set({
          left,
          top,

          radius,
        });
      }

      shape.setCoords();

      canvas.requestRenderAll();
    };

    const handleMouseUp = () => {
      if (!isDrawingShapeRef.current) {
        return;
      }

      isDrawingShapeRef.current = false;

      const temporaryShape = canvas
        .getObjects()
        .find((object: any) => object.get("isTemporaryShape") === true);

      if (temporaryShape) {
        temporaryShape.set({
          isTemporaryShape: false,

          selectable: false,

          evented: false,
        });

        canvas.requestRenderAll();
        emitHistoryState();
      }
    };

    canvas.on("mouse:down", handleMouseDown);

    canvas.on("mouse:move", handleMouseMove);

    canvas.on("mouse:up", handleMouseUp);

    return () => {
      canvas.off("mouse:down", handleMouseDown);

      canvas.off("mouse:move", handleMouseMove);

      canvas.off("mouse:up", handleMouseUp);

      isDrawingShapeRef.current = false;
    };
  }, [activeTool, brushColor, brushWidth, fabricCanvasRef]);

  /*
   * ============================================================
   * TEXT
   * ============================================================
   */

  useEffect(() => {
    const canvas = fabricCanvasRef.current;

    if (!canvas || activeTool !== "text") {
      return;
    }

    const handleMouseDown = (event: any) => {
      const pointer = canvas.getScenePoint(event.e);

      const text = textValueRef.current.trim();

      const textObject = new IText(text || "Type here", {
        originX: "left",

        originY: "top",

        left: pointer.x,

        top: pointer.y,

        fill: brushColor,

        fontSize: textFontSize,

        fontFamily: "Arial",

        annotationType: "text",

        selectable: true,

        evented: true,

        editable: true,
      });

      canvas.add(textObject);

      canvas.setActiveObject(textObject);

      textObject.enterEditing();

      textObject.selectAll();

      canvas.requestRenderAll();
      emitHistoryState();
    };

    canvas.on("mouse:down", handleMouseDown);

    return () => {
      canvas.off("mouse:down", handleMouseDown);
    };
  }, [activeTool, brushColor, textFontSize, fabricCanvasRef]);

  /*
   * ============================================================
   * CROP MODE
   * ============================================================
   *
   * Crop can be activated at ANY point:
   *
   * Image
   * Image + annotations
   * Rotated image
   * Rotated image + annotations
   * Already cropped image
   *
   * The crop rectangle is always created using
   * the CURRENT visual image bounds.
   * ============================================================
   */

  useEffect(() => {
    const canvas = fabricCanvasRef.current;

    const image = imageRef.current;

    if (!canvas) {
      return;
    }

    if (activeTool !== "crop" || !image) {
      const existingCrop = cropRectRef.current;

      if (existingCrop) {
        canvas.remove(existingCrop);

        cropRectRef.current = null;

        canvas.requestRenderAll();
      }

      onCropModeChange(false);

      return;
    }

    onCropModeChange(true);

    /*
     * Remove an old temporary crop box
     * before creating a new one.
     */
    if (cropRectRef.current) {
      canvas.remove(cropRectRef.current);

      cropRectRef.current = null;
    }

    /*
     * Get CURRENT rotated image bounds.
     */
    image.setCoords();

    const imageBounds = image.getBoundingRect();

    /*
     * If a previous crop exists, use its
     * visible bounding area as the maximum
     * available crop area.
     */
    let availableLeft = imageBounds.left;

    let availableTop = imageBounds.top;

    let availableWidth = imageBounds.width;

    let availableHeight = imageBounds.height;

    const existingClip = canvas.clipPath as Rect | undefined;

    if (existingClip) {
      existingClip.setCoords();

      const clipBounds = existingClip.getBoundingRect();

      const right = Math.min(
        imageBounds.left + imageBounds.width,
        clipBounds.left + clipBounds.width,
      );

      const bottom = Math.min(
        imageBounds.top + imageBounds.height,
        clipBounds.top + clipBounds.height,
      );

      availableLeft = Math.max(imageBounds.left, clipBounds.left);

      availableTop = Math.max(imageBounds.top, clipBounds.top);

      availableWidth = Math.max(0, right - availableLeft);

      availableHeight = Math.max(0, bottom - availableTop);
    }

    /*
     * Default crop = 70% of current available area.
     */
    const cropWidth = availableWidth * 0.7;

    const cropHeight = availableHeight * 0.7;

    const cropLeft = availableLeft + (availableWidth - cropWidth) / 2;

    const cropTop = availableTop + (availableHeight - cropHeight) / 2;

    const cropRect = new Rect({
      originX: "left",

      originY: "top",

      left: cropLeft,

      top: cropTop,

      width: cropWidth,

      height: cropHeight,

      scaleX: 1,

      scaleY: 1,

      fill: "rgba(255,255,255,0.12)",

      stroke: "#111827",

      strokeWidth: 2,

      strokeDashArray: [8, 6],

      selectable: true,

      evented: true,

      lockRotation: true,

      annotationType: "crop",
    });

    cropRectRef.current = cropRect;

    canvas.add(cropRect);

    canvas.bringObjectToFront(cropRect);

    canvas.setActiveObject(cropRect);

    canvas.requestRenderAll();

    /*
     * ----------------------------------------------------------
     * Keep crop inside the current available area.
     * ----------------------------------------------------------
     */
    const constrainCrop = () => {
      const currentCrop = cropRectRef.current;

      const currentImage = imageRef.current;

      if (!currentCrop || !currentImage) {
        return;
      }

      currentImage.setCoords();

      const bounds = currentImage.getBoundingRect();

      let availableBounds = {
        left: bounds.left,
        top: bounds.top,
        width: bounds.width,
        height: bounds.height,
      };

      /*
       * If there is already a crop clip,
       * constrain the new crop inside it.
       */
      const clip = canvas.clipPath as Rect | undefined;

      if (clip) {
        clip.setCoords();

        const clipBounds = clip.getBoundingRect();

        const right = Math.min(
          bounds.left + bounds.width,
          clipBounds.left + clipBounds.width,
        );

        const bottom = Math.min(
          bounds.top + bounds.height,
          clipBounds.top + clipBounds.height,
        );

        availableBounds = {
          left: Math.max(bounds.left, clipBounds.left),

          top: Math.max(bounds.top, clipBounds.top),

          width: Math.max(0, right - Math.max(bounds.left, clipBounds.left)),

          height: Math.max(0, bottom - Math.max(bounds.top, clipBounds.top)),
        };
      }

      let width = currentCrop.getScaledWidth();

      let height = currentCrop.getScaledHeight();

      if (width > availableBounds.width) {
        currentCrop.scaleX =
          availableBounds.width / Math.max(currentCrop.width || 1, 1);

        width = currentCrop.getScaledWidth();
      }

      if (height > availableBounds.height) {
        currentCrop.scaleY =
          availableBounds.height / Math.max(currentCrop.height || 1, 1);

        height = currentCrop.getScaledHeight();
      }

      let left = currentCrop.left || 0;

      let top = currentCrop.top || 0;

      left = Math.max(
        availableBounds.left,
        Math.min(left, availableBounds.left + availableBounds.width - width),
      );

      top = Math.max(
        availableBounds.top,
        Math.min(top, availableBounds.top + availableBounds.height - height),
      );

      currentCrop.set({
        left,
        top,
      });

      currentCrop.setCoords();

      canvas.requestRenderAll();
    };

    const handleMoving = () => {
      constrainCrop();
    };

    const handleScaling = () => {
      constrainCrop();
    };

    canvas.on("object:moving", handleMoving);

    canvas.on("object:scaling", handleScaling);

    return () => {
      canvas.off("object:moving", handleMoving);

      canvas.off("object:scaling", handleScaling);

      if (cropRectRef.current === cropRect) {
        canvas.remove(cropRect);

        cropRectRef.current = null;

        canvas.requestRenderAll();
      }
    };
  }, [activeTool, fabricCanvasRef, onCropModeChange]);

  /*
   * ============================================================
   * APPLY CROP
   * ============================================================
   *
   * CROP IS DESTRUCTIVE.
   *
   * This is the important architectural change.
   *
   * We do NOT keep a canvas clipPath after cropping.
   *
   * Instead:
   *
   * 1. Read the visible image pixels inside the crop area.
   * 2. Create a NEW FabricImage from those pixels.
   * 3. Remove the old image.
   * 4. Remove the temporary crop rectangle.
   * 5. Move annotations into the new image coordinate space.
   * 6. Reset image rotation to 0.
   *
   * After this function finishes, there is no relationship
   * between the new image and the old crop rectangle.
   *
   * Therefore:
   *
   * Crop -> Rotate -> Crop -> Rotate -> Crop
   *
   * works independently every time.
   * ============================================================
   */

  useEffect(() => {
    const canvas = fabricCanvasRef.current;

    if (!canvas || activeTool !== "crop") {
      return;
    }

    const handleDoubleClick = async () => {
      if (isApplyingCropRef.current) {
        return;
      }

      const image = imageRef.current;
      const cropRect = cropRectRef.current;

      if (!image || !cropRect) {
        return;
      }

      isApplyingCropRef.current = true;
      onLoadingChange(true, "Applying crop…");
      isApplyingOperationRef.current = true;

      /*
       * Zoom changes Fabric's viewport transform. Crop coordinates,
       * however, are calculated in the editor's scene coordinates.
       * Temporarily remove the viewport transform while calculating
       * and rendering the crop so zoom cannot change the crop area.
       * The original zoom/pan is restored after the crop finishes.
       */
      const previousViewportTransform: [
        number,
        number,
        number,
        number,
        number,
        number,
      ] = canvas.viewportTransform
        ? [
            canvas.viewportTransform[0],
            canvas.viewportTransform[1],
            canvas.viewportTransform[2],
            canvas.viewportTransform[3],
            canvas.viewportTransform[4],
            canvas.viewportTransform[5],
          ]
        : [1, 0, 0, 1, 0, 0];

      canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);

      /*
       * Save the objects before changing the canvas.
       */
      const annotations = getCompositionObjects(canvas);

      try {
        image.setCoords();
        cropRect.setCoords();

        /*
         * Crop rectangle is axis-aligned because rotation
         * is locked while the crop tool is active.
         *
         * getBoundingRect() gives us actual canvas-space
         * coordinates, including any scaling.
         */
        const cropBounds = cropRect.getBoundingRect();

        const cropLeft = Math.max(0, Math.round(cropBounds.left));

        const cropTop = Math.max(0, Math.round(cropBounds.top));

        const cropRight = Math.min(
          canvasWidth,
          Math.round(cropBounds.left + cropBounds.width),
        );

        const cropBottom = Math.min(
          canvasHeight,
          Math.round(cropBounds.top + cropBounds.height),
        );

        const cropWidth = cropRight - cropLeft;

        const cropHeight = cropBottom - cropTop;

        if (cropWidth <= 1 || cropHeight <= 1) {
          return;
        }

        /*
         * --------------------------------------------------------
         * 1. Hide everything except the image.
         * --------------------------------------------------------
         *
         * The new cropped image must contain ONLY the
         * image pixels. Annotations remain real Fabric
         * objects and therefore stay editable.
         */
        const previousVisibility = new Map<any, boolean>();

        canvas.getObjects().forEach((object: any) => {
          previousVisibility.set(object, object.visible !== false);

          object.set({
            visible: object === image,
          });
        });

        cropRect.set({
          visible: false,
        });

        /*
         * There must never be a canvas-level crop clip. The
         * current image is physically cropped and annotations
         * get their own fixed crop boundary below.
         */
        canvas.clipPath = undefined;

        canvas.discardActiveObject();

        canvas.renderAll();

        /*
         * --------------------------------------------------------
         * 2. Create actual cropped image pixels.
         * --------------------------------------------------------
         */
        const croppedDataUrl = canvas.toDataURL({
          format: "png",
          left: cropLeft,
          top: cropTop,
          width: cropWidth,
          height: cropHeight,
          multiplier: 1,
        });

        /*
         * Restore object visibility before awaiting the
         * asynchronous Fabric image creation.
         */
        previousVisibility.forEach((visible, object) => {
          object.set({ visible });
        });

        cropRect.set({
          visible: true,
        });

        /*
         * --------------------------------------------------------
         * 3. Create the NEW independent image.
         * --------------------------------------------------------
         */
        const newImage = await FabricImage.fromURL(croppedDataUrl);

        /*
         * The new image is already expressed in canvas
         * pixels. Start it with scale 1.
         */
        newImage.set({
          originX: "center",
          originY: "center",

          left: canvasWidth / 2,

          top: canvasHeight / 2,

          scaleX: 1,
          scaleY: 1,

          angle: 0,

          selectable: false,
          evented: false,
        });

        /*
         * --------------------------------------------------------
         * 4. Move annotations from old canvas coordinates
         *    into the new cropped coordinate system.
         * --------------------------------------------------------
         *
         * Old point:
         *
         *   (x, y)
         *
         * New point:
         *
         *   (x - cropLeft, y - cropTop)
         *
         * Then place the cropped image in the center of
         * the editor.
         */
        const newImageLeft = canvasWidth / 2;

        const newImageTop = canvasHeight / 2;

        const croppedCenterX = cropWidth / 2;

        const croppedCenterY = cropHeight / 2;

        const offsetX = newImageLeft - croppedCenterX - cropLeft;

        const offsetY = newImageTop - croppedCenterY - cropTop;

        annotations.forEach((object: any) => {
          const objectCenter = object.getCenterPoint();

          object.setPositionByOrigin(
            {
              x: objectCenter.x + offsetX,

              y: objectCenter.y + offsetY,
            },
            "center",
            "center",
          );

          /*
           * Remove any previous crop clip and replace it with
           * the crop boundary in the NEW coordinate system.
           * This means the annotation can never show its old
           * pixels outside the newly cropped image.
           */
          setAnnotationCropClip(
            object,
            canvasWidth / 2 - cropWidth / 2,
            canvasHeight / 2 - cropHeight / 2,
            cropWidth,
            cropHeight,
          );

          object.setCoords();
        });

        /*
         * --------------------------------------------------------
         * 5. Replace the old image.
         * --------------------------------------------------------
         */
        canvas.remove(image);

        canvas.add(newImage);

        imageRef.current = newImage;

        /*
         * The crop has now created a completely new
         * coordinate system. Rotation starts again from 0°.
         */
        rotationRef.current = 0;
        baseImageScaleRef.current = 1;

        /*
         * Remove the temporary crop object.
         */
        canvas.remove(cropRect);

        cropRectRef.current = null;

        /*
         * New image must remain behind annotations.
         */
        canvas.sendObjectToBack(newImage);

        canvas.discardActiveObject();

        canvas.requestRenderAll();

        /*
         * --------------------------------------------------------
         * 6. Update editor state.
         * --------------------------------------------------------
         *
         * The cropped dimensions are now the dimensions of
         * the CURRENT independent image.
         */
        onCropApplied({
          originalWidth: cropWidth,
          originalHeight: cropHeight,

          rotation: 0,

          scaleX: 1,
          scaleY: 1,
        });

        onAnnotationSelected(null);
      } catch (error) {
        console.error("Failed to crop image:", error);
        onError(
          "The crop could not be applied. Please try a different crop area.",
        );
      } finally {
        /*
         * Restore the exact zoom/pan state the user had before
         * cropping. This keeps zoom purely a viewport operation
         * while ensuring the crop itself is calculated correctly.
         */
        canvas.setViewportTransform(previousViewportTransform);
        canvas.requestRenderAll();

        isApplyingCropRef.current = false;
        isApplyingOperationRef.current = false;
        onLoadingChange(false);

        if (!isApplyingCropRef.current) {
          emitHistoryState();
        }
      }
    };

    canvas.on("mouse:dblclick", handleDoubleClick);

    return () => {
      canvas.off("mouse:dblclick", handleDoubleClick);
    };
  }, [
    activeTool,
    canvasWidth,
    canvasHeight,
    fabricCanvasRef,
    onCropApplied,
    onAnnotationSelected,
    onLoadingChange,
    onError,
  ]);

  /*
   * ============================================================
   * EXPORT
   * ============================================================
   */

  useEffect(() => {
    if (exportRequest.id === 0) {
      return;
    }

    const canvas = fabricCanvasRef.current;

    if (!canvas) {
      return;
    }

    const exportCanvas = () => {
      onLoadingChange(
        true,
        exportRequest.type === "image" ? "Exporting image…" : "Exporting JSON…",
      );

      const cropRect = cropRectRef.current;
      const activeObject = canvas.getActiveObject();
      const previousCropVisibility = cropRect?.visible ?? false;

      try {
        canvas.discardActiveObject();

        if (cropRect) {
          cropRect.set({ visible: false });
        }

        canvas.requestRenderAll();

        if (exportRequest.type === "image") {
          const dataUrl = canvas.toDataURL({
            format: "png",
            multiplier: 1,
          });

          const link = document.createElement("a");
          const baseName = imageFile?.name
            ? imageFile.name.replace(/\.[^/.]+$/, "")
            : "edited-image";

          link.href = dataUrl;
          link.download = `${baseName}-edited.png`;
          link.click();
          return;
        }

        const allAnnotations = canvas
          .getObjects()
          .filter((object: any) => isAnnotation(object));

        const annotationData = allAnnotations.map((object: any) =>
          object.toObject(["annotationType", "isTemporaryShape"]),
        );

        const drawingData = allAnnotations
          .filter((object: any) => object.get("annotationType") === "drawing")
          .map((object: any) =>
            object.toObject(["annotationType", "isTemporaryShape"]),
          );

        const shapeData = allAnnotations
          .filter((object: any) => {
            const type = object.get("annotationType");
            return type === "rectangle" || type === "circle";
          })
          .map((object: any) =>
            object.toObject(["annotationType", "isTemporaryShape"]),
          );

        const textData = allAnnotations
          .filter((object: any) => object.get("annotationType") === "text")
          .map((object: any) =>
            object.toObject(["annotationType", "isTemporaryShape"]),
          );

        const exportData = {
          editorVersion: 1,
          exportedAt: new Date().toISOString(),
          sourceImage: imageFile
            ? {
                name: imageFile.name,
                type: imageFile.type,
                size: imageFile.size,
              }
            : null,
          imageMetadata: imageRef.current
            ? {
                originalWidth: imageRef.current.get("width") || 0,
                originalHeight: imageRef.current.get("height") || 0,
                rotation: rotationRef.current,
                scaleX: imageRef.current.scaleX || 1,
                scaleY: imageRef.current.scaleY || 1,
                canvasWidth,
                canvasHeight,
              }
            : null,
          annotations: annotationData,
          drawingData,
          shapeData,
          textData,
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], {
          type: "application/json",
        });

        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        const baseName = imageFile?.name
          ? imageFile.name.replace(/\.[^/.]+$/, "")
          : "edited-image";

        link.href = url;
        link.download = `${baseName}-annotations.json`;
        link.click();
        URL.revokeObjectURL(url);
      } catch (error) {
        console.error("Failed to export:", error);
        onError(
          exportRequest.type === "image"
            ? "The edited image could not be exported."
            : "The JSON export could not be created.",
        );
      } finally {
        onLoadingChange(false);
        if (cropRect) {
          cropRect.set({
            visible: previousCropVisibility,
          });
        }

        if (activeObject) {
          canvas.setActiveObject(activeObject);
        }

        canvas.requestRenderAll();
      }
    };

    exportCanvas();
  }, [
    exportRequest,
    imageFile,
    canvasWidth,
    canvasHeight,
    fabricCanvasRef,
    onLoadingChange,
    onError,
  ]);

  /*
   * ============================================================
   * RENDER
   * ============================================================
   */

  return (
    <div className="canvas-editor">
      <div className="editor-canvas-wrapper">
        <canvas ref={canvasElementRef} />

        {imageFile && (
          <div className="canvas-help">
            {activeTool === "select" &&
              "Select and move annotations. Use the controls on the left to edit them."}

            {activeTool === "pencil" && "Draw freely on the image."}

            {activeTool === "rectangle" &&
              "Click and drag to draw a rectangle."}

            {activeTool === "circle" && "Click and drag to draw a circle."}

            {activeTool === "text" && "Click anywhere to add text."}

            {activeTool === "crop" &&
              "Move and resize the crop area, then double-click inside it to apply the crop."}
          </div>
        )}
      </div>
    </div>
  );
};

export default CanvasEditor;
