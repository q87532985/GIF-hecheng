import React, { useCallback } from 'react';
import { Upload, FileImage } from 'lucide-react';

interface DropzoneProps {
  onFilesDropped: (files: File[]) => void;
  multiple: boolean;
  label: string;
}

export const Dropzone: React.FC<DropzoneProps> = ({ onFilesDropped, multiple, label }) => {
  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const files = Array.from(e.dataTransfer.files).filter((file) =>
        file.type.startsWith('image/')
      );
      if (files.length > 0) {
        onFilesDropped(files);
      }
    },
    [onFilesDropped]
  );

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files).filter((file) =>
        file.type.startsWith('image/')
      );
      if (files.length > 0) {
        onFilesDropped(files);
      }
    }
  };

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      className="group relative flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-600 rounded-lg hover:border-blue-500 hover:bg-gray-800 transition-all cursor-pointer"
    >
      <input
        type="file"
        multiple={multiple}
        accept="image/*"
        onChange={handleChange}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      />
      <div className="flex flex-col items-center justify-center pt-5 pb-6">
        <Upload className="w-8 h-8 mb-2 text-gray-400 group-hover:text-blue-400" />
        <p className="mb-1 text-sm text-gray-400 group-hover:text-blue-100">
          <span className="font-semibold">点击上传</span> 或拖拽图片到此处
        </p>
        <p className="text-xs text-gray-500">{label}</p>
      </div>
    </div>
  );
};