import { Plus, Check, X } from 'lucide-react';
import type { Thumbnail } from '../types';

interface ThumbnailCardProps {
  thumbnail: Thumbnail;
  onPreview?: (thumbnail: Thumbnail) => void;
  onAddToPending?: (thumbnail: Thumbnail) => void;
  onRemoveFromPending?: (thumbnail: Thumbnail) => void;
  onSetFinal?: (thumbnail: Thumbnail) => void;
  onCancelFinal?: () => void;
}

export default function ThumbnailCard({
  thumbnail,
  onPreview,
  onAddToPending,
  onRemoveFromPending,
  onSetFinal,
  onCancelFinal,
}: ThumbnailCardProps) {
  const { is_selected, is_final, base64_data, original_file_name } = thumbnail;

  const handleAction = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (is_final) {
      onCancelFinal?.();
    } else if (is_selected) {
      onRemoveFromPending?.(thumbnail);
    } else {
      onAddToPending?.(thumbnail);
    }
  };

  const handleSetFinal = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSetFinal?.(thumbnail);
  };

  return (
    <div
      className={`photo-card relative group ${is_final ? 'ring-2 ring-success' : ''}`}
      onDoubleClick={() => onPreview?.(thumbnail)}
    >
      <div className="photo-thumb" style={{ aspectRatio: '4/3' }}>
        {base64_data ? (
          <img src={base64_data} alt={original_file_name} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-stone-100 to-stone-200">
            <span className="text-2xl opacity-25">📷</span>
          </div>
        )}
      </div>

      {/* 操作按钮 */}
      <div className={`photo-actions absolute top-1.5 left-1.5 right-1.5 flex flex-col gap-1 transition-opacity ${is_final ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
        {!is_final && (
          <>
            <button
              className="photo-action-btn bg-stash-600 hover:bg-[#6345a8] text-white text-xs px-2 py-1 rounded flex items-center justify-center"
              onClick={handleAction}
            >
              {is_selected ? (
                <>
                  <X className="w-3 h-3 inline mr-1" />
                  取消
                </>
              ) : (
                <>
                  <Plus className="w-3 h-3 inline mr-1" />
                  加入
                </>
              )}
            </button>
            <button
              className="photo-action-btn bg-success hover:bg-success-dark text-white text-xs px-2 py-1 rounded font-medium flex items-center justify-center"
              onClick={handleSetFinal}
            >
              <Check className="w-3 h-3 inline mr-1" />
              最终
            </button>
          </>
        )}
        {is_final && (
          <button
            className="photo-action-btn bg-error hover:bg-error/80 text-white text-xs px-2 py-1.5 rounded font-semibold flex items-center justify-center"
            onClick={onCancelFinal}
          >
            <X className="w-3 h-3 inline mr-1" />
            取消最终
          </button>
        )}
      </div>

      {/* 状态标记 */}
      <div className="photo-status absolute bottom-1.5 right-1.5 flex gap-1">
        {is_selected && !is_final && (
          <div className="w-2 h-2 rounded-full bg-warning" />
        )}
        {is_final && (
          <div className="w-5 h-5 rounded-full bg-success flex items-center justify-center">
            <Check className="w-3 h-3 text-white" />
          </div>
        )}
      </div>
    </div>
  );
}
