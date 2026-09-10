import { useEffect, useRef } from "react";
import { Circle, FabricImage, IText, PencilBrush, Rect } from "fabric";
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

  onImageLoaded: (metadata: ImageMetadata) => void;

  onCropApplied: (metadata: ImageMetadata) => void;

  onCropModeChange: (cropping: boolean) => void;

  onAnnotationSelected: (annotation: SelectedAnnotation | null) => void;
}

const CanvasEditor = ({
  imageFile,
  activeTool,

  brushColor,
  brushWidth,

  textFontSize,
  textValue,

  onImageLoaded,
  onCropApplied,
  onCropModeChange,
  onAnnotationSelected,
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

  useEffect(() => {
    textValueRef.current = textValue;
  }, [textValue]);

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

      canvas.clipPath = undefined;

      imageRef.current = null;

      cropRectRef.current = null;

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
      try {
        const image = await FabricImage.fromURL(objectUrl, {
          crossOrigin: "anonymous",
        });

        canvas.clear();

        canvas.backgroundColor = "#ffffff";

        canvas.clipPath = undefined;

        imageRef.current = image;

        cropRectRef.current = null;

        const originalWidth = image.width || 1;

        const originalHeight = image.height || 1;

        /*
         * Fit the image inside the
         * 900 x 600 canvas without
         * changing its aspect ratio.
         */
        const scale = Math.min(
          canvasWidth / originalWidth,
          canvasHeight / originalHeight,
        );

        const displayedWidth = originalWidth * scale;

        const displayedHeight = originalHeight * scale;

        /*
         * IMPORTANT:
         *
         * The image uses top-left
         * coordinates.
         */
        image.set({
          originX: "left",
          originY: "top",

          left: (canvasWidth - displayedWidth) / 2,

          top: (canvasHeight - displayedHeight) / 2,

          scaleX: scale,
          scaleY: scale,

          angle: 0,

          selectable: false,
          evented: false,
        });

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
      } catch (error) {
        console.error("Failed to load image:", error);
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
  ]);

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

    canvas.getObjects().forEach((object) => {
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

      const annotationType = object.get("annotationType") as string | undefined;

      if (
        annotationType === "drawing" ||
        annotationType === "rectangle" ||
        annotationType === "circle" ||
        annotationType === "text"
      ) {
        object.set({
          selectable: activeTool === "select",

          evented: activeTool === "select",
        });
      }
    });

    if (activeTool !== "select") {
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
        .find((object) => object.get("isTemporaryShape") === true);

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
        .find((object) => object.get("isTemporaryShape") === true);

      if (temporaryShape) {
        temporaryShape.set({
          isTemporaryShape: false,

          selectable: false,

          evented: false,
        });

        canvas.requestRenderAll();
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
     * Image bounds.
     */
    const imageLeft = image.left || 0;

    const imageTop = image.top || 0;

    const imageWidth = image.getScaledWidth();

    const imageHeight = image.getScaledHeight();

    /*
     * Initial crop selection:
     * 70% of image dimensions,
     * centered exactly on image.
     */
    const cropWidth = imageWidth * 0.7;

    const cropHeight = imageHeight * 0.7;

    const cropLeft = imageLeft + (imageWidth - cropWidth) / 2;

    const cropTop = imageTop + (imageHeight - cropHeight) / 2;

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

      hasRotatingPoint: false,

      lockRotation: true,

      annotationType: "crop",
    });

    cropRectRef.current = cropRect;

    canvas.add(cropRect);

    canvas.bringObjectToFront(cropRect);

    canvas.setActiveObject(cropRect);

    canvas.requestRenderAll();

    /*
     * Keep crop inside image.
     */
    const constrainCrop = () => {
      const currentCrop = cropRectRef.current;

      const currentImage = imageRef.current;

      if (!currentCrop || !currentImage) {
        return;
      }

      const imageLeft = currentImage.left || 0;

      const imageTop = currentImage.top || 0;

      const imageWidth = currentImage.getScaledWidth();

      const imageHeight = currentImage.getScaledHeight();

      let currentWidth = currentCrop.getScaledWidth();

      let currentHeight = currentCrop.getScaledHeight();

      /*
       * Don't allow crop selection
       * to become larger than image.
       */
      if (currentWidth > imageWidth) {
        currentCrop.scaleX = imageWidth / Math.max(currentCrop.width || 1, 1);

        currentWidth = currentCrop.getScaledWidth();
      }

      if (currentHeight > imageHeight) {
        currentCrop.scaleY = imageHeight / Math.max(currentCrop.height || 1, 1);

        currentHeight = currentCrop.getScaledHeight();
      }

      let left = currentCrop.left || 0;

      let top = currentCrop.top || 0;

      left = Math.max(
        imageLeft,
        Math.min(left, imageLeft + imageWidth - currentWidth),
      );

      top = Math.max(
        imageTop,
        Math.min(top, imageTop + imageHeight - currentHeight),
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

      try {
        cropRect.setCoords();

        const imageElement = image.getElement() as
          | HTMLImageElement
          | HTMLCanvasElement;

        const naturalWidth =
          imageElement instanceof HTMLImageElement
            ? imageElement.naturalWidth
            : imageElement.width;

        const naturalHeight =
          imageElement instanceof HTMLImageElement
            ? imageElement.naturalHeight
            : imageElement.height;

        const imageScaleX = image.scaleX || 1;

        const imageScaleY = image.scaleY || 1;

        const imageLeft = image.left || 0;

        const imageTop = image.top || 0;

        const cropLeft = cropRect.left || 0;

        const cropTop = cropRect.top || 0;

        const cropDisplayWidth = cropRect.getScaledWidth();

        const cropDisplayHeight = cropRect.getScaledHeight();

        /*
         * Convert canvas coordinates
         * to source image pixels.
         */
        const sourceLeft = (cropLeft - imageLeft) / imageScaleX;

        const sourceTop = (cropTop - imageTop) / imageScaleY;

        const sourceWidth = cropDisplayWidth / imageScaleX;

        const sourceHeight = cropDisplayHeight / imageScaleY;

        /*
         * Clamp source rectangle.
         */
        const finalLeft = Math.max(0, Math.min(sourceLeft, naturalWidth - 1));

        const finalTop = Math.max(0, Math.min(sourceTop, naturalHeight - 1));

        const finalWidth = Math.min(sourceWidth, naturalWidth - finalLeft);

        const finalHeight = Math.min(sourceHeight, naturalHeight - finalTop);

        if (finalWidth <= 1 || finalHeight <= 1) {
          return;
        }

        /*
         * Output bitmap has exactly
         * the same aspect ratio as
         * selected source region.
         */
        const outputWidth = Math.max(1, Math.round(finalWidth));

        const outputHeight = Math.max(1, Math.round(finalHeight));

        const offscreenCanvas = document.createElement("canvas");

        offscreenCanvas.width = outputWidth;

        offscreenCanvas.height = outputHeight;

        const context = offscreenCanvas.getContext("2d");

        if (!context) {
          return;
        }

        context.drawImage(
          imageElement,

          finalLeft,
          finalTop,

          finalWidth,
          finalHeight,

          0,
          0,

          outputWidth,
          outputHeight,
        );

        const croppedDataUrl = offscreenCanvas.toDataURL("image/png");

        const croppedImage = await FabricImage.fromURL(croppedDataUrl);

        /*
         * Preserve annotations.
         */
        const annotations = canvas
          .getObjects()
          .filter((object) => object !== image && object !== cropRect);

        /*
         * Remove old image.
         */
        canvas.remove(image);

        /*
         * Remove crop selection.
         */
        canvas.remove(cropRect);

        imageRef.current = croppedImage;

        cropRectRef.current = null;

        /*
         * The selected crop area
         * becomes the displayed image.
         *
         * The scale is based on
         * the actual output bitmap.
         */
        const newScale = Math.min(
          cropDisplayWidth / outputWidth,
          cropDisplayHeight / outputHeight,
        );

        croppedImage.set({
          originX: "left",
          originY: "top",

          left: cropLeft,
          top: cropTop,

          scaleX: newScale,
          scaleY: newScale,

          angle: 0,

          selectable: false,
          evented: false,
        });

        canvas.add(croppedImage);

        canvas.sendObjectToBack(croppedImage);

        /*
         * Restore annotations.
         */
        annotations.forEach((object) => {
          object.set({
            selectable: true,
            evented: true,
          });

          object.setCoords();
        });

        /*
         * Clip everything to the
         * selected crop region.
         */
        const clipRect = new Rect({
          originX: "left",
          originY: "top",

          left: cropLeft,
          top: cropTop,

          width: outputWidth,

          height: outputHeight,

          scaleX: newScale,
          scaleY: newScale,

          absolutePositioned: true,
        });

        canvas.clipPath = clipRect;

        canvas.discardActiveObject();

        canvas.requestRenderAll();

        onCropApplied({
          originalWidth: outputWidth,

          originalHeight: outputHeight,

          rotation: 0,

          scaleX: newScale,
          scaleY: newScale,
        });

        onAnnotationSelected(null);
      } catch (error) {
        console.error("Failed to crop image:", error);
      } finally {
        isApplyingCropRef.current = false;
      }
    };

    canvas.on("mouse:dblclick", handleDoubleClick);

    return () => {
      canvas.off("mouse:dblclick", handleDoubleClick);
    };
  }, [activeTool, fabricCanvasRef, onCropApplied, onAnnotationSelected]);

  return (
    <div className="canvas-editor">
      {/* 
        IMPORTANT:
        This wrapper MUST NOT be called
        "canvas-container".

        Fabric.js creates its own
        ".canvas-container" internally.
      */}
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
