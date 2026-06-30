import { useEffect, useState } from 'react';
import { Check, X, Grid3X3, Wand2, Loader2 } from 'lucide-react';
import { useAppStore } from '../store';
import { getImageBase64 } from '../utils/tauriCommands';
import { MIN_PHOTOS, MAX_PHOTOS } from '../utils/collageTemplates';
import type { PendingItem } from '../types';

interface PendingSelectionPanelProps {
  onGenerateCollage?: () => void;
  onPreview?: (item: PendingItem) => void;
  onToggleMultiSelect?: (item: PendingItem) => void;
  onSelectSingle?: (item: PendingItem) => void;
  onCancelFinal?: (item: PendingItem) => void;
}

export default function PendingSelectionPanel({
  onGenerateCollage,
  onPreview,
  onToggleMultiSelect,
  onSelectSingle,
  onCancelFinal,
}: PendingSelectionPanelProps) {
  const {
    pendingItems,
    pendingLoading,
    deletingItemId,
    loadPendingItems,
    deletePendingItem,
    currentPeriod,
  } = useAppStore();

  const [loadedImages, setLoadedImages] = useState<Record<number, string>>({});
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [generatingCollage, setGeneratingCollage] = useState(false);

  // Load pending items on mount / period change
  useEffect(() => {
    if (currentPeriod) {
      loadPendingItems(currentPeriod.id);
    }
  }, [currentPeriod?.id]);

  // Load item thumbnails
  useEffect(() => {
    const loadImages = async () => {
      const itemsToLoad = pendingItems.filter((item) => !loadedImages[item.id]);
      if (itemsToLoad.length === 0) return;
      const results = await Promise.all(
        itemsToLoad.map(async (item) => {
          const imagePath = item.thumbnail_path || item.file_path;
          if (!imagePath) return { id: item.id, url: '' };
          try {
            const url = await getImageBase64(imagePath);
            return { id: item.id, url };
          } catch (error) {
            console.error(`加载待选项图片失败 ${item.id}:`, error);
            return { id: item.id, url: '' };
          }
        })
      );
      const newImages: Record<number, string> = {};
      results.forEach(({ id, url }) => {
        if (url) newImages[id] = url;
      });
      setLoadedImages((prev) => ({ ...prev, ...newImages }));
    };
    if (pendingItems.length > 0) loadImages();
  }, [pendingItems]);

  const multiSelectedCount = pendingItems.filter((item) => selectedIds.has(item.id)).length;
  const canCollage = multiSelectedCount >= MIN_PHOTOS && multiSelectedCount <= MAX_PHOTOS;

  const getFileName = (item: PendingItem): string => {
    if (item.file_name) return item.file_name;
    if (item.item_type === 'video_frame') {
      return `视频截帧 · ${Math.floor((item.time_seconds || 0) / 60)}:${((item.time_seconds || 0) % 60).toString().padStart(2, '0')}`;
    }
    return `项目 #${item.id}`;
  };

  const getSourceLabel = (item: PendingItem): { text: string; className: string } => {
    switch (item.item_type) {
      case 'photo':
        return { text: '扫描', className: 'bg-indigo-600 text-white' };
      case 'collage':
        return { text: '拼图', className: 'bg-purple-600 text-white' };
      case 'video_frame':
        return { text: '截帧', className: 'bg-warmth-600 text-white' };
      default:
        return { text: '未知', className: 'bg-stone-500 text-white' };
    }
  };

  const handleToggleMultiSelect = (item: PendingItem) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(item.id)) next.delete(item.id);
      else next.add(item.id);
      return next;
    });
    onToggleMultiSelect?.(item);
  };

  const handleGenerateCollage = async () => {
    if (!onGenerateCollage) return;
    setGeneratingCollage(true);
    try {
      onGenerateCollage();
    } finally {
      setGeneratingCollage(false);
    }
  };

  return (
    <div className="stash-panel-v2 flex flex-col h-full">
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-stone-200">
        <Grid3X3 className="w-4 h-4 text-stash-600" />
        <h3 className="text-sm font-semibold text-stone-900">候选照片</h3>
        <span className="text-[11px] font-bold text-stash-600 bg-stash-100 px-2 py-0.5 rounded-full">
          {pendingItems.length} 张
        </span>
        <span className="ml-auto text-[11px] text-stone-400">单击选择 · 双击预览</span>
      </div>

      {/* 已选中状态条 — 紧跟标题栏 */}
      {pendingItems.length > 0 && (
        <div className="px-5 py-2.5 border-b border-stone-100 bg-stone-50/80">
          {multiSelectedCount >= 2 ? (
            <div className="flex items-center gap-2">
              <span className="text-xs">🧩</span>
              <span className="text-xs font-medium text-stone-700">
                已选中 <b className="text-stash-600">{multiSelectedCount}</b> 张
              </span>
              <span className="text-[10px] text-stone-400 ml-1">
                {canCollage ? '可生成拼图' : `还需 ${MIN_PHOTOS - multiSelectedCount} 张`}
              </span>
              <div className="ml-auto h-1.5 w-16 bg-stone-200 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min((multiSelectedCount / MAX_PHOTOS) * 100, 100)}%`,
                    background: 'linear-gradient(90deg, var(--color-stash-600), var(--color-stash-500))',
                  }}
                />
              </div>
            </div>
          ) : multiSelectedCount === 1 ? (
            <div className="flex items-center gap-2 text-xs text-stone-500">
              <span>🧩</span>
              <span>已选中 1 张，再选 {Math.min(MIN_PHOTOS - 1, MAX_PHOTOS - 1)} 张可生成拼图</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-stone-400">
              <span>💡</span>
              <span>单击照片进行多选，选 {MIN_PHOTOS}–{MAX_PHOTOS} 张可启用拼图</span>
            </div>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-5">
        {pendingLoading ? (
          <div className="empty-state-v2">
            <div className="w-6 h-6 border-2 border-stone-200 border-t-warmth-400 rounded-full animate-spin mb-3" />
            <h4>加载待选区...</h4>
          </div>
        ) : pendingItems.length === 0 ? (
          <div className="empty-state-v2">
            <div className="empty-icon">📋</div>
            <h4>暂无待选项目</h4>
            <p>在「全部照片」中点击「加入待选区」按钮，或在视频中截帧加入</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              {pendingItems.map((item) => {
                const uniqueKey = `${item.item_type}-${item.id}`;
                const imageUrl = loadedImages[item.id];
                const multiSelected = selectedIds.has(item.id);
                const final = item.is_final;
                const source = getSourceLabel(item);
                const isDeleting = deletingItemId === item.id;

                return (
                  <div
                    key={uniqueKey}
                    className={`stash-compare-item relative cursor-pointer group ${final ? 'ring-2 ring-success' : multiSelected ? 'ring-2 ring-stash-600' : ''}`}
                    onClick={() => handleToggleMultiSelect(item)}
                    onDoubleClick={() => onPreview?.(item)}
                  >
                    <div className="stash-compare-thumb" style={{ aspectRatio: '4/3' }}>
                      {imageUrl ? (
                        <img src={imageUrl} alt={getFileName(item)} />
                      ) : (
                        <span className="text-3xl opacity-25">📷</span>
                      )}
                    </div>

                    <button
                      className="stash-remove-btn bg-black/50 hover:bg-black/70 text-white rounded-full p-1 shadow-sm disabled:opacity-50"
                      onClick={(e) => {
                        e.stopPropagation();
                        deletePendingItem(item.item_type, item.id);
                      }}
                      disabled={isDeleting}
                    >
                      {isDeleting ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <X className="w-3 h-3" />
                      )}
                    </button>

                    {multiSelected && !final && (
                      <div className="absolute top-1 left-1 w-5 h-5 rounded-full bg-stash-600 flex items-center justify-center">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}

                    {final && (
                      <button
                        className="absolute top-1 left-1 w-5 h-5 rounded-full bg-success hover:bg-error flex items-center justify-center transition-colors shadow-sm cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          onCancelFinal?.(item);
                        }}
                        title="点击取消最终"
                      >
                        <Check className="w-3 h-3 text-white" />
                      </button>
                    )}

                    <div className="mt-1.5 px-1">
                      <div className="text-[10px] font-medium text-stone-900 truncate">
                        {getFileName(item)}
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${source.className}`}>
                          {source.text}
                        </span>
                      </div>
                    </div>

                    <div
                      className={`absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/70 to-transparent flex justify-center transition-opacity ${final ? 'opacity-100' : 'opacity-0 hover:opacity-100'}`}
                      style={{ pointerEvents: 'none' }}
                    >
                      {!final ? (
                        <button
                          className="bg-success hover:bg-success-dark text-white text-[10px] font-semibold px-2.5 py-1 rounded-md transition-colors shadow-sm"
                          style={{ pointerEvents: 'auto' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectSingle?.(item);
                          }}
                        >
                          <Check className="w-3 h-3 inline mr-1" />
                          设为最终
                        </button>
                      ) : (
                        <button
                          className="bg-error hover:bg-error/80 text-white text-[10px] font-semibold px-2.5 py-1 rounded-md transition-colors shadow-sm"
                          style={{ pointerEvents: 'auto' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            onCancelFinal?.(item);
                          }}
                        >
                          <X className="w-3 h-3 inline mr-1" />
                          取消最终
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {pendingItems.length > 0 && (
        <div className="p-3 border-t border-stone-200 bg-white">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                if (pendingItems.length > 0) {
                  onSelectSingle?.(pendingItems[0]);
                }
              }}
              disabled={generatingCollage}
              className="btn btn-secondary w-full !justify-center text-xs"
            >
              {generatingCollage && <div className="w-3 h-3 border-2 border-stone-400 border-t-transparent rounded-full animate-spin" />}
              <Check className="w-3 h-3" />
              {generatingCollage ? '处理中...' : '单独选定'}
            </button>
            <button
              onClick={handleGenerateCollage}
              disabled={!canCollage || generatingCollage}
              className="btn btn-primary w-full !justify-center text-xs"
            >
              {generatingCollage && <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              <Wand2 className="w-3 h-3" />
              {generatingCollage ? '生成中...' : `生成拼图${canCollage ? `(${multiSelectedCount}张)` : ''}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
