import { useState, useEffect, useRef } from 'react';
import { X, Check, RefreshCw, Eye, Plus } from 'lucide-react';
import type { Video, VideoFrame } from '../types';
import { getImageBase64 } from '../utils/tauriCommands';

interface VideoFrameViewerModalProps {
  visible: boolean;
  video: Video | null;
  frames: VideoFrame[];
  onClose: () => void;
  onReExtract: () => void;
  onPreview: (frame: VideoFrame) => void;
  onAddSingle: (frame: VideoFrame) => void;
  onConfirmSelection: (frames: VideoFrame[]) => void;
}

export default function VideoFrameViewerModal({
  visible,
  video,
  frames,
  onClose,
  onReExtract,
  onPreview,
  onAddSingle,
  onConfirmSelection,
}: VideoFrameViewerModalProps) {
  const [loadedImages, setLoadedImages] = useState<Record<number, string>>({});
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
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

  useEffect(() => {
    if (visible) {
      setSelectedIds(new Set());
    }
  }, [visible, frames]);

  const toggleSelect = (frameId: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(frameId)) {
        next.delete(frameId);
      } else {
        next.add(frameId);
      }
      return next;
    });
  };

  const handleConfirm = () => {
    const selectedFrames = frames.filter(f => selectedIds.has(f.id));
    onConfirmSelection(selectedFrames);
  };

  const finalFrame = frames.find(f => f.is_final);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      <div className="flex items-center justify-between p-4 border-b border-stone-200">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-semibold">选择视频帧</h3>
          {video && (
            <span className="text-sm text-stone-500">
              {video.file_name} - {frames.length} 帧
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-stone-500">
            已选择 {selectedIds.size} 帧
            {finalFrame && <span className="ml-2 text-success-text">· 已确认最终帧</span>}
          </span>
          <button
            onClick={onReExtract}
            className="flex items-center gap-1 px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-100 rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            重新抽帧
          </button>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-stone-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-stone-500" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {frames.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-stone-500">
            <Eye className="w-16 h-16 mb-4 text-stone-300" />
            <p>暂无视频帧</p>
            <p className="text-sm mt-1">点击"重新抽帧"生成视频帧</p>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-3">
            {frames.map((frame) => {
              const imageUrl = loadedImages[frame.id];
              const isSelected = selectedIds.has(frame.id);
              
              return (
                <div
                  key={frame.id}
                  className={`relative aspect-video rounded-lg overflow-hidden cursor-pointer transition-all ${
                    isSelected ? 'ring-2 ring-stash-600' : ''
                  } ${frame.is_final ? 'ring-2 ring-green-500' : ''} hover:shadow-md`}
                  onDoubleClick={() => onPreview(frame)}
                >
                  <img
                    src={imageUrl || ''}
                    alt={`frame-${frame.id}`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  
                  <button
                    className={`absolute top-1 left-1 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                      isSelected 
                        ? 'bg-stash-600 border-stash-600' 
                        : 'bg-white/80 border-stone-300 hover:border-stash-600'
                    }`}
                    onClick={(e) => { e.stopPropagation(); toggleSelect(frame.id); }}
                  >
                    {isSelected && <Check className="w-3 h-3 text-white" />}
                  </button>

                  <button
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-success flex items-center justify-center hover:bg-success/80 transition-colors"
                    onClick={(e) => { e.stopPropagation(); onAddSingle(frame); }}
                  >
                    <Plus className="w-3 h-3 text-white" />
                  </button>
                  
                  <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[10px] px-2 py-1 text-center">
                    {Math.floor(frame.time_seconds / 60)}:{((frame.time_seconds % 60)).toString().padStart(2, '0')}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="p-4 border-t border-stone-200 bg-stone-50">
        <div className="flex items-center justify-between">
          <p className="text-sm text-stone-500">
            提示：双击预览帧，勾选后可批量加入待选区
          </p>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-stone-700 hover:bg-stone-200 rounded-lg transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleConfirm}
              disabled={selectedIds.size === 0}
              className="px-4 py-2 bg-stash-600 text-white rounded-lg hover:bg-stash-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              加入待选区 ({selectedIds.size})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}