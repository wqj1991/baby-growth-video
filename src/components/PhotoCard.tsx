import type { Photo } from '../types';
import { Check, Camera } from 'lucide-react';

interface PhotoCardProps {
  photo: Photo;
  imageUrl: string;
  onContextMenu?: (e: React.MouseEvent, photo: Photo) => void;
  onDoubleClick?: () => void;
  onClick?: () => void;
  onSelect?: (photo: Photo) => void;
  onAddToStash?: (photo: Photo) => void;
}

/**
 * 增强版照片卡片（V2）
 * 支持悬停快捷操作：选定 / 待选区
 * 状态角标：待选（紫色）、已选定（绿色）
 */
export default function PhotoCard({
  photo,
  imageUrl,
  onContextMenu,
  onDoubleClick,
  onClick,
  onSelect,
  onAddToStash,
}: PhotoCardProps) {
  const hasState = photo.is_selected || photo.is_final;

  return (
    <div
      className={`photo-item ${photo.is_selected ? 'selected' : ''} ${photo.is_final ? 'final' : ''} ${hasState ? 'has-badge' : ''}`}
      onContextMenu={onContextMenu ? (e) => onContextMenu(e, photo) : undefined}
      onDoubleClick={onDoubleClick}
      onClick={onClick}
    >
      {/* Image */}
      {imageUrl ? (
        <img src={imageUrl} alt={photo.file_name} className="w-full h-full object-cover" loading="lazy" />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#f5f4f0] to-[#e8e6de]">
          <Camera className="w-6 h-6 text-[#d4d1c7]" />
        </div>
      )}

      {/* State Badge */}
      {photo.is_final && (
        <span className="photo-state-badge badge-final">
          <Check className="w-2.5 h-2.5 inline mr-0.5" />
          选定
        </span>
      )}
      {photo.is_selected && !photo.is_final && (
        <span className="photo-state-badge badge-stashed">待选</span>
      )}

      {/* Hover Quick Actions */}
      <div className="photo-hover-overlay">
        {!photo.is_final && (
          <>
            <button
              className="photo-quick-btn qbtn-select"
              onClick={(e) => {
                e.stopPropagation();
                onSelect?.(photo);
              }}
            >
              <Check className="w-3 h-3 inline mr-0.5" />
              选定
            </button>
            {!photo.is_selected ? (
              <button
                className="photo-quick-btn qbtn-stash"
                onClick={(e) => {
                  e.stopPropagation();
                  onAddToStash?.(photo);
                }}
              >
                待选区
              </button>
            ) : (
              <button
                className="photo-quick-btn qbtn-stashed"
                onClick={(e) => {
                  e.stopPropagation();
                  onAddToStash?.(photo);
                }}
              >
                已在待选
              </button>
            )}
          </>
        )}
      </div>

      {/* Bottom Caption */}
      <div className="photo-caption">
        <p className="photo-caption-text">{photo.file_name}</p>
        {photo.taken_at && (
          <p className="photo-caption-text opacity-70">{photo.taken_at}</p>
        )}
      </div>
    </div>
  );
}
