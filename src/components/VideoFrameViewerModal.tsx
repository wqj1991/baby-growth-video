import { useState, useEffect, useRef } from 'react';
import { X, Check, RefreshCw, Eye, Plus, Minus } from 'lucide-react';
import type { Video, VideoFrame } from '../types';
import { getImageBase64 } from '../utils/tauriCommands';

interface VideoFrameViewerModalProps {
  visible: boolean;
  video: Video | null;
  frames: VideoFrame[];
  onClose: () => void;
  onReExtract: () => void;
  onToggleSelect: (frame: VideoFrame) => void;
  onSetFinal: (frame: VideoFrame) => void;
  onCancelFinal: () => void;
  onPreview: (frame: VideoFrame) => void;
}

export default function VideoFrameViewerModal({
  visible,
  video,
  frames,
  onClose,
  onReExtract,
  onToggleSelect,
  onSetFinal,
  onCancelFinal,
  onPreview,
}: VideoFrameViewerModalProps) {
  const [loadedImages, setLoadedImages] = useState<Record<number, string>>({});
  const loadedImageIds = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (!visible) return;
    
    setLoadedImages({});
    loadedImageIds.current.clear();
    
    const loadImages = async () => {
      const framesToLoad = frames.filter(f => !loadedImageIds.current.has(f.id));
      
      if (framesToLoad.length === 0) return;
      
      framesToLoad.forEach(f => loadedImageIds.current.add(f.id));
      
      const batchSize = 5;
      for (let i = 0; i < framesToLoad.length; i += batchSize) {
        const batch = framesToLoad.slice(i, i + batchSize);
        const results = await Promise.all(
          batch.map(async (frame) => {
            try {
              const base64 = await getImageBase64(frame.file_path);
              return { id: frame.id, url: base64 };
            } catch (error) {
              console.error('加载视频帧失败:', frame.id, error);
              loadedImageIds.current.delete(frame.id);
              return { id: frame.id, url: '' };
            }
          })
        );
        
        const newLoadedImages: Record<number, string> = {};
        results.forEach(({ id, url }) => {
          if (url) newLoadedImages[id] = url;
        });
        
        setLoadedImages(prev => ({ ...prev, ...newLoadedImages }));
      }
    };
    
    loadImages();
  }, [visible, frames]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (visible) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [visible, onClose]);

  const finalFrame = frames.find(f => f.is_final);
  const selectedCount = frames.filter(f => f.is_selected).length;

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-semibold">视频帧预览</h3>
          {video && (
            <span className="text-sm text-gray-500">
              {video.file_name} - {frames.length} 帧
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">
            已选择 {selectedCount} 帧
            {finalFrame && <span className="ml-2 text-green-600">· 已确认最终帧</span>}
          </span>
          <button
            onClick={onReExtract}
            className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            重新抽帧
          </button>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {frames.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <Eye className="w-16 h-16 mb-4 text-gray-300" />
            <p>暂无视频帧</p>
            <p className="text-sm mt-1">点击"重新抽帧"生成视频帧</p>
          </div>
        ) : (
          <div className="grid grid-cols-5 gap-3">
            {frames.map((frame) => (
              <div
                key={frame.id}
                className={`relative aspect-video rounded-lg overflow-hidden cursor-pointer transition-all ${
                  frame.is_selected ? 'ring-2 ring-primary-500' : ''
                } ${frame.is_final ? 'ring-2 ring-green-500' : ''} hover:shadow-md`}
                onClick={() => onToggleSelect(frame)}
              >
                <img
                  src={loadedImages[frame.id] || ''}
                  alt={`frame-${frame.id}`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                
                <div className="absolute inset-0 bg-black/0 hover:bg-black/20 transition-colors" />
                
                <div className="absolute top-1 left-1 flex items-center gap-1">
                  {frame.is_final && (
                    <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  )}
                  {frame.is_selected && !frame.is_final && (
                    <div className="w-6 h-6 rounded-full bg-primary-500 flex items-center justify-center">
                      <Plus className="w-4 h-4 text-white" />
                    </div>
                  )}
                </div>
                
                <div className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black/60 text-white text-xs font-mono rounded">
                  {Math.floor(frame.time_seconds / 60)}:{(frame.time_seconds % 60).toString().padStart(2, '0')}
                </div>
                
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 hover:opacity-100 transition-opacity">
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleSelect(frame);
                      }}
                      className="flex items-center gap-1 px-2 py-1 bg-white/20 hover:bg-white/30 text-white text-xs rounded"
                    >
                      {frame.is_selected ? <Minus className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                      {frame.is_selected ? '移除' : '加入待选'}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (frame.is_final) {
                          onCancelFinal();
                        } else {
                          onSetFinal(frame);
                        }
                      }}
                      className={`flex items-center gap-1 px-2 py-1 text-xs rounded ${
                        frame.is_final
                          ? 'bg-red-500/80 hover:bg-red-600 text-white'
                          : 'bg-green-500/80 hover:bg-green-600 text-white'
                      }`}
                    >
                      <Check className="w-3 h-3" />
                      {frame.is_final ? '取消最终' : '设为最终'}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onPreview(frame);
                      }}
                      className="flex items-center gap-1 px-2 py-1 bg-white/20 hover:bg-white/30 text-white text-xs rounded"
                    >
                      <Eye className="w-3 h-3" />
                      预览
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            提示：点击视频帧可加入/移除待选区，右键可查看更多操作
          </p>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
            >
              关闭
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}