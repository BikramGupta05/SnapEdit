import { useCallback, useState } from "react";

import type {
  EditorState,
  EditorTool,
  ImageMetadata,
  SelectedAnnotation,
} from "../types/editor";

export interface HistoryRequest {
  id: number;
  direction: "undo" | "redo";
  snapshot: string;
}

export interface ExportRequest {
  id: number;
  type: "image" | "json";
}

export interface ZoomRequest {
  id: number;
  action: "in" | "out" | "reset";
}

export const useEditor = () => {
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

  const [isBusy, setIsBusy] = useState(false);
  const [busyMessage, setBusyMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleImageUpload = useCallback((file: File) => {
    setErrorMessage(null);
    setBusyMessage("Loading image…");
    setIsBusy(true);

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
  }, []);

  const handleImageLoaded = useCallback((metadata: ImageMetadata) => {
    setIsBusy(false);
    setBusyMessage("");
    setErrorMessage(null);

    setEditorState((currentState) => ({
      ...currentState,
      image: metadata,
    }));

    setSelectedAnnotation(null);
  }, []);

  const handleEditorLoadingChange = useCallback(
    (loading: boolean, message = "") => {
      setIsBusy(loading);
      setBusyMessage(message);
    },
    [],
  );

  const handleEditorError = useCallback((message: string) => {
    setIsBusy(false);
    setBusyMessage("");
    setErrorMessage(message);
  }, []);

  const handleRotate = useCallback(
    (direction: "left" | "right") => {
      if (!imageFile || isCropping || isBusy) {
        return;
      }

      setRotationRequest((currentRequest) => ({
        id: currentRequest.id + 1,
        direction,
      }));
    },
    [imageFile, isCropping, isBusy],
  );

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

  const handleToolChange = useCallback((tool: EditorTool) => {
    setActiveTool(tool);

    if (tool !== "select") {
      setSelectedAnnotation(null);
    }

    setEditorState((currentState) => ({
      ...currentState,
      tool,
    }));
  }, []);

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

  const handleUndo = useCallback(() => {
    setHistoryPast((currentPast) => {
      if (currentPast.length <= 1) {
        return currentPast;
      }

      const currentSnapshot = currentPast[currentPast.length - 1];
      const targetSnapshot = currentPast[currentPast.length - 2];

      setHistoryFuture((currentFuture) => [currentSnapshot, ...currentFuture]);

      setHistoryRequest((currentRequest) => ({
        id: currentRequest.id + 1,
        direction: "undo",
        snapshot: targetSnapshot,
      }));

      return currentPast.slice(0, -1);
    });
  }, []);

  const handleRedo = useCallback(() => {
    setHistoryFuture((currentFuture) => {
      if (currentFuture.length === 0) {
        return currentFuture;
      }

      const targetSnapshot = currentFuture[0];

      setHistoryPast((currentPast) => [...currentPast, targetSnapshot]);

      setHistoryRequest((currentRequest) => ({
        id: currentRequest.id + 1,
        direction: "redo",
        snapshot: targetSnapshot,
      }));

      return currentFuture.slice(1);
    });
  }, []);

  const handleExport = useCallback(
    (type: "image" | "json") => {
      if (!imageFile || isBusy) {
        return;
      }

      setErrorMessage(null);

      setExportRequest((currentRequest) => ({
        id: currentRequest.id + 1,
        type,
      }));
    },
    [imageFile, isBusy],
  );

  const handleClearCanvas = useCallback(() => {
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

    setIsBusy(false);
    setBusyMessage("");
    setErrorMessage(null);
  }, []);

  const handleZoom = useCallback(
    (action: ZoomRequest["action"]) => {
      if (!imageFile || isBusy) {
        return;
      }

      setZoomRequest((currentRequest) => ({
        id: currentRequest.id + 1,
        action,
      }));
    },
    [imageFile, isBusy],
  );

  const selectedType = selectedAnnotation?.type ?? null;

  const canUndo = Boolean(imageFile) && historyPast.length > 1;
  const canRedo = Boolean(imageFile) && historyFuture.length > 0;

  return {
    activeTool,
    imageFile,

    brushColor,
    brushWidth,
    textFontSize,
    textValue,

    selectedAnnotation,
    selectedType,

    editorState,
    isCropping,

    rotationRequest,
    historyRequest,
    exportRequest,
    zoomRequest,

    isBusy,
    busyMessage,
    errorMessage,

    canUndo,
    canRedo,

    setBrushColor,
    setBrushWidth,
    setTextFontSize,
    setTextValue,
    setErrorMessage,

    handleImageUpload,
    handleImageLoaded,
    handleEditorLoadingChange,
    handleEditorError,
    handleRotate,
    handleImageRotated,
    handleCropApplied,
    handleCropModeChange,
    handleToolChange,
    handleAnnotationSelected,
    handleHistoryStateChange,
    handleUndo,
    handleRedo,
    handleExport,
    handleClearCanvas,
    handleZoom,
  };
};
