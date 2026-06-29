import { Check, X, Grid3X3, Wand2 } from 'lucide-react';
import type { SelectableItem, Photo, VideoFrame } from '../types';

interface PendingSelectionPanelProps {
  selectedItems: SelectableItem[];
  loadedImages: Record<number, string>;
  onToggleMultiSelect: (item: SelectableItem) => void;
  onRemoveItem: (item: SelectableItem) => void;
  onSelectSingle: (item: SelectableItem) => void;
  onGenerateCollage: () => void;
}

/**
 * 待选区对比面板（V2）
 * 大图对比模式，支持勾选多选（最多4张）和单独选定/拼图
 */
export default function PendingSelectionPanel({
  selectedItems,
  loadedImages,
  onToggleMultiSelect,
  onRemoveItem,
  onSelectSingle,
  onGenerateCollage,
}: PendingSelectionPanelProps) {
  const multiSelectedCount = selectedItems.filter((item) => {
    if (item.type === 'photo') return item.item.is_multi_selected;
    return item.item.is_multi_selected;
  }).length;

  const canCollage = multiSelectedCount >= 2 && multiSelectedCount <= 4;

  // Separate into two rows: top row big items (first 2), bottom row smaller (rest)
  const topRow = selectedItems.slice(0, Math.min(2, selectedItems.length));
  const bottomRow = selectedItems.slice(2);

  const getFileName = (item: SelectableItem): string => {
    if (item.type === 'photo') return (item.item as Photo).file_name;
    return `视频截帧 · ${Math.floor((item.item as VideoFrame).time_seconds / 60)}:${((item.item as VideoFrame).time_seconds % 60).toString().padStart(2, '0')}`;
  };

  const getSourceTag = (item: SelectableItem) => {
    if (item.type === 'photo') {
      return { label: '扫描', className: 'scan' };
    }
    return { label: '截帧', className: 'frame' };
  };

  const isItemSelected = (item: SelectableItem): boolean => {
    return item.item.is_multi_selected;
  };

  return (
    <div className="stash-panel-v2">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-[#e8e6de]">
        <Grid3X3 className="w-4 h-4 text-[#7c5cbf]" />
        <h3 className="text-sm font-semibold text-[#33312d]">候选照片</h3>
        <span className="text-[11px] font-bold text-[#7c5cbf] bg-[#f3f0fb] px-2 py-0.5 rounded-full">
          {selectedItems.length} 张
        </span>
        <span className="ml-auto text-[11px] text-[#b0aca0]">点击放大 · 勾选多选</span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5">
        {selectedItems.length === 0 ? (
          <div className="empty-state-v2">
            <div className="empty-icon">📋</div>
            <h4>暂无待选项目</h4>
            <p>在「全部照片」中点击「待选区」按钮，或在视频中截帧加入</p>
          </div>
        ) : (
          <>
            {/* Top Row - Large Items */}
            <div className="stash-compare-grid mb-3">
              {topRow.map((item) => {
                const uniqueKey = `${item.type}-${item.item.id}`;
                const imageUrl = loadedImages[item.item.id];
                const selected = isItemSelected(item);

                return (
                  <div
                    key={uniqueKey}
                    className={`stash-compare-item ${selected ? 'multi-selected' : ''}`}
                    onClick={() => onToggleMultiSelect(item)}
                  >
                    <div className="stash-compare-thumb" style={{ aspectRatio: '4/3' }}>
                      {imageUrl ? (
                        <img src={imageUrl} alt={getFileName(item)} />
                      ) : (
                        <span className="text-3xl opacity-25">📷</span>
                      )}
                    </div>

                    {selected ? (
                      <div className="stash-check-mark">✓</div>
                    ) : (
                      <div className="stash-uncheck-mark" />
                    )}

                    <button
                      className="stash-remove-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveItem(item);
                      }}
                    >
                      <X className="w-3 h-3" />
                    </button>

                    <div className="stash-item-info">
                      <div className="text-[11px] font-medium text-[#33312d] truncate">
                        {getFileName(item)}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className={`stash-source-tag ${getSourceTag(item).className}`}>
                          {getSourceTag(item).label}
                        </span>
                        <span className="text-[9px] text-[#b0aca0]">
                          {item.type === 'photo'
                            ? `${(item.item as Photo).width}×${(item.item as Photo).height}`
                            : '视频帧'}
                        </span>
                      </div>
                    </div>

                    {/* Single Select Button - shown on hover via parent */}
                    <div
                      className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent opacity-0 hover:opacity-100 transition-opacity flex justify-center"
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
                        单独选定
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom Row - Smaller Items */}
            {bottomRow.length > 0 && (
              <div
                className="grid gap-2 mb-3"
                style={{ gridTemplateColumns: `repeat(${Math.min(bottomRow.length, 3)}, 1fr)` }}
              >
                {bottomRow.map((item) => {
                  const uniqueKey = `sm-${item.type}-${item.item.id}`;
                  const imageUrl = loadedImages[item.item.id];
                  const selected = isItemSelected(item);

                  return (
                    <div
                      key={uniqueKey}
                      className={`stash-compare-item small ${selected ? 'multi-selected' : ''}`}
                      onClick={() => onToggleMultiSelect(item)}
                    >
                      <div className="stash-compare-thumb" style={{ aspectRatio: '1' }}>
                        {imageUrl ? (
                          <img src={imageUrl} alt={getFileName(item)} />
                        ) : (
                          <span className="text-2xl opacity-25">📷</span>
                        )}
                      </div>

                      {selected ? (
                        <div className="stash-check-mark">✓</div>
                      ) : (
                        <div className="stash-uncheck-mark" />
                      )}

                      <button
                        className="stash-remove-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveItem(item);
                        }}
                      >
                        <X className="w-3 h-3" />
                      </button>

                      <div className="text-[10px] font-medium text-[#33312d] px-1.5 py-0.5 truncate">
                        {getFileName(item).substring(0, 12)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Hint */}
            {multiSelectedCount >= 2 && (
              <div className="progress-hint-bar">
                <span>🧩</span>
                <div>
                  <div className="font-medium">已选中 {multiSelectedCount} 张</div>
                  <div className="text-[11px] opacity-80">
                    {canCollage
                      ? '点击「生成拼图」将合成为一张输出图片'
                      : '最多可选 4 张进行拼图'}
                  </div>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <div className="h-1.5 w-20 bg-[#e4e7f6] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(multiSelectedCount / 4) * 100}%`,
                        background: 'linear-gradient(90deg, #7c5cbf, #8b6fc7)',
                      }}
                    />
                  </div>
                </div>
              </div>
            )}

            {multiSelectedCount === 0 && (
              <div className="progress-hint-bar">
                <span>💡</span>
                <span className="text-[11px]">点击照片进行多选，或点击「单独选定」直接确认一张</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Bottom Actions */}
      {selectedItems.length > 0 && (
        <div className="p-4 border-t border-[#e8e6de] bg-white">
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => {
                if (selectedItems.length > 0) {
                  onSelectSingle(selectedItems[0]);
                }
              }}
              className="btn btn-secondary w-full !justify-center"
            >
              <Check className="w-3.5 h-3.5" />
              单独选定
            </button>
            <button
              onClick={onGenerateCollage}
              disabled={!canCollage}
              className="btn btn-primary w-full !justify-center"
            >
              <Wand2 className="w-3.5 h-3.5" />
              生成拼图 {canCollage ? `(${multiSelectedCount}张)` : ''}
            </button>
          </div>
          {selectedItems.length > 4 && (
            <div className="text-[10px] text-[#d44d68] text-center mt-2">
              ⚠️ 超过 4 张无法拼图，建议移除部分后再继续
            </div>
          )}
          {selectedItems.length === 1 && (
            <div className="text-[10px] text-[#b0aca0] text-center mt-2">
              选 2–4 张照片可启用拼图功能
            </div>
          )}
        </div>
      )}
    </div>
  );
}
