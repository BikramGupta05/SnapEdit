import { Canvas, FabricImage } from "fabric";

interface ExportEditorDataOptions {
  canvas: Canvas;
  imageFile: File | null;
  image: FabricImage | null;
  rotation: number;
  canvasWidth: number;
  canvasHeight: number;
}

const isAnnotationObject = (object: any) => {
  const annotationType = object.get?.("annotationType");

  return (
    annotationType === "drawing" ||
    annotationType === "rectangle" ||
    annotationType === "circle" ||
    annotationType === "text"
  );
};

const serializeAnnotation = (object: any) =>
  object.toObject(["annotationType", "isTemporaryShape"]);

export const buildEditorExportData = ({
  canvas,
  imageFile,
  image,
  rotation,
  canvasWidth,
  canvasHeight,
}: ExportEditorDataOptions) => {
  const allAnnotations = canvas
    .getObjects()
    .filter((object) => isAnnotationObject(object));

  const annotations = allAnnotations.map(serializeAnnotation);

  const drawingData = allAnnotations
    .filter((object) => object.get("annotationType") === "drawing")
    .map(serializeAnnotation);

  const shapeData = allAnnotations
    .filter((object) => {
      const annotationType = object.get("annotationType");

      return annotationType === "rectangle" || annotationType === "circle";
    })
    .map(serializeAnnotation);

  const textData = allAnnotations
    .filter((object) => object.get("annotationType") === "text")
    .map(serializeAnnotation);

  return {
    editorVersion: 1,
    exportedAt: new Date().toISOString(),
    sourceImage: imageFile
      ? {
          name: imageFile.name,
          type: imageFile.type,
          size: imageFile.size,
        }
      : null,
    imageMetadata: image
      ? {
          originalWidth: image.get("width") || 0,
          originalHeight: image.get("height") || 0,
          rotation,
          scaleX: image.scaleX || 1,
          scaleY: image.scaleY || 1,
          canvasWidth,
          canvasHeight,
        }
      : null,
    annotations,
    drawingData,
    shapeData,
    textData,
  };
};
