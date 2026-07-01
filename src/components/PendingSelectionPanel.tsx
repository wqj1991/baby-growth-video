import { useEffect, useState } from 'react';
import { Check, X, Grid3X3, Wand2, Trash2 } from 'lucide-react';
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
    pendingThumbnails,
    loadPendingThumbnails, 
    removeThumbFromPending,
    deleteThumb,
    setThumbAsFinal,
    cancelThumbFinal,
    currentPeriod,
  } = useAppStore();

  const finalThumbnail = pendingThumbnails.find(t => t.is_final);

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [generatingCollage, setGeneratingCollage] = useState(false);

  // 加载待选区缩略图
  useEffect(() => {
    if (currentPeriod) {
      loadPendingThumbnails(currentPeriod.id);
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
                  className={`stash-compare-item relative cursor-pointer group ${isFinal ? 'ring-2 ring-success' : isMultiSelected ? 'ring-2 ring-warning' : ''}`}
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

                  {/* 操作按钮区域 — 参照全部照片 */}
                  <div className={`photo-actions absolute top-1.5 left-1.5 right-1.5 flex flex-col gap-1 transition-opacity ${isFinal ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                    {!isFinal && (
                      <>
                        {/* 取消待选（scan）或 删除（video_frame/collage） */}
                        {thumb.source_type === 'scan' ? (
                          <button
                            className="photo-action-btn bg-stash-600 hover:bg-[#6345a8] text-white text-xs px-2 py-1 rounded flex items-center justify-center"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeThumbFromPending(thumb.id);
                            }}
                            title="取消待选"
                          >
                            <X className="w-3 h-3 inline mr-1" />
                            取消待选
                          </button>
                        ) : (
                          <button
                            className="photo-action-btn bg-error hover:bg-rose-600 text-white text-xs px-2 py-1 rounded flex items-center justify-center"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteThumb(thumb.id);
                            }}
                            title="删除照片（含源文件）"
                          >
                            <Trash2 className="w-3 h-3 inline mr-1" />
                            删除
                          </button>
                        )}
                        {/* 设为最终 */}
                        <button
                          className="photo-action-btn bg-success hover:bg-success-dark text-white text-xs px-2 py-1 rounded font-medium flex items-center justify-center"
                          onClick={(e) => {
                            e.stopPropagation();
                            setThumbAsFinal(thumb.id);
                          }}
                        >
                          <Check className="w-3 h-3 inline mr-1" />
                          最终
                        </button>
                      </>
                    )}
                    {isFinal && (
                      <button
                        className="photo-action-btn bg-error hover:bg-rose-600 text-white text-xs px-2 py-1.5 rounded font-semibold flex items-center justify-center"
                        onClick={(e) => {
                          e.stopPropagation();
                          cancelThumbFinal();
                        }}
                      >
                        <X className="w-3 h-3 inline mr-1" />
                        取消最终
                      </button>
                    )}
                  </div>

                  {/* 状态标记 */}
                  <div className="photo-status absolute bottom-1.5 right-1.5 flex gap-1">
                    {isFinal && (
                      <div className="w-5 h-5 rounded-full bg-success flex items-center justify-center">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </div>

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
                  setSelectedIds(new Set()); // 生成拼图后清除选中状态
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
