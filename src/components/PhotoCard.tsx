import { useState, useEffect } from 'react';
import { Plus, Check, X, Camera } from 'lucide-react';
import { getImageBase64 } from '../utils/tauriCommands';
import type { Photo } from '../types';

interface PhotoCardProps {
  photo: Photo;
  imageUrl?: string;
  onDoubleClick?: (photo: Photo) => void;
  onToggleSelect?: (photo: Photo) => void;
  onSetFinal?: (photo: Photo) => void;
  onCancelFinal?: (photo: Photo) => void;
  isInPending?: boolean;
  isFinal?: boolean;
  onClick?: () => void;
  onSelect?: (photo: Photo) => void;
  onAddToStash?: (photo: Photo) => void;
}

export default function PhotoCard({
  photo,
  imageUrl,
  onDoubleClick,
  onToggleSelect,
  onSetFinal,
  onCancelFinal,
  isInPending = photo.is_selected,
  isFinal = photo.is_final,
  onClick,
  onSelect,
  onAddToStash,
}: PhotoCardProps) {
  const [loadedUrl, setLoadedUrl] = useState<string>('');
  const actualToggleSelect = onToggleSelect ?? onAddToStash;
  const actualSetFinal = onSetFinal ?? onSelect;

  // 优先使用缩略图路径，未生成缩略图时回退到原图
  useEffect(() => {
    let cancelled = false;
    const imagePath = photo.thumbnail_path || photo.file_path;
    if (!imagePath) {
      setLoadedUrl('');
      return;
    }
    getImageBase64(imagePath)
      .then((url) => { if (!cancelled) setLoadedUrl(url); })
      .catch(() => { if (!cancelled) setLoadedUrl(imageUrl || ''); });
    return () => { cancelled = true; };
  }, [photo.thumbnail_path, photo.file_path, imageUrl]);

  const displayUrl = loadedUrl || imageUrl || '';

  return (
    <div
      className={`photo-card relative group ${isFinal ? 'ring-2 ring-success' : ''}`}
      onDoubleClick={() => onDoubleClick?.(photo)}
      onClick={onClick}
    >
      <div className="photo-thumb" style={{ aspectRatio: '4/3' }}>
        {displayUrl ? (
          <img src={displayUrl} alt={photo.file_name} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-stone-100 to-stone-200">
            <Camera className="w-6 h-6 text-stone-300" />
          </div>
        )}
      </div>

      <div className={`photo-actions absolute top-1.5 left-1.5 right-1.5 flex flex-col gap-1 transition-opacity ${isFinal ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
        {/* 待选区操作：只在非 final 状态显示（final 后聚焦「取消最终」，减少视觉噪音） */}
        {!isFinal && (
          <>
            {!isInPending ? (
              <button
                className="photo-action-btn bg-black/60 hover:bg-black/80 text-white text-xs px-2 py-1 rounded"
                onClick={(e) => { e.stopPropagation(); actualToggleSelect?.(photo); }}
              >
                <Plus className="w-3 h-3 inline mr-1" />
                加入待选区
              </button>
            ) : (
              <button
                className="photo-action-btn bg-black/60 hover:bg-black/80 text-white text-xs px-2 py-1 rounded"
                onClick={(e) => { e.stopPropagation(); actualToggleSelect?.(photo); }}
              >
                <X className="w-3 h-3 inline mr-1" />
                从待选区取消
              </button>
            )}
            <button
              className="photo-action-btn bg-success hover:bg-success-dark text-white text-xs px-2 py-1 rounded font-medium"
              onClick={(e) => { e.stopPropagation(); actualSetFinal?.(photo); }}
            >
              <Check className="w-3 h-3 inline mr-1" />
              设为最终
            </button>
          </>
        )}

        {/* final 状态：只显示「取消最终」，清晰醒目 */}
        {isFinal && (
          <button
            className="photo-action-btn bg-error hover:bg-error/80 text-white text-xs px-2 py-1.5 rounded font-semibold shadow-md"
            onClick={(e) => { e.stopPropagation(); onCancelFinal?.(photo); }}
          >
            <X className="w-3 h-3 inline mr-1" />
            取消最终
          </button>
        )}
      </div>

      <div className="photo-status absolute bottom-1.5 right-1.5 flex gap-1">
        {isInPending && !isFinal && (
          <div className="w-2 h-2 rounded-full bg-warning" />
        )}
        {isFinal && (
          <button
            className="w-5 h-5 rounded-full bg-success hover:bg-error flex items-center justify-center transition-colors shadow-sm cursor-pointer"
            onClick={(e) => { e.stopPropagation(); onCancelFinal?.(photo); }}
            title="点击取消最终"
          >
            <Check className="w-3 h-3 text-white" />
          </button>
        )}
      </div>
    </div>
  );
}
