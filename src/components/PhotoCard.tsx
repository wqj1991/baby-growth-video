import { Plus, Check, X, Camera } from 'lucide-react';
import type { Photo } from '../types';

interface PhotoCardProps {
  photo: Photo;
  imageUrl: string;
  onContextMenu?: (e: React.MouseEvent, photo: Photo) => void;
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
  onContextMenu,
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
  const actualToggleSelect = onToggleSelect ?? onAddToStash;
  const actualSetFinal = onSetFinal ?? onSelect;
  return (
    <div
      className={`photo-card relative group ${isFinal ? 'ring-2 ring-[#7c5cbf]' : ''}`}
      onContextMenu={(e) => onContextMenu?.(e, photo)}
      onDoubleClick={() => onDoubleClick?.(photo)}
      onClick={onClick}
    >
      <div className="photo-thumb" style={{ aspectRatio: '4/3' }}>
        {imageUrl ? (
          <img src={imageUrl} alt={photo.file_name} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#f5f4f0] to-[#e8e6de]">
            <Camera className="w-6 h-6 text-[#d4d1c7]" />
          </div>
        )}
      </div>

      <div className="photo-actions absolute top-1.5 left-1.5 right-1.5 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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

        {!isFinal ? (
          <button
            className="photo-action-btn bg-[#7c5cbf] hover:bg-[#6a4eb5] text-white text-xs px-2 py-1 rounded"
            onClick={(e) => { e.stopPropagation(); actualSetFinal?.(photo); }}
          >
            <Check className="w-3 h-3 inline mr-1" />
            设为最终
          </button>
        ) : (
          <button
            className="photo-action-btn bg-[#d44d68] hover:bg-[#b84259] text-white text-xs px-2 py-1 rounded"
            onClick={(e) => { e.stopPropagation(); onCancelFinal?.(photo); }}
          >
            <X className="w-3 h-3 inline mr-1" />
            取消最终
          </button>
        )}
      </div>

      <div className="photo-status absolute bottom-1.5 right-1.5 flex gap-1">
        {isInPending && !isFinal && (
          <div className="w-2 h-2 rounded-full bg-yellow-400" />
        )}
        {isFinal && (
          <div className="w-5 h-5 rounded-full bg-[#7c5cbf] flex items-center justify-center">
            <Check className="w-3 h-3 text-white" />
          </div>
        )}
      </div>
    </div>
  );
}
