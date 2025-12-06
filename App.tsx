import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Play, Pause, Download, Trash2, Settings, 
  ZoomIn, ZoomOut, Image as ImageIcon, Layers, 
  RefreshCw, FileImage, Grid, Clock, SkipForward,
  Loader2, CheckCircle
} from 'lucide-react';
import { Dropzone } from './components/Dropzone';
import { CanvasPlayer } from './components/CanvasPlayer';
import { loadImageData, generateSpriteSheet, downloadDataUrl, readFileAsDataURL, generateGif, downloadBlob } from './utils/imageUtils';
import { AppMode, FrameData, SpriteSheetConfig } from './types';

function App() {
  const [mode, setMode] = useState<AppMode>(AppMode.MULTI_IMAGE);
  
  // Data State
  const [frames, setFrames] = useState<FrameData[]>([]);
  const [spriteConfig, setSpriteConfig] = useState<SpriteSheetConfig>({
    rows: 1,
    cols: 1,
    totalFrames: 1,
    originalImage: null
  });

  // Player State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [fps, setFps] = useState(8);
  const [scale, setScale] = useState(1);
  const [backgroundColor, setBackgroundColor] = useState('#2d3748'); // gray-750

  // Export State
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  // Refs for loop
  const timerRef = useRef<number | null>(null);

  // Computed total frames based on mode
  const totalPlayableFrames = mode === AppMode.MULTI_IMAGE 
    ? frames.length 
    : spriteConfig.totalFrames;

  // Animation Loop
  useEffect(() => {
    if (isPlaying && totalPlayableFrames > 0) {
      timerRef.current = window.setInterval(() => {
        setCurrentFrameIndex((prev) => (prev + 1) % totalPlayableFrames);
      }, 1000 / fps);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, fps, totalPlayableFrames]);

  // Reset index when mode changes or data changes
  useEffect(() => {
    setCurrentFrameIndex(0);
    setIsPlaying(false);
  }, [mode, frames.length, spriteConfig.originalImage]);

  // Helper for wheel input on sliders
  const handleWheelChange = (
    e: React.WheelEvent<HTMLInputElement>,
    currentValue: number,
    setter: (val: number) => void,
    min: number,
    max: number,
    step: number = 1
  ) => {
    // Scroll up (negative delta) increases value, scroll down decreases
    const delta = e.deltaY > 0 ? -step : step;
    // Calculate new value
    let newValue = currentValue + delta;
    
    // Clamp
    newValue = Math.min(Math.max(newValue, min), max);
    
    // Handle floating point precision issues for step < 1
    const precision = step.toString().split('.')[1]?.length || 0;
    const rounded = Number(newValue.toFixed(precision));

    if (rounded !== currentValue) {
      setter(rounded);
    }
  };

  // File Handlers
  const handleFilesDropped = async (files: File[]) => {
    if (mode === AppMode.MULTI_IMAGE) {
      const newFrames: FrameData[] = [];
      for (const file of files) {
        const url = await readFileAsDataURL(file);
        const frameData = await loadImageData(url, file);
        newFrames.push(frameData);
      }
      setFrames((prev) => [...prev, ...newFrames]);
    } else {
      // Sprite Sheet Mode - Only take first file
      const file = files[0];
      const url = await readFileAsDataURL(file);
      const frameData = await loadImageData(url, file);
      
      setSpriteConfig({
        rows: 1,
        cols: 1,
        totalFrames: 1,
        originalImage: frameData
      });
    }
  };

  const handleDeleteFrame = (index: number) => {
    setFrames(prev => prev.filter((_, i) => i !== index));
  };

  const handleExportGif = async () => {
    if (totalPlayableFrames === 0) return;
    
    try {
      setIsExporting(true);
      setExportProgress(0);
      setIsPlaying(false);

      const blob = await generateGif(
        mode,
        frames,
        spriteConfig,
        fps,
        backgroundColor,
        (progress) => setExportProgress(Math.round(progress * 100))
      );

      downloadBlob(blob, 'animation.gif');
    } catch (error) {
      console.error("Export failed", error);
      alert("GIF导出失败，请重试");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-white font-sans">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-gray-900 border-b border-gray-800 shrink-0">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <FileImage className="w-6 h-6 text-blue-500" />
          GIF序列帧合成器
        </h1>
        
        <div className="flex bg-gray-800 rounded-lg p-1">
          <button 
             className={`px-4 py-1.5 rounded-md text-sm transition-colors ${mode === AppMode.MULTI_IMAGE ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}
             onClick={() => setMode(AppMode.MULTI_IMAGE)}
          >
            多图合成
          </button>
          <button 
             className={`px-4 py-1.5 rounded-md text-sm transition-colors ${mode === AppMode.SPRITE_SHEET ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}
             onClick={() => setMode(AppMode.SPRITE_SHEET)}
          >
            雪碧图切分
          </button>
        </div>

        <button
          onClick={handleExportGif}
          disabled={isExporting || totalPlayableFrames === 0}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors font-medium text-sm"
        >
          {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          {isExporting ? `导出中 ${exportProgress}%` : '导出GIF'}
        </button>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside className="w-80 bg-gray-900 border-r border-gray-800 p-6 flex flex-col gap-6 overflow-y-auto z-10 shrink-0">
          
          {/* Mode Specific Inputs */}
          {mode === AppMode.MULTI_IMAGE ? (
            <div className="space-y-4">
              <Dropzone onFilesDropped={handleFilesDropped} multiple={true} label="添加序列帧图片" />
              
              {frames.length > 0 && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-sm text-gray-400">
                    <span>已加载帧 ({frames.length})</span>
                    <button onClick={() => setFrames([])} className="text-red-400 hover:text-red-300 text-xs flex items-center gap-1">
                      <Trash2 className="w-3 h-3" /> 清空
                    </button>
                  </div>
                  <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto p-2 bg-gray-950 rounded border border-gray-800 custom-scrollbar">
                    {frames.map((frame, idx) => (
                      <div key={frame.id} className="relative group aspect-square bg-gray-900 rounded overflow-hidden border border-gray-800">
                        <img src={frame.url} className="w-full h-full object-cover" alt={`frame-${idx}`} />
                        <button 
                          onClick={() => handleDeleteFrame(idx)}
                          className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-red-400 transition-opacity"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <div className="absolute bottom-0 left-0 bg-black/60 text-[10px] px-1 text-white">{idx + 1}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <Dropzone onFilesDropped={handleFilesDropped} multiple={false} label="上传雪碧图/拼合图" />
              
              {spriteConfig.originalImage && (
                 <div className="p-3 bg-gray-800 rounded-lg space-y-4 border border-gray-700">
                    <div className="grid grid-cols-2 gap-3">
                       <div>
                          <label className="text-xs text-gray-400 mb-1 block">行数 (Rows)</label>
                          <input 
                              type="number" 
                              min="1" 
                              value={spriteConfig.rows}
                              onChange={(e) => setSpriteConfig(prev => ({...prev, rows: Math.max(1, parseInt(e.target.value) || 1)}))}
                              className="w-full bg-gray-950 border border-gray-700 rounded px-2 py-1.5 text-sm focus:border-blue-500 outline-none transition-colors"
                          />
                       </div>
                       <div>
                          <label className="text-xs text-gray-400 mb-1 block">列数 (Cols)</label>
                          <input 
                              type="number" 
                              min="1" 
                              value={spriteConfig.cols}
                              onChange={(e) => setSpriteConfig(prev => ({...prev, cols: Math.max(1, parseInt(e.target.value) || 1)}))}
                              className="w-full bg-gray-950 border border-gray-700 rounded px-2 py-1.5 text-sm focus:border-blue-500 outline-none transition-colors"
                          />
                       </div>
                    </div>
                    
                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <label className="text-xs text-gray-400">总帧数</label>
                            <span className="text-xs text-gray-300 bg-gray-700 px-1.5 rounded">{spriteConfig.totalFrames}</span>
                        </div>
                        <input 
                            type="range"
                            min="1"
                            max={spriteConfig.rows * spriteConfig.cols}
                            value={spriteConfig.totalFrames}
                            onChange={(e) => setSpriteConfig(prev => ({...prev, totalFrames: parseInt(e.target.value)}))}
                            onWheel={(e) => handleWheelChange(e, spriteConfig.totalFrames, (val) => setSpriteConfig(prev => ({...prev, totalFrames: val})), 1, spriteConfig.rows * spriteConfig.cols)}
                            className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                        />
                    </div>
                 </div> 
              )}
            </div>
          )}

          <div className="h-px bg-gray-800 my-2"></div>

          {/* Global Settings */}
          <div className="space-y-6">
            {/* Scale Slider */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
                  <ZoomIn className="w-4 h-4 text-gray-400" />
                  画布缩放
                </label>
                <span className="text-xs bg-gray-800 px-2 py-0.5 rounded text-gray-400">{Math.round(scale * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="3"
                step="0.1"
                value={scale}
                onChange={(e) => setScale(parseFloat(e.target.value))}
                onWheel={(e) => handleWheelChange(e, scale, setScale, 0.1, 3, 0.1)}
                className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
            </div>

            {/* FPS Slider */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
                  <Clock className="w-4 h-4 text-gray-400" />
                  帧率 (FPS)
                </label>
                <span className="text-xs bg-gray-800 px-2 py-0.5 rounded text-gray-400">{fps}</span>
              </div>
              <input
                type="range"
                min="1"
                max="60"
                value={fps}
                onChange={(e) => setFps(parseInt(e.target.value))}
                onWheel={(e) => handleWheelChange(e, fps, setFps, 1, 60)}
                className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
            </div>

            {/* Background Color */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
                <Layers className="w-4 h-4 text-gray-400" />
                背景颜色
              </label>
              <div className="flex gap-2">
                {['#2d3748', '#ffffff', '#000000', '#00ff00'].map(c => (
                  <button
                    key={c}
                    onClick={() => setBackgroundColor(c)}
                    className={`w-8 h-8 rounded-full border-2 ${backgroundColor === c ? 'border-blue-500 scale-110' : 'border-transparent hover:border-gray-500'} transition-all`}
                    style={{ backgroundColor: c }}
                    title={c}
                  />
                ))}
                <div className="relative w-8 h-8 rounded-full overflow-hidden border-2 border-gray-600 hover:border-gray-400 transition-colors">
                    <input 
                        type="color"
                        value={backgroundColor}
                        onChange={(e) => setBackgroundColor(e.target.value)}
                        className="absolute inset-[-4px] w-[150%] h-[150%] cursor-pointer p-0 border-0"
                    />
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Canvas Area */}
        <div className="flex-1 bg-black/20 relative flex flex-col min-w-0">
          <div className="flex-1 overflow-auto flex items-center justify-center p-8 bg-[radial-gradient(#374151_1px,transparent_1px)] [background-size:16px_16px]">
            {totalPlayableFrames > 0 ? (
              <CanvasPlayer
                mode={mode}
                frames={frames}
                spriteConfig={spriteConfig}
                currentFrameIndex={currentFrameIndex}
                scale={scale}
                backgroundColor={backgroundColor}
              />
            ) : (
              <div className="text-center text-gray-500">
                <ImageIcon className="w-16 h-16 mx-auto mb-4 opacity-20" />
                <p>请在左侧添加图片素材</p>
              </div>
            )}
          </div>

          {/* Bottom Timeline Controls */}
           {totalPlayableFrames > 0 && (
            <div className="h-16 bg-gray-900 border-t border-gray-800 px-6 flex items-center gap-4 shrink-0 z-20">
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-blue-600 hover:bg-blue-500 text-white transition-colors shadow-lg"
              >
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-1" />}
              </button>

              <div className="flex-1 flex flex-col justify-center gap-1">
                 <div className="flex justify-between text-xs text-gray-400 px-1">
                  <span>当前帧: {currentFrameIndex + 1}</span>
                  <span>总帧数: {totalPlayableFrames}</span>
                 </div>
                 <input
                  type="range"
                  min="0"
                  max={totalPlayableFrames - 1}
                  value={currentFrameIndex}
                  onChange={(e) => {
                    setIsPlaying(false);
                    setCurrentFrameIndex(parseInt(e.target.value));
                  }}
                  onWheel={(e) => handleWheelChange(e, currentFrameIndex, setCurrentFrameIndex, 0, totalPlayableFrames - 1)}
                  className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500 hover:accent-blue-400"
                />
              </div>
            </div>
           )}
        </div>
      </div>
    </div>
  );
}

export default App;