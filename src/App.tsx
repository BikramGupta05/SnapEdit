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

interface HistoryRequest {
  id: number;
  direction: "undo" | "redo";
  snapshot: string;
}

interface ExportRequest {
  id: number;
  type: "image" | "json";
}

interface ZoomRequest {
  id: number;
  action: "in" | "out" | "reset";
}

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

  const [rotationRequest, setRotationRequest] = useState({
    id: 0,
    direction: "right" as "left" | "right",
  });

  const [historyRequest, setHistoryRequest] = useState<HistoryRequest>({
    id: 0,
    direction: "undo",
    snapshot: "",
  });

  const [historyPast, setHistoryPast] = useState<string[]>([]);
  const [historyFuture, setHistoryFuture] = useState<string[]>([]);

  const [exportRequest, setExportRequest] = useState<ExportRequest>({
    id: 0,
    type: "image",
  });

  const [zoomRequest, setZoomRequest] = useState<ZoomRequest>({
    id: 0,
    action: "reset",
  });

  const handleImageUpload = (file: File) => {
    setImageFile(file);
    setActiveTool("select");
    setIsCropping(false);
    setSelectedAnnotation(null);
    setTextValue("");
    setRotationRequest({ id: 0, direction: "right" });

    setEditorState({
      tool: "select",
      image: null,
    });

    setHistoryPast([]);
    setHistoryFuture([]);
    setHistoryRequest({
      id: 0,
      direction: "undo",
      snapshot: "",
    });
    setExportRequest({
      id: 0,
      type: "image",
    });
    setZoomRequest({
      id: 0,
      action: "reset",
    });
  };

  const handleImageLoaded = useCallback((metadata: ImageMetadata) => {
    setEditorState((currentState) => ({
      ...currentState,
      image: metadata,
    }));
    setSelectedAnnotation(null);
  }, []);

  const handleRotate = (direction: "left" | "right") => {
    if (!imageFile || isCropping) {
      return;
    }

    setRotationRequest((currentRequest) => ({
      id: currentRequest.id + 1,
      direction,
    }));
  };

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

  const handleHistoryStateChange = useCallback((snapshot: string) => {
    setHistoryPast((currentPast) => {
      if (currentPast[currentPast.length - 1] === snapshot) {
        return currentPast;
      }

      if (currentPast.length === 0) {
        return [snapshot];
      }

      return [...currentPast, snapshot];
    });

    setHistoryFuture([]);
  }, []);

  const handleUndo = () => {
    if (historyPast.length <= 1) {
      return;
    }

    const currentSnapshot = historyPast[historyPast.length - 1];
    const targetSnapshot = historyPast[historyPast.length - 2];

    setHistoryPast((currentPast) => currentPast.slice(0, -1));
    setHistoryFuture((currentFuture) => [currentSnapshot, ...currentFuture]);

    setHistoryRequest((currentRequest) => ({
      id: currentRequest.id + 1,
      direction: "undo",
      snapshot: targetSnapshot,
    }));
  };

  const handleRedo = () => {
    if (historyFuture.length === 0) {
      return;
    }

    const targetSnapshot = historyFuture[0];
    const currentSnapshot = historyPast[historyPast.length - 1];

    setHistoryPast((currentPast) => [...currentPast, targetSnapshot]);
    setHistoryFuture((currentFuture) => currentFuture.slice(1));

    setHistoryRequest((currentRequest) => ({
      id: currentRequest.id + 1,
      direction: "redo",
      snapshot: targetSnapshot,
    }));

    void currentSnapshot;
  };

  const handleExport = (type: "image" | "json") => {
    if (!imageFile) {
      return;
    }

    setExportRequest((currentRequest) => ({
      id: currentRequest.id + 1,
      type,
    }));
  };

  const handleClearCanvas = () => {
    setImageFile(null);
    setIsCropping(false);
    setActiveTool("select");
    setSelectedAnnotation(null);
    setTextValue("");
    setRotationRequest({ id: 0, direction: "right" });
    setEditorState({ tool: "select", image: null });
    setHistoryPast([]);
    setHistoryFuture([]);
    setHistoryRequest({
      id: 0,
      direction: "undo",
      snapshot: "",
    });
    setExportRequest({
      id: 0,
      type: "image",
    });
    setZoomRequest((currentRequest) => ({
      id: currentRequest.id + 1,
      action: "reset",
    }));
  };

  const handleZoom = (action: ZoomRequest["action"]) => {
    if (!imageFile) {
      return;
    }

    setZoomRequest((currentRequest) => ({
      id: currentRequest.id + 1,
      action,
    }));
  };

  const selectedType: AnnotationType | null = selectedAnnotation?.type ?? null;

  const canUndo = Boolean(imageFile) && historyPast.length > 1;
  const canRedo = Boolean(imageFile) && historyFuture.length > 0;

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
          onTextValueChange={setTextValue}
          onUndo={handleUndo}
          onRedo={handleRedo}
          canUndo={canUndo}
          canRedo={canRedo}
          onExport={handleExport}
          onZoom={handleZoom}
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
            zoomRequest={zoomRequest}
            historyRequest={historyRequest}
            onHistoryStateChange={handleHistoryStateChange}
            exportRequest={exportRequest}
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
