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
      setExportProgress(0);
    }
  };

  const handleExportSprite = () => {
    if (mode === AppMode.MULTI_IMAGE) {
      if (frames.length === 0) return;
      const cols = Math.ceil(Math.sqrt(frames.length));
      const dataUrl = generateSpriteSheet(frames, cols);
      if (dataUrl) downloadDataUrl(dataUrl, 'sprite-sheet.png');
    } else {
      if (spriteConfig.originalImage) {
        downloadDataUrl(spriteConfig.originalImage.url, 'sprite-sheet-export.png');
      }
    }
  };

  // Sprite Config Handlers
  const handleGridChange = (key: 'rows' | 'cols', value: number) => {
    const newVal = Math.max(1, value);
    setSpriteConfig(prev => {
      const newTotal = newVal * (key === 'rows' ? prev.cols : prev.rows);
      return {
        ...prev,
        [key]: newVal,
        totalFrames: newTotal // Reset total frames to max on grid change
      };
    });
  };

  return (
    <div className="flex h-screen bg-gray-950 text-gray-100 overflow-hidden font-sans">
      
      {/* Sidebar Controls */}
      <div className="w-80 flex flex-col border-r border-gray-800 bg-gray-900 overflow-y-auto custom-scrollbar z-10 shrink-0">
        <div className="p-6 border-b border-gray-800">
          <h1 className="text-xl font-bold flex items-center gap-2 text-blue-400">
            <Layers className="w-6 h-6" />
            序列合成器
          </h1>
          <p className="text-xs text-gray-500 mt-1">GIF/Sprite Sheet 工具</p>
        </div>

        {/* Mode Switcher */}
        <div className="p-4 grid grid-cols-2 gap-2">
          <button
            onClick={() => setMode(AppMode.MULTI_IMAGE)}
            className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-all ${
              mode === AppMode.MULTI_IMAGE 
                ? 'bg-blue-600/20 border-blue-500 text-blue-400' 
                : 'bg-gray-800 border-gray-700 hover:bg-gray-750 text-gray-400'
            }`}
          >
            <ImageIcon className="w-5 h-5 mb-1" />
            <span className="text-xs font-medium">多图合成</span>
          </button>
          <button
            onClick={() => setMode(AppMode.SPRITE_SHEET)}
            className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-all ${
              mode === AppMode.SPRITE_SHEET 
                ? 'bg-blue-600/20 border-blue-500 text-blue-400' 
                : 'bg-gray-800 border-gray-700 hover:bg-gray-750 text-gray-400'
            }`}
          >
            <Grid className="w-5 h-5 mb-1" />
            <span className="text-xs font-medium">序列切割</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 px-4 space-y-6 pb-6">
          
          {/* Upload Section */}
          <section>
            <h2 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wider">资源上传</h2>
            <Dropzone 
              onFilesDropped={handleFilesDropped} 
              multiple={mode === AppMode.MULTI_IMAGE} 
              label={mode === AppMode.MULTI_IMAGE ? "支持多张PNG/JPG" : "上传单张序列图"}
            />
          </section>

          {/* Sprite Settings (Only in Sprite Mode) */}
          {mode === AppMode.SPRITE_SHEET && spriteConfig.originalImage && (
            <section className="bg-gray-800/50 p-4 rounded-lg border border-gray-700/50 space-y-4">
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                <Settings className="w-4 h-4" /> 切割设置
              </h2>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">行数 (Rows)</label>
                  <input 
                    type="number" 
                    min="1" 
                    value={spriteConfig.rows}
                    onChange={(e) => handleGridChange('rows', parseInt(e.target.value) || 1)}
                    className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">列数 (Cols)</label>
                  <input 
                    type="number" 
                    min="1" 
                    value={spriteConfig.cols}
                    onChange={(e) => handleGridChange('cols', parseInt(e.target.value) || 1)}
                    className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm focus:border-blue-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <label className="text-xs text-gray-500">有效帧数</label>
                  <span className="text-xs text-blue-400 font-mono">{spriteConfig.totalFrames}</span>
                </div>
                <input 
                  type="range"
                  min="1"
                  max={spriteConfig.rows * spriteConfig.cols}
                  value={spriteConfig.totalFrames}
                  onChange={(e) => setSpriteConfig(prev => ({ ...prev, totalFrames: parseInt(e.target.value) }))}
                  className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
                <div className="flex justify-between text-[10px] text-gray-600 mt-1">
                  <span>1</span>
                  <span>{spriteConfig.rows * spriteConfig.cols}</span>
                </div>
              </div>
            </section>
          )}

          {/* Frame List (Only in Multi Mode) */}
          {mode === AppMode.MULTI_IMAGE && frames.length > 0 && (
            <section className="space-y-2">
               <div className="flex justify-between items-center">
                <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">帧列表 ({frames.length})</h2>
                <button onClick={() => setFrames([])} className="text-xs text-red-400 hover:text-red-300">清空</button>
               </div>
               <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto pr-1">
                 {frames.map((frame, idx) => (
                   <div key={frame.id} className="relative group aspect-square bg-gray-800 rounded border border-gray-700 overflow-hidden">
                     <img src={frame.url} alt="frame" className="w-full h-full object-cover" />
                     <button 
                      onClick={() => handleDeleteFrame(idx)}
                      className="absolute inset-0 bg-black/60 hidden group-hover:flex items-center justify-center text-red-400"
                     >
                       <Trash2 className="w-4 h-4" />
                     </button>
                     <div className="absolute bottom-0 right-0 bg-black/70 text-[10px] px-1 text-gray-300">
                       {idx + 1}
                     </div>
                   </div>
                 ))}
               </div>
            </section>
          )}

          {/* Animation Controls */}
          <section className="space-y-4 pt-4 border-t border-gray-800">
             <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
               <Clock className="w-4 h-4" /> 动画控制
             </h2>

             {/* FPS Control */}
             <div>
                <div className="flex justify-between mb-1">
                  <label className="text-xs text-gray-500">播放速度 (FPS)</label>
                  <span className="text-xs text-blue-400 font-mono">{fps} fps</span>
                </div>
                <input 
                  type="range" min="1" max="60" value={fps}
                  onChange={(e) => setFps(parseInt(e.target.value))}
                  className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
             </div>

             {/* Playback Buttons */}
             <div className="flex gap-2">
               <button 
                onClick={() => setIsPlaying(!isPlaying)}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md font-medium text-sm transition-colors ${
                  isPlaying 
                    ? 'bg-yellow-600/20 text-yellow-500 border border-yellow-600/50 hover:bg-yellow-600/30' 
                    : 'bg-green-600/20 text-green-500 border border-green-600/50 hover:bg-green-600/30'
                }`}
               >
                 {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                 {isPlaying ? '暂停' : '播放'}
               </button>
               <button 
                onClick={() => setCurrentFrameIndex((prev) => (prev + 1) % totalPlayableFrames)}
                className="px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-md border border-gray-700 text-gray-400"
                disabled={totalPlayableFrames === 0}
               >
                 <SkipForward className="w-4 h-4" />
               </button>
             </div>
          </section>

          {/* Export */}
          <section className="pt-4 border-t border-gray-800 space-y-2">
            <button 
              onClick={handleExportGif}
              disabled={totalPlayableFrames === 0 || isExporting}
              className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium shadow-lg shadow-blue-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {isExporting ? `导出中 ${exportProgress}%` : '导出 GIF 动画'}
            </button>
            
            <button 
              onClick={handleExportSprite}
              disabled={totalPlayableFrames === 0 || isExporting}
              className="w-full flex items-center justify-center gap-2 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm border border-gray-700 disabled:opacity-50 transition-all"
            >
              <FileImage className="w-4 h-4" />
              导出序列拼图 (PNG)
            </button>
          </section>

        </div>
      </div>

      {/* Main Viewport */}
      <div className="flex-1 flex flex-col bg-gray-950 relative overflow-hidden">
        {/* Top Toolbar */}
        <div className="h-14 border-b border-gray-800 bg-gray-900/50 flex items-center justify-between px-6 backdrop-blur-sm z-10 shrink-0">
          <div className="flex items-center gap-4">
             <div className="flex items-center gap-2 text-sm text-gray-400 bg-gray-800 px-3 py-1.5 rounded-full border border-gray-700">
                <span>当前帧:</span>
                <span className="font-mono text-white">{currentFrameIndex + 1} / {totalPlayableFrames}</span>
             </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Scale Control */}
            <div className="flex items-center gap-2 bg-gray-800 px-3 py-1.5 rounded-full border border-gray-700">
               <button onClick={() => setScale(s => Math.max(0.1, s - 0.5))} className="text-gray-400 hover:text-white"><ZoomOut className="w-4 h-4"/></button>
               <span className="w-12 text-center text-xs font-mono">{scale.toFixed(1)}x</span>
               <button onClick={() => setScale(s => Math.min(10, s + 0.5))} className="text-gray-400 hover:text-white"><ZoomIn className="w-4 h-4"/></button>
            </div>

            {/* Color Picker */}
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500">背景</label>
              <div className="w-8 h-8 rounded-full overflow-hidden border border-gray-600 cursor-pointer relative">
                <input 
                  type="color" 
                  value={backgroundColor} 
                  onChange={(e) => setBackgroundColor(e.target.value)}
                  className="absolute inset-0 w-[150%] h-[150%] -top-1/4 -left-1/4 p-0 cursor-pointer border-none" 
                />
              </div>
            </div>
          </div>
        </div>

        {/* Canvas Area */}
        {/* Changed: flex + m-auto allows centering when small but scrolling when large */}
        <div className="flex-1 overflow-auto flex bg-[url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAMUlEQVQ4T2nk5+d/YgYCQJpBf6z8kY/0D4b///+jY/0D4b///+jY/0D4b///+jY/0D4b/wEAGXwI50z0m74AAAAASUVORK5CYII=')]">
           <div className="m-auto p-12">
              <CanvasPlayer 
                mode={mode}
                frames={frames}
                spriteConfig={spriteConfig}
                currentFrameIndex={currentFrameIndex}
                scale={scale}
                backgroundColor={backgroundColor}
              />
              
              {/* Empty State Overlay */}
              {totalPlayableFrames === 0 && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center text-gray-500 bg-gray-900/90 backdrop-blur-sm pointer-events-none">
                   <FileImage className="w-12 h-12 mb-2 opacity-50" />
                   <p className="text-sm">暂无帧数据</p>
                   <p className="text-xs opacity-60">请在左侧上传图片</p>
                </div>
              )}
           </div>
        </div>

        {/* Timeline Scrubber */}
        <div className="h-12 bg-gray-900 border-t border-gray-800 px-6 flex items-center shrink-0">
           <input 
             type="range"
             min="0"
             max={Math.max(0, totalPlayableFrames - 1)}
             value={currentFrameIndex}
             onChange={(e) => {
               setIsPlaying(false);
               setCurrentFrameIndex(parseInt(e.target.value));
             }}
             disabled={totalPlayableFrames === 0}
             className="w-full h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-blue-500 hover:accent-blue-400"
           />
        </div>
        
        {/* Export Progress Overlay */}
        {isExporting && (
          <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center">
            <div className="bg-gray-800 border border-gray-700 p-6 rounded-xl shadow-2xl max-w-sm w-full text-center">
              <Loader2 className="w-10 h-10 text-blue-500 animate-spin mx-auto mb-4" />
              <h3 className="text-lg font-bold text-white mb-2">正在合成 GIF...</h3>
              <p className="text-gray-400 text-sm mb-4">请稍候，正在渲染每一帧</p>
              
              <div className="w-full bg-gray-900 rounded-full h-2.5 mb-2 overflow-hidden">
                <div 
                  className="bg-blue-500 h-2.5 rounded-full transition-all duration-200" 
                  style={{ width: `${exportProgress}%` }}
                ></div>
              </div>
              <p className="text-right text-xs text-blue-400 font-mono">{exportProgress}%</p>
            </div>
          </div>
        )}

      </div>

    </div>
  );
}

export default App;