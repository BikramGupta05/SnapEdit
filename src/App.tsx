import CanvasEditor from "./components/CanvasEditor";
import Toolbar from "./components/Toolbar";

import { useEditor } from "./hooks/useEditor";

import "./App.css";

function App() {
  const editor = useEditor();

  return (
    <div className="app">
      <style>
        {`@keyframes image-editor-spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }`}
      </style>

      <header className="app-header">
        <div>
          <h1>Image Editor</h1>
          <p>Edit images, add annotations, and export your work.</p>
        </div>

        {editor.imageFile && (
          <div className="image-status">
            <span className="status-dot" />
            <span>{editor.imageFile.name}</span>
          </div>
        )}
      </header>

      <main className="editor-layout">
        <Toolbar
          activeTool={editor.activeTool}
          onToolChange={editor.handleToolChange}
          onImageUpload={editor.handleImageUpload}
          onClear={editor.handleClearCanvas}
          onRotate={editor.handleRotate}
          hasImage={Boolean(editor.imageFile)}
          brushColor={editor.brushColor}
          brushWidth={editor.brushWidth}
          textFontSize={editor.textFontSize}
          textValue={editor.textValue}
          selectedAnnotationType={editor.selectedType}
          onBrushColorChange={editor.setBrushColor}
          onBrushWidthChange={editor.setBrushWidth}
          onTextFontSizeChange={editor.setTextFontSize}
          onTextValueChange={editor.setTextValue}
          onUndo={editor.handleUndo}
          onRedo={editor.handleRedo}
          canUndo={editor.canUndo}
          canRedo={editor.canRedo}
          onExport={editor.handleExport}
          onZoom={editor.handleZoom}
          isBusy={editor.isBusy}
          onError={editor.handleEditorError}
        />

        <section className="workspace">
          <CanvasEditor
            imageFile={editor.imageFile}
            activeTool={editor.activeTool}
            brushColor={editor.brushColor}
            brushWidth={editor.brushWidth}
            textFontSize={editor.textFontSize}
            textValue={editor.textValue}
            rotationRequest={editor.rotationRequest}
            zoomRequest={editor.zoomRequest}
            historyRequest={editor.historyRequest}
            onHistoryStateChange={editor.handleHistoryStateChange}
            exportRequest={editor.exportRequest}
            onImageLoaded={editor.handleImageLoaded}
            onImageRotated={editor.handleImageRotated}
            onCropApplied={editor.handleCropApplied}
            onCropModeChange={editor.handleCropModeChange}
            onAnnotationSelected={editor.handleAnnotationSelected}
            onTextValueChange={editor.setTextValue}
            onLoadingChange={editor.handleEditorLoadingChange}
            onError={editor.handleEditorError}
          />

          {!editor.imageFile && (
            <div className="empty-state">
              <div className="empty-state-content">
                <h2>Start editing an image</h2>
                <p>Upload an image from your computer to begin.</p>
              </div>
            </div>
          )}

          {editor.errorMessage && (
            <div className="editor-error" role="alert">
              <div>
                <strong>Something went wrong</strong>
                <span>{editor.errorMessage}</span>
              </div>

              <button
                type="button"
                onClick={() => editor.setErrorMessage(null)}
                aria-label="Dismiss error"
              >
                ×
              </button>
            </div>
          )}

          {editor.isBusy && (
            <div className="editor-loading" role="status" aria-live="polite">
              <div className="loading-spinner" />
              <span>{editor.busyMessage || "Working…"}</span>
            </div>
          )}

          {editor.editorState.image && (
            <div className="image-info">
              <span>
                {editor.editorState.image.originalWidth} ×{" "}
                {editor.editorState.image.originalHeight} px
              </span>

              {editor.editorState.image.rotation !== 0 && (
                <span className="rotation-status">
                  Rotation: {editor.editorState.image.rotation}°
                </span>
              )}

              {editor.isCropping && (
                <span className="crop-status">Crop mode</span>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
