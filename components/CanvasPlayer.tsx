import React, { useEffect, useRef, useState } from 'react';
import { FrameData, SpriteSheetConfig, AppMode } from '../types';

interface CanvasPlayerProps {
  mode: AppMode;
  frames: FrameData[];
  spriteConfig: SpriteSheetConfig;
  currentFrameIndex: number;
  scale: number;
  backgroundColor: string;
}

export const CanvasPlayer: React.FC<CanvasPlayerProps> = ({
  mode,
  frames,
  spriteConfig,
  currentFrameIndex,
  scale,
  backgroundColor,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [imageObj, setImageObj] = useState<HTMLImageElement | null>(null);

  // Load the sprite sheet image into memory when it changes
  useEffect(() => {
    if (mode === AppMode.SPRITE_SHEET && spriteConfig.originalImage) {
      const img = new Image();
      img.src = spriteConfig.originalImage.url;
      img.onload = () => setImageObj(img);
    } else {
      setImageObj(null);
    }
  }, [mode, spriteConfig.originalImage]);

  const getFrameImage = (url: string): Promise<HTMLImageElement> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = url;
      if (img.complete) {
        resolve(img);
      } else {
        img.onload = () => resolve(img);
      }
    });
  };

  // Calculate Base Dimensions (Resolution)
  let baseWidth = 0;
  let baseHeight = 0;
  let hasContent = false;

  if (mode === AppMode.MULTI_IMAGE) {
    if (frames.length > 0) {
      const frame = frames[currentFrameIndex % frames.length];
      if (frame) {
        baseWidth = frame.width;
        baseHeight = frame.height;
        hasContent = true;
      }
    }
  } else if (mode === AppMode.SPRITE_SHEET && spriteConfig.originalImage) {
    const { rows, cols } = spriteConfig;
    baseWidth = Math.floor(spriteConfig.originalImage.width / cols);
    baseHeight = Math.floor(spriteConfig.originalImage.height / rows);
    hasContent = true;
  }

  // Fallback dimensions for empty state
  if (!hasContent) {
    baseWidth = 300;
    baseHeight = 300;
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // We rely on React prop updates to set canvas.width/height, 
    // which clears the canvas. We just need to draw.

    const draw = async () => {
      // Clear specifically if needed, though resizing does it.
      ctx.clearRect(0, 0, baseWidth, baseHeight);

      if (mode === AppMode.MULTI_IMAGE) {
        if (frames.length === 0) return;
        
        const frame = frames[currentFrameIndex % frames.length];
        if (!frame) return;

        const img = await getFrameImage(frame.url);
        ctx.drawImage(img, 0, 0);

      } else if (mode === AppMode.SPRITE_SHEET) {
        if (!spriteConfig.originalImage || !imageObj) return;

        const { rows, cols } = spriteConfig;
        
        // Ensure we calculate based on the source image dimensions
        const frameW = Math.floor(spriteConfig.originalImage.width / cols);
        const frameH = Math.floor(spriteConfig.originalImage.height / rows);

        const safeIndex = currentFrameIndex; 
        const col = safeIndex % cols;
        const row = Math.floor(safeIndex / cols);

        const sx = col * frameW;
        const sy = row * frameH;

        ctx.drawImage(
            imageObj, 
            sx, sy, frameW, frameH, 
            0, 0, frameW, frameH
        );
      }
    };

    draw();

  }, [mode, frames, spriteConfig, currentFrameIndex, imageObj, baseWidth, baseHeight]);

  return (
    <div 
      className="inline-block p-4 border border-gray-800 rounded-lg shadow-xl"
      style={{ backgroundColor: backgroundColor }}
    >
      <canvas
        ref={canvasRef}
        width={baseWidth}
        height={baseHeight}
        style={{
          width: `${baseWidth * scale}px`,
          height: `${baseHeight * scale}px`,
          imageRendering: 'pixelated', // Keeps pixel art crisp when scaled up
          display: 'block'
        }}
      />
    </div>
  );
};