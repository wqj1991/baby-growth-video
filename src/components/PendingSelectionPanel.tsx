import { useEffect, useState } from 'react';
import { Check, X, Grid3X3, Wand2 } from 'lucide-react';
import { useAppStore } from '../store';
import type { Thumbnail } from '../types';

interface PendingSelectionPanelProps {
  onGenerateCollage?: () => void;
  onPreview?: (thumbnail: Thumbnail) => void;
}

export default function PendingSelectionPanel({
  onGenerateCollage,
  onPreview,
}: PendingSelectionPanelProps) {
  const { 
    thumbnails, 
    loadThumbnails, 
    removeThumbFromPending,
    setThumbAsFinal,
    cancelThumbFinal,
    currentPeriod,
  } = useAppStore();

  // 筛选候选区中的缩略图（is_selected=true）
  const pendingThumbnails = thumbnails.filter(t => t.is_selected);
  const finalThumbnail = thumbnails.find(t => t.is_final);

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [generatingCollage, setGeneratingCollage] = useState(false);

  // 加载缩略图
  useEffect(() => {
    if (currentPeriod) {
      loadThumbnails(currentPeriod.id);
    }
  }, [currentPeriod?.id]);

  const multiSelectedCount = pendingThumbnails.filter(t => selectedIds.has(t.id)).length;
  const canCollage = multiSelectedCount >= 2;

  const handleToggleMultiSelect = (thumb: Thumbnail) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(thumb.id)) next.delete(thumb.id);
      else next.add(thumb.id);
      return next;
    });
  };

  const getSourceLabel = (thumb: Thumbnail) => {
    switch (thumb.source_type) {
      case 'scan': return { text: '扫描', className: 'bg-indigo-600 text-white' };
      case 'video_frame': return { text: '截帧', className: 'bg-warmth-600 text-white' };
      case 'collage': return { text: '拼图', className: 'bg-purple-600 text-white' };
      default: return { text: '未知', className: 'bg-stone-500 text-white' };
    }
  };

  return (
    <div className="stash-panel-v2 flex flex-col h-full">
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-stone-200">
        <Grid3X3 className="w-4 h-4 text-stash-600" />
        <h3 className="text-sm font-semibold text-stone-900">候选照片</h3>
        <span className="text-[11px] font-bold text-stash-600 bg-stash-100 px-2 py-0.5 rounded-full">
          {pendingThumbnails.length} 张
        </span>
        <span className="ml-auto text-[11px] text-stone-400">单击选择 · 双击预览</span>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        {pendingThumbnails.length === 0 ? (
          <div className="empty-state-v2">
            <div className="empty-icon">📋</div>
            <h4>暂无候选照片</h4>
            <p>点击照片的「加入」按钮将其添加到候选区</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {pendingThumbnails.map((thumb) => {
              const source = getSourceLabel(thumb);
              const isFinal = thumb.is_final;
              const isMultiSelected = selectedIds.has(thumb.id);

              return (
                <div
                  key={thumb.id}
                  className={`stash-compare-item relative cursor-pointer group ${isFinal ? 'ring-2 ring-success' : isMultiSelected ? 'ring-2 ring-stash-600' : ''}`}
                  onClick={() => handleToggleMultiSelect(thumb)}
                  onDoubleClick={() => onPreview?.(thumb)}
                >
                  <div className="stash-compare-thumb" style={{ aspectRatio: '4/3' }}>
                    {thumb.base64_data ? (
                      <img src={thumb.base64_data} alt={thumb.original_file_name} />
                    ) : (
                      <span className="text-3xl opacity-25">📷</span>
                    )}
                  </div>

                  {/* 移除按钮 */}
                  <button
                    className="stash-remove-btn absolute top-1 right-1 w-5 h-5 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeThumbFromPending(thumb.id);
                    }}
                    title="从候选区移除"
                  >
                    <X className="w-3 h-3" />
                  </button>

                  {isFinal && (
                    <div className="absolute top-1 left-1 w-5 h-5 rounded-full bg-success flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}

                  {isMultiSelected && !isFinal && (
                    <div className="absolute top-1 left-1 w-5 h-5 rounded-full bg-stash-600 flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}

                  <div className="mt-1.5 px-1">
                    <div className="text-[10px] font-medium text-stone-900 truncate">
                      {thumb.original_file_name}
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${source.className}`}>
                        {source.text}
                      </span>
                    </div>
                  </div>

                  {/* 设为最终按钮 */}
                  {!isFinal && (
                    <div
                      className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ pointerEvents: 'none' }}
                    >
                      <button
                        className="w-full bg-success hover:bg-success-dark text-white text-[10px] font-semibold px-2.5 py-1 rounded-md transition-colors"
                        style={{ pointerEvents: 'auto' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setThumbAsFinal(thumb.id);
                        }}
                      >
                        <Check className="w-3 h-3 inline mr-1" />
                        设为最终
                      </button>
                    </div>
                  )}

                  {/* 取消最终按钮 */}
                  {isFinal && (
                    <div
                      className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/70 to-transparent"
                      style={{ pointerEvents: 'none' }}
                    >
                      <button
                        className="w-full bg-error hover:bg-error/80 text-white text-[10px] font-semibold px-2.5 py-1 rounded-md transition-colors"
                        style={{ pointerEvents: 'auto' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          cancelThumbFinal();
                        }}
                      >
                        <X className="w-3 h-3 inline mr-1" />
                        取消最终
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {pendingThumbnails.length > 0 && (
        <div className="p-3 border-t border-stone-200 bg-white">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                if (pendingThumbnails.length > 0 && !finalThumbnail) {
                  setThumbAsFinal(pendingThumbnails[0].id);
                }
              }}
              disabled={!!finalThumbnail || pendingThumbnails.length === 0}
              className="btn btn-secondary w-full !justify-center text-xs"
            >
              <Check className="w-3 h-3" />
              选定首张
            </button>
            <button
              onClick={() => {
                if (canCollage) {
                  setGeneratingCollage(true);
                  onGenerateCollage?.();
                  setGeneratingCollage(false);
                }
              }}
              disabled={!canCollage || generatingCollage}
              className="btn btn-primary w-full !justify-center text-xs"
            >
              <Wand2 className="w-3 h-3" />
              生成拼图
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
