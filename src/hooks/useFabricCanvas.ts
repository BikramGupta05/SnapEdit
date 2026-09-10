import { useEffect, useRef } from "react";
import { Canvas } from "fabric";

const CANVAS_WIDTH = 900;
const CANVAS_HEIGHT = 600;

export const useFabricCanvas = () => {
  const canvasElementRef = useRef<HTMLCanvasElement | null>(null);

  const fabricCanvasRef = useRef<Canvas | null>(null);

  useEffect(() => {
    if (!canvasElementRef.current) {
      return;
    }

    const canvas = new Canvas(canvasElementRef.current, {
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,

      backgroundColor: "#ffffff",

      preserveObjectStacking: true,

      selection: true,
    });

    fabricCanvasRef.current = canvas;

    return () => {
      canvas.dispose();

      fabricCanvasRef.current = null;
    };
  }, []);

  return {
    canvasElementRef,

    fabricCanvasRef,

    canvasWidth: CANVAS_WIDTH,

    canvasHeight: CANVAS_HEIGHT,
  };
};
