export type EditorTool =
  | "select"
  | "pencil"
  | "rectangle"
  | "circle"
  | "text"
  | "crop";

export type AnnotationType = "drawing" | "rectangle" | "circle" | "text";

export interface ImageMetadata {
  originalWidth: number;
  originalHeight: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
}

export interface SelectedAnnotation {
  type: AnnotationType;

  color: string;

  width: number;

  fontSize: number;

  text: string;
}

export interface EditorState {
  tool: EditorTool;

  image: ImageMetadata | null;
}
