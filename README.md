# SnapEdit

**SnapEdit — Simple Image Editing & Annotation**

SnapEdit is a lightweight image editor application built with React, TypeScript, and Fabric.js.

It allows users to upload an image, crop and rotate it, add annotations, undo and redo changes, and export both the edited image and structured editor data as JSON.

---

## Features

### Image Upload

- Upload an image from your local device.
- Load the selected image onto the Fabric.js canvas.
- Maintain image metadata for export.

### Crop

- Select the **Crop** tool.
- Create a selectable crop area on the image.
- Apply the crop to update the image.
- Clip annotations appropriately after cropping.

### Annotations

SnapEdit supports the following annotation tools:

- Select
- Pencil / Freehand Drawing
- Rectangle
- Circle
- Text

#### Pencil / Freehand Drawing

- Draw freely over the image.
- Configure drawing color.
- Configure brush thickness.

#### Rectangle

- Create rectangle annotations.
- Configure stroke color.
- Configure stroke thickness.

#### Circle

- Create circle annotations.
- Configure stroke color.
- Configure stroke thickness.

#### Text

- Add text annotations.
- Each new text annotation starts with an empty text box.
- Type directly into the text box.
- Edit existing text directly on the canvas.
- Configure text color.
- Configure font size.

### Rotate

- Rotate the image using the rotation controls.
- Maintain rotation as part of the editor state.
- Include rotation information in the exported JSON.

### Undo / Redo

SnapEdit provides:

- Undo
- Redo

The history system tracks image edits and annotation changes so previous editor states can be restored.

### Export

#### Export Edited Image

Export the current edited canvas as an image.

#### Export JSON

Export structured JSON containing:

- Annotation data
- Drawing data
- Image metadata
- Source image information
- Canvas information
- Rotation
- Image scale

---

## Bonus Features

### Zoom

- Zoom in
- Zoom out
- Reset zoom to 100%
- Cursor-based zoom
- Ctrl/Cmd + mouse wheel zoom

Zoom is handled through the Fabric.js viewport and does not create unnecessary history states.

### Modular Architecture

SnapEdit uses a modular architecture that separates:

- UI components
- Editor state
- Fabric.js canvas operations
- History management
- Export logic
- Shared TypeScript types

### Loading and Error Handling

The application provides feedback for:

- Invalid image files
- Image loading failures
- Crop failures
- Export failures
- Loading operations

### Responsive UX

The interface adapts to different screen sizes, including:

- Desktop
- Laptop
- Tablet
- Mobile

---

## Tech Stack

- **React**
- **TypeScript**
- **Fabric.js**
- **Vite**
- **CSS**

---

## Project Structure

```text
src/
├── components/
│   ├── CanvasEditor.tsx
│   └── Toolbar.tsx
│
├── hooks/
│   ├── useFabricCanvas.ts
│   └── useEditor.ts
│
├── utils/
│   ├── editorHistory.ts
│   └── exportEditorData.ts
│
├── types/
│   └── editor.ts
│
├── App.tsx
├── App.css
├── index.css
└── main.tsx
```
