import { Check, X, Grid3X3, Wand2 } from 'lucide-react';
import { MIN_PHOTOS, MAX_PHOTOS } from '../utils/collageTemplates';
import type { SelectableItem, Photo, VideoFrame } from '../types';

interface PendingSelectionPanelProps {
  selectedItems: SelectableItem[];
  loadedImages: Record<number, string>;
  onToggleMultiSelect: (item: SelectableItem) => void;
  onRemoveItem: (item: SelectableItem) => void;
  onSelectSingle: (item: SelectableItem) => void;
  onGenerateCollage: () => void;
  onPreview?: (item: SelectableItem) => void;
}

export default function PendingSelectionPanel({
  selectedItems,
  loadedImages,
  onToggleMultiSelect,
  onRemoveItem,
  onSelectSingle,
  onGenerateCollage,
  onPreview,
}: PendingSelectionPanelProps) {
  const multiSelectedCount = selectedItems.filter((item) => {
    if (item.type === 'photo') return item.item.is_multi_selected;
    return item.item.is_multi_selected;
  }).length;

  const canCollage = multiSelectedCount >= MIN_PHOTOS && multiSelectedCount <= MAX_PHOTOS;

  const getFileName = (item: SelectableItem): string => {
    if (item.type === 'photo') return (item.item as Photo).file_name;
    return `视频截帧 · ${Math.floor((item.item as VideoFrame).time_seconds / 60)}:${((item.item as VideoFrame).time_seconds % 60).toString().padStart(2, '0')}`;
  };

  const isItemMultiSelected = (item: SelectableItem): boolean => {
    return item.item.is_multi_selected;
  };

  const isItemFinal = (item: SelectableItem): boolean => {
    return item.item.is_final;
  };

  return (
    <div className="stash-panel-v2 flex flex-col h-full">
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-[#e8e6de]">
        <Grid3X3 className="w-4 h-4 text-[#7c5cbf]" />
        <h3 className="text-sm font-semibold text-[#33312d]">候选照片</h3>
        <span className="text-[11px] font-bold text-[#7c5cbf] bg-[#f3f0fb] px-2 py-0.5 rounded-full">
          {selectedItems.length} 张
        </span>
        <span className="ml-auto text-[11px] text-[#b0aca0]">单击选择 · 双击预览</span>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        {selectedItems.length === 0 ? (
          <div className="empty-state-v2">
            <div className="empty-icon">📋</div>
            <h4>暂无待选项目</h4>
            <p>在「全部照片」中点击「加入待选区」按钮，或在视频中截帧加入</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              {selectedItems.map((item) => {
                const uniqueKey = `${item.type}-${item.item.id}`;
                const imageUrl = loadedImages[item.item.id];
                const multiSelected = isItemMultiSelected(item);
                const final = isItemFinal(item);

                return (
                  <div
                    key={uniqueKey}
                    className={`stash-compare-item relative cursor-pointer ${multiSelected ? 'ring-2 ring-[#7c5cbf]' : ''} ${final ? 'ring-2 ring-[#22c55e]' : ''}`}
                    onClick={() => onToggleMultiSelect(item)}
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
                      className="stash-remove-btn absolute top-1 right-1 bg-black/50 hover:bg-black/70 text-white rounded-full p-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveItem(item);
                      }}
                    >
                      <X className="w-3 h-3" />
                    </button>

                    {multiSelected && !final && (
                      <div className="absolute top-1 left-1 w-5 h-5 rounded-full bg-[#7c5cbf] flex items-center justify-center">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}

                    {final && (
                      <div className="absolute top-1 left-1 w-5 h-5 rounded-full bg-[#22c55e] flex items-center justify-center">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}

                    <div className="mt-1.5 px-1">
                      <div className="text-[10px] font-medium text-[#33312d] truncate">
                        {getFileName(item)}
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className={`text-[8px] px-1.5 py-0.5 rounded ${item.type === 'photo' ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'}`}>
                          {item.type === 'photo' ? '扫描' : '截帧'}
                        </span>
                      </div>
                    </div>

                    <div
                      className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/70 to-transparent opacity-0 hover:opacity-100 transition-opacity flex justify-center"
                      style={{ pointerEvents: 'none' }}
                    >
                      <button
                        className="bg-white/90 text-[#33312d] text-[10px] font-medium px-2.5 py-1 rounded-md hover:bg-white transition-colors"
                        style={{ pointerEvents: 'auto' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectSingle(item);
                        }}
                      >
                        <Check className="w-3 h-3 inline mr-1" />
                        设为最终
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {multiSelectedCount >= 2 && (
              <div className="progress-hint-bar mt-3">
                <span>🧩</span>
                <div>
                  <div className="font-medium">已选中 {multiSelectedCount} 张</div>
                  <div className="text-[11px] opacity-80">
                    {canCollage
                      ? '点击「生成拼图」选择模板后合成一张输出图片'
                      : `最多可选 ${MAX_PHOTOS} 张进行拼图`}
                  </div>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <div className="h-1.5 w-20 bg-[#e4e7f6] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min((multiSelectedCount / MAX_PHOTOS) * 100, 100)}%`,
                        background: 'linear-gradient(90deg, #7c5cbf, #8b6fc7)',
                      }}
                    />
                  </div>
                </div>
              </div>
            )}

            {multiSelectedCount === 0 && (
              <div className="progress-hint-bar mt-3">
                <span>💡</span>
                <span className="text-[11px]">单击照片进行多选，选 {MIN_PHOTOS}–{MAX_PHOTOS} 张可启用拼图</span>
              </div>
            )}
          </>
        )}
      </div>

      {selectedItems.length > 0 && (
        <div className="p-3 border-t border-[#e8e6de] bg-white">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                if (selectedItems.length > 0) {
                  onSelectSingle(selectedItems[0]);
                }
              }}
              className="btn btn-secondary w-full !justify-center text-xs"
            >
              <Check className="w-3 h-3" />
              单独选定
            </button>
            <button
              onClick={onGenerateCollage}
              disabled={!canCollage}
              className="btn btn-primary w-full !justify-center text-xs"
            >
              <Wand2 className="w-3 h-3" />
              生成拼图 {canCollage ? `(${multiSelectedCount}张)` : ''}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
