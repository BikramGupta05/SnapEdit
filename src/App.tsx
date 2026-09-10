import { useCallback, useState } from "react";

import CanvasEditor from "./components/CanvasEditor";
import Toolbar from "./components/Toolbar";

import type {
  AnnotationType,
  EditorState,
  EditorTool,
  ImageMetadata,
  SelectedAnnotation,
} from "./types/editor";

import "./App.css";

function App() {
  const [activeTool, setActiveTool] = useState<EditorTool>("select");

  const [imageFile, setImageFile] = useState<File | null>(null);

  const [brushColor, setBrushColor] = useState("#111827");

  const [brushWidth, setBrushWidth] = useState(4);

  const [textFontSize, setTextFontSize] = useState(28);

  const [textValue, setTextValue] = useState("");

  const [selectedAnnotation, setSelectedAnnotation] =
    useState<SelectedAnnotation | null>(null);

  const [editorState, setEditorState] = useState<EditorState>({
    tool: "select",
    image: null,
  });

  const [isCropping, setIsCropping] = useState(false);

  /*
   * Rotation request.
   *
   * The number changes every time
   * the user requests a rotation.
   *
   * CanvasEditor watches this value
   * and performs the actual rotation.
   */
  const [rotationRequest, setRotationRequest] = useState({
    id: 0,
    direction: "right" as "left" | "right",
  });

  /*
   * ============================================================
   * IMAGE UPLOAD
   * ============================================================
   */

  const handleImageUpload = (file: File) => {
    setImageFile(file);

    setActiveTool("select");

    setIsCropping(false);

    setSelectedAnnotation(null);

    setTextValue("");

    setRotationRequest({
      id: 0,
      direction: "right",
    });

    setEditorState({
      tool: "select",
      image: null,
    });
  };

  /*
   * ============================================================
   * IMAGE LOADED
   * ============================================================
   */

  const handleImageLoaded = useCallback((metadata: ImageMetadata) => {
    setEditorState((currentState) => ({
      ...currentState,
      image: metadata,
    }));

    setSelectedAnnotation(null);
  }, []);

  /*
   * ============================================================
   * ROTATION
   * ============================================================
   */

  const handleRotate = (direction: "left" | "right") => {
    if (!imageFile) {
      return;
    }

    setRotationRequest((currentRequest) => ({
      id: currentRequest.id + 1,

      direction,
    }));
  };

  /*
   * ============================================================
   * ROTATION METADATA
   * ============================================================
   */

  const handleImageRotated = useCallback(
    (rotation: number, scaleX: number, scaleY: number) => {
      setEditorState((currentState) => {
        if (!currentState.image) {
          return currentState;
        }

        return {
          ...currentState,

          image: {
            ...currentState.image,

            rotation,

            scaleX,

            scaleY,
          },
        };
      });
    },
    [],
  );

  /*
   * ============================================================
   * CROP
   * ============================================================
   */

  const handleCropApplied = useCallback((metadata: ImageMetadata) => {
    setEditorState((currentState) => ({
      ...currentState,
      image: metadata,
      tool: "select",
    }));

    setActiveTool("select");

    setIsCropping(false);
  }, []);

  const handleCropModeChange = useCallback((cropping: boolean) => {
    setIsCropping(cropping);

    if (cropping) {
      setSelectedAnnotation(null);
    }
  }, []);

  /*
   * ============================================================
   * TOOL CHANGE
   * ============================================================
   */

  const handleToolChange = (tool: EditorTool) => {
    setActiveTool(tool);

    if (tool !== "select") {
      setSelectedAnnotation(null);
    }

    setEditorState((currentState) => ({
      ...currentState,
      tool,
    }));
  };

  /*
   * ============================================================
   * ANNOTATION SELECTION
   * ============================================================
   */

  const handleAnnotationSelected = useCallback(
    (annotation: SelectedAnnotation | null) => {
      setSelectedAnnotation(annotation);

      if (!annotation) {
        return;
      }

      setBrushColor(annotation.color);

      setBrushWidth(annotation.width);

      setTextFontSize(annotation.fontSize);

      setTextValue(annotation.text);
    },
    [],
  );

  /*
   * ============================================================
   * TEXT VALUE
   * ============================================================
   */

  const handleTextValueChange = (value: string) => {
    setTextValue(value);
  };

  /*
   * ============================================================
   * CLEAR
   * ============================================================
   */

  const handleClearCanvas = () => {
    setImageFile(null);

    setIsCropping(false);

    setActiveTool("select");

    setSelectedAnnotation(null);

    setTextValue("");

    setRotationRequest({
      id: 0,
      direction: "right",
    });

    setEditorState({
      tool: "select",
      image: null,
    });
  };

  const selectedType: AnnotationType | null = selectedAnnotation?.type ?? null;

  return (
    <div className="app">
      {/* ======================================================
          HEADER
          ====================================================== */}

      <header className="app-header">
        <div>
          <h1>Image Editor</h1>

          <p>Edit images, add annotations, and export your work.</p>
        </div>

        {imageFile && (
          <div className="image-status">
            <span className="status-dot" />

            <span>{imageFile.name}</span>
          </div>
        )}
      </header>

      {/* ======================================================
          MAIN EDITOR
          ====================================================== */}

      <main className="editor-layout">
        <Toolbar
          activeTool={activeTool}
          onToolChange={handleToolChange}
          onImageUpload={handleImageUpload}
          onClear={handleClearCanvas}
          onRotate={handleRotate}
          hasImage={Boolean(imageFile)}
          brushColor={brushColor}
          brushWidth={brushWidth}
          textFontSize={textFontSize}
          textValue={textValue}
          selectedAnnotationType={selectedType}
          onBrushColorChange={setBrushColor}
          onBrushWidthChange={setBrushWidth}
          onTextFontSizeChange={setTextFontSize}
          onTextValueChange={handleTextValueChange}
        />

        <section className="workspace">
          <CanvasEditor
            imageFile={imageFile}
            activeTool={activeTool}
            brushColor={brushColor}
            brushWidth={brushWidth}
            textFontSize={textFontSize}
            textValue={textValue}
            rotationRequest={rotationRequest}
            onImageLoaded={handleImageLoaded}
            onImageRotated={handleImageRotated}
            onCropApplied={handleCropApplied}
            onCropModeChange={handleCropModeChange}
            onAnnotationSelected={handleAnnotationSelected}
          />

          {!imageFile && (
            <div className="empty-state">
              <div className="empty-state-content">
                <h2>Start editing an image</h2>

                <p>Upload an image from your computer to begin.</p>
              </div>
            </div>
          )}

          {editorState.image && (
            <div className="image-info">
              <span>
                {editorState.image.originalWidth} ×{" "}
                {editorState.image.originalHeight} px
              </span>

              {editorState.image.rotation !== 0 && (
                <span className="rotation-status">
                  Rotation: {editorState.image.rotation}°
                </span>
              )}

              {isCropping && <span className="crop-status">Crop mode</span>}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
