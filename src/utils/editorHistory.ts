import { Canvas, FabricImage, Rect } from "fabric";

export interface EditorHistorySnapshot {
  canvas: Record<string, unknown>;
  rotation: number;
  baseImageScale: number;
}

export const buildHistorySnapshot = (
  canvas: Canvas,
  rotation: number,
  baseImageScale: number,
): string => {
  const snapshot: EditorHistorySnapshot = {
    canvas: canvas.toObject(["annotationType", "isTemporaryShape"]),
    rotation,
    baseImageScale,
  };

  return JSON.stringify(snapshot);
};

interface RestoreHistoryOptions {
  activeTool: string;
  isAnnotation: (object: any) => boolean;
  onAnnotationSelected: (annotation: any) => void;
  onImageRotated: (rotation: number, scaleX: number, scaleY: number) => void;
}

export const restoreHistorySnapshot = async (
  canvas: Canvas,
  snapshot: string,
  options: RestoreHistoryOptions,
): Promise<{
  image: FabricImage | null;
  crop: Rect | null;
  rotation: number;
  baseImageScale: number;
}> => {
  const payload = JSON.parse(snapshot) as EditorHistorySnapshot;

  await canvas.loadFromJSON(payload.canvas);

  const objects = canvas.getObjects();

  const restoredImage = objects.find(
    (object: any) => object.type === "image",
  ) as FabricImage | undefined;

  const restoredCrop = objects.find(
    (object: any) => object.get("annotationType") === "crop",
  ) as Rect | undefined;

  const rotation = Number(payload.rotation) || 0;
  const baseImageScale = Number(payload.baseImageScale) || 1;

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
        selectable: options.activeTool === "crop",
        evented: options.activeTool === "crop",
      });
      object.setCoords();
      return;
    }

    if (options.isAnnotation(object)) {
      object.set({
        selectable: options.activeTool === "select",
        evented: options.activeTool === "select",
      });
    }

    object.setCoords();
  });

  canvas.discardActiveObject();
  canvas.requestRenderAll();

  options.onAnnotationSelected(null);

  if (restoredImage) {
    options.onImageRotated(
      rotation,
      restoredImage.scaleX || 1,
      restoredImage.scaleY || 1,
    );
  }

  return {
    image: restoredImage || null,
    crop: restoredCrop || null,
    rotation,
    baseImageScale,
  };
};
