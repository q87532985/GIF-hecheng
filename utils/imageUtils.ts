import { FrameData, AppMode, SpriteSheetConfig } from '../types';

declare const GIF: any;

const GIF_WORKER_URL = 'https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.worker.js';

export const readFileAsDataURL = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        resolve(e.target.result as string);
      } else {
        reject(new Error("Failed to read file"));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const loadImageData = (url: string, file: File): Promise<FrameData> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({
        id: Math.random().toString(36).substr(2, 9),
        url,
        file,
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
    };
    img.onerror = reject;
    img.src = url;
  });
};

const loadImageElement = (url: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = url;
    });
};

export const generateSpriteSheet = (frames: FrameData[], cols: number): string | null => {
  if (frames.length === 0) return null;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Assume all frames are roughly same size, use the max dimensions
  const maxWidth = Math.max(...frames.map(f => f.width));
  const maxHeight = Math.max(...frames.map(f => f.height));

  const rows = Math.ceil(frames.length / cols);
  
  canvas.width = maxWidth * cols;
  canvas.height = maxHeight * rows;

  frames.forEach((frame, index) => {
    const x = (index % cols) * maxWidth;
    const y = Math.floor(index / cols) * maxHeight;
    
    const img = new Image();
    img.src = frame.url;
    // Draw centered in the grid cell
    ctx.drawImage(img, 
      0, 0, frame.width, frame.height, 
      x + (maxWidth - frame.width) / 2, y + (maxHeight - frame.height) / 2, 
      frame.width, frame.height
    );
  });

  return canvas.toDataURL('image/png');
};

export const generateGif = async (
    mode: AppMode,
    frames: FrameData[],
    spriteConfig: SpriteSheetConfig,
    fps: number,
    backgroundColor: string,
    onProgress: (progress: number) => void
): Promise<Blob> => {
    // 1. Fetch worker to create a local blob URL (bypassing CORS for workers)
    const workerResponse = await fetch(GIF_WORKER_URL);
    const workerBlob = await workerResponse.blob();
    const workerUrl = URL.createObjectURL(workerBlob);

    // 2. Prepare images
    const images: HTMLImageElement[] = [];
    if (mode === AppMode.MULTI_IMAGE) {
        for (const frame of frames) {
            images.push(await loadImageElement(frame.url));
        }
    } else {
        if (spriteConfig.originalImage) {
            images.push(await loadImageElement(spriteConfig.originalImage.url));
        }
    }

    if (images.length === 0) throw new Error("No images to process");

    // 3. Determine Dimensions
    let width = 0;
    let height = 0;

    if (mode === AppMode.MULTI_IMAGE) {
        width = images[0].naturalWidth;
        height = images[0].naturalHeight;
    } else if (mode === AppMode.SPRITE_SHEET && spriteConfig.originalImage) {
        width = Math.floor(spriteConfig.originalImage.width / spriteConfig.cols);
        height = Math.floor(spriteConfig.originalImage.height / spriteConfig.rows);
    }

    // 4. Initialize GIF
    const gif = new GIF({
        workers: 2,
        quality: 10,
        width,
        height,
        workerScript: workerUrl,
        background: backgroundColor, // Note: gif.js handles hex codes usually, but transparent is default
        transparent: null // Set to null to use background color or specific hex if needed
    });

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error("Canvas context failed");

    const totalFramesToRender = mode === AppMode.MULTI_IMAGE 
        ? images.length 
        : spriteConfig.totalFrames;

    // 5. Draw Frames
    for (let i = 0; i < totalFramesToRender; i++) {
        // Clear with background color
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, width, height);

        if (mode === AppMode.MULTI_IMAGE) {
            const img = images[i];
            // Center image if dimensions differ
            const x = (width - img.naturalWidth) / 2;
            const y = (height - img.naturalHeight) / 2;
            ctx.drawImage(img, x, y);
        } else {
            const img = images[0];
            const { rows, cols } = spriteConfig;
            const frameW = width; // calculated above
            const frameH = height; // calculated above
            
            const col = i % cols;
            const row = Math.floor(i / cols);
            const sx = col * frameW;
            const sy = row * frameH;

            ctx.drawImage(img, sx, sy, frameW, frameH, 0, 0, frameW, frameH);
        }

        gif.addFrame(ctx, { copy: true, delay: 1000 / fps });
    }

    // 6. Render
    return new Promise((resolve, reject) => {
        gif.on('progress', (p: number) => {
            onProgress(p);
        });

        gif.on('finished', (blob: Blob) => {
            URL.revokeObjectURL(workerUrl); // Clean up
            resolve(blob);
        });

        gif.render();
    });
};

export const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const downloadDataUrl = (dataUrl: string, filename: string) => {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};