import type { ChangeEvent } from "react";
import type { AnnotationType, EditorTool } from "../types/editor";

interface ToolbarProps {
  activeTool: EditorTool;
  onToolChange: (tool: EditorTool) => void;
  onImageUpload: (file: File) => void;
  onClear: () => void;
  onRotate: (direction: "left" | "right") => void;
  hasImage: boolean;
  brushColor: string;
  brushWidth: number;
  textFontSize: number;
  textValue: string;
  selectedAnnotationType: AnnotationType | null;
  onBrushColorChange: (color: string) => void;
  onBrushWidthChange: (width: number) => void;
  onTextFontSizeChange: (size: number) => void;
  onTextValueChange: (value: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

const Toolbar = ({
  activeTool,
  onToolChange,
  onImageUpload,
  onClear,
  onRotate,
  hasImage,
  brushColor,
  brushWidth,
  textFontSize,
  textValue,
  selectedAnnotationType,
  onBrushColorChange,
  onBrushWidthChange,
  onTextFontSizeChange,
  onTextValueChange,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}: ToolbarProps) => {
  const tools: { id: EditorTool; label: string }[] = [
    { id: "select", label: "Select" },
    { id: "pencil", label: "Pencil" },
    { id: "rectangle", label: "Rectangle" },
    { id: "circle", label: "Circle" },
    { id: "text", label: "Text" },
    { id: "crop", label: "Crop" },
  ];

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      window.alert("Please select a valid image file.");
      event.target.value = "";
      return;
    }

    onImageUpload(file);
    event.target.value = "";
  };

  const handleBrushWidthChange = (event: ChangeEvent<HTMLInputElement>) => {
    onBrushWidthChange(Number(event.target.value));
  };

  const handleTextFontSizeChange = (event: ChangeEvent<HTMLInputElement>) => {
    onTextFontSizeChange(Number(event.target.value));
  };

  const handleTextChange = (event: ChangeEvent<HTMLInputElement>) => {
    onTextValueChange(event.target.value);
  };

  const creationToolHasProperties =
    activeTool === "pencil" ||
    activeTool === "rectangle" ||
    activeTool === "circle" ||
    activeTool === "text";

  const selectedObjectHasProperties =
    activeTool === "select" && selectedAnnotationType !== null;

  const showProperties =
    hasImage && (creationToolHasProperties || selectedObjectHasProperties);

  const isTextTarget =
    activeTool === "text" || selectedAnnotationType === "text";

  const propertiesTitle =
    activeTool === "select" ? "Selected Annotation" : "Properties";

  return (
    <aside className="toolbar">
      <div className="toolbar-section">
        <h2>Image</h2>

        <label className="upload-button">
          <span>Upload Image</span>
          <input type="file" accept="image/*" onChange={handleFileChange} />
        </label>
      </div>

      <div className="toolbar-section">
        <h2>History</h2>

        <div className="history-actions">
          <button
            type="button"
            className="rotate-button"
            onClick={onUndo}
            disabled={!canUndo}
          >
            ↶ Undo
          </button>

          <button
            type="button"
            className="rotate-button"
            onClick={onRedo}
            disabled={!canRedo}
          >
            ↷ Redo
          </button>
        </div>
      </div>

      <div className="toolbar-section">
        <h2>Tools</h2>

        <div className="tool-list">
          {tools.map((tool) => (
            <button
              key={tool.id}
              type="button"
              className={`tool-button ${
                activeTool === tool.id ? "active" : ""
              }`}
              onClick={() => onToolChange(tool.id)}
              disabled={!hasImage && tool.id !== "select"}
            >
              {tool.label}
            </button>
          ))}
        </div>
      </div>

      {hasImage && (
        <div className="toolbar-section">
          <h2>Rotate</h2>

          <div className="rotation-actions">
            <button
              type="button"
              className="rotate-button"
              onClick={() => onRotate("left")}
            >
              ↶ Rotate Left
            </button>

            <button
              type="button"
              className="rotate-button"
              onClick={() => onRotate("right")}
            >
              ↷ Rotate Right
            </button>
          </div>
        </div>
      )}

      {showProperties && (
        <div className="toolbar-section">
          <h2>{propertiesTitle}</h2>

          <div className="annotation-settings">
            <label className="setting-label">
              <span>Color</span>

              <div className="color-input-wrapper">
                <input
                  type="color"
                  value={brushColor}
                  onChange={(event) => onBrushColorChange(event.target.value)}
                  aria-label="Annotation color"
                />

                <span>{brushColor.toUpperCase()}</span>
              </div>
            </label>

            {isTextTarget && (
              <>
                <label className="setting-label">
                  <span>Text</span>

                  <input
                    className="text-value-input"
                    type="text"
                    value={textValue}
                    onChange={handleTextChange}
                    placeholder="Enter text"
                  />
                </label>

                <label className="setting-label">
                  <div className="setting-label-header">
                    <span>Font Size</span>
                    <span>{textFontSize}px</span>
                  </div>

                  <input
                    className="brush-size-input"
                    type="range"
                    min="10"
                    max="100"
                    step="1"
                    value={textFontSize}
                    onChange={handleTextFontSizeChange}
                  />
                </label>
              </>
            )}

            {!isTextTarget && (
              <label className="setting-label">
                <div className="setting-label-header">
                  <span>Thickness</span>
                  <span>{brushWidth}px</span>
                </div>

                <input
                  className="brush-size-input"
                  type="range"
                  min="1"
                  max="30"
                  step="1"
                  value={brushWidth}
                  onChange={handleBrushWidthChange}
                />
              </label>
            )}
          </div>
        </div>
      )}

      <div className="toolbar-section toolbar-bottom">
        <button
          type="button"
          className="clear-button"
          onClick={onClear}
          disabled={!hasImage}
        >
          Clear Canvas
        </button>
      </div>
    </aside>
  );
};

export default Toolbar;
