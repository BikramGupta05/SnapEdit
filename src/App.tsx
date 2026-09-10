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

  const handleImageUpload = (file: File) => {
    setImageFile(file);

    setActiveTool("select");

    setIsCropping(false);

    setSelectedAnnotation(null);

    setTextValue("");

    setEditorState({
      tool: "select",
      image: null,
    });
  };

  const handleImageLoaded = useCallback((metadata: ImageMetadata) => {
    setEditorState((currentState) => ({
      ...currentState,
      image: metadata,
    }));

    setSelectedAnnotation(null);
  }, []);

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

  const handleTextValueChange = (value: string) => {
    setTextValue(value);
  };

  const handleClearCanvas = () => {
    setImageFile(null);

    setIsCropping(false);

    setActiveTool("select");

    setSelectedAnnotation(null);

    setTextValue("");

    setEditorState({
      tool: "select",
      image: null,
    });
  };

  const selectedType: AnnotationType | null = selectedAnnotation?.type ?? null;

  return (
    <div className="app">
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

      <main className="editor-layout">
        <Toolbar
          activeTool={activeTool}
          onToolChange={handleToolChange}
          onImageUpload={handleImageUpload}
          onClear={handleClearCanvas}
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
            onImageLoaded={handleImageLoaded}
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

              {isCropping && <span className="crop-status">Crop mode</span>}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
