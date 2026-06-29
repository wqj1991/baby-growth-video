import { useState } from 'react';
import { ArrowLeft, GripVertical, Sparkles, Eye } from 'lucide-react';
import { useAppStore } from '../store';
import type { SelectableItem } from '../types';

interface CollageWorkspaceProps {
  selectedItems: SelectableItem[];
  loadedImages: Record<number, string>;
  onBack: () => void;
  onGenerate: (layout: string, gap: number, order: number[]) => void;
}

const LAYOUT_LABELS: Record<string, string> = {
  '2up': '左右对分',
  '3up-main': '1大+2小',
  '4grid': '田字格',
  '3row': '竖排三格',
};

const LAYOUT_RECOMMENDATION: Record<number, string> = {
  2: '2up',
  3: '3up-main',
  4: '4grid',
};

/**
 * 拼图合成工作区
 * 左侧全屏黑色预览 + 右侧控制面板
 */
export default function CollageWorkspace({
  selectedItems,
  loadedImages,
  onBack,
  onGenerate,
}: CollageWorkspaceProps) {
  const {
    collageLayout,
    setCollageLayout,
    collageGap,
    setCollageGap,
    collagePhotoOrder,
  } = useAppStore();

  // 自动推荐布局
  const recommendedLayout = LAYOUT_RECOMMENDATION[selectedItems.length] || '4grid';
  const [activeLayout, setActiveLayout] = useState(collageLayout || recommendedLayout);

  const getLayoutClass = (layout: string) => {
    switch (layout) {
      case '2up': return 'collage-2up';
      case '3up-main': return 'collage-3up-main';
      case '4grid': return 'collage-4grid';
      case '3row': return 'collage-3row';
      default: return 'collage-4grid';
    }
  };

  const handleLayoutChange = (layout: string) => {
    setActiveLayout(layout);
    setCollageLayout(layout);
  };

  const handleGapChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCollageGap(Number(e.target.value));
  };

  const order = collagePhotoOrder.length > 0 ? collagePhotoOrder : selectedItems.map((_, i) => i);

  return (
    <div className="flex flex-col h-full">
      {/* Top Bar */}
      <div className="h-[52px] flex items-center gap-3 px-5 border-b border-[#e8e6de] bg-white flex-shrink-0">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-[#706c63] hover:text-[#33312d] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          返回待选区
        </button>
        <span className="text-[#e8e6de]">|</span>
        <span className="text-sm font-medium text-[#706c63]">拼图工作区</span>
        <span className="badge badge-primary ml-2">{selectedItems.length} 张照片</span>

        <div className="ml-auto flex items-center gap-2">
          <button className="btn btn-secondary btn-sm">重置</button>
          <button
            onClick={() => onGenerate(activeLayout, collageGap, order)}
            className="btn btn-primary btn-sm"
          >
            <Sparkles className="w-3.5 h-3.5" />
            生成拼图
          </button>
        </div>
      </div>

      {/* Main Area */}
      <div className="collage-layout">
        {/* Preview Canvas */}
        <div className="collage-preview">
          <div className="flex flex-col items-center gap-3">
            <div className="text-[11px] text-white/40">实时预览（输出比例 1:1）</div>
            <div className="collage-canvas">
              <div
                className={`collage-canvas-inner ${getLayoutClass(activeLayout)}`}
                style={{ gap: `${collageGap}px` }}
              >
                {Array.from({ length: Math.min(selectedItems.length, 4) }).map((_, idx) => {
                  const itemIdx = order[idx] ?? idx;
                  const item = selectedItems[itemIdx];
                  const imageUrl = item ? loadedImages[item.item.id] : null;
                  const isMainCell = activeLayout === '3up-main' && idx === 0;

                  return (
                    <div
                      key={idx}
                      className={`collage-cell ${isMainCell ? 'collage-cell-main' : ''}`}
                      style={{ background: imageUrl ? `url(${imageUrl}) center/cover` : '#2a1a10' }}
                    >
                      {!imageUrl && (
                        <>
                          <span className="collage-cell-placeholder">
                            {idx + 1}
                          </span>
                          <div className="collage-cell-drag-hint">
                            {isMainCell ? '主图 · 拖拽调整' : '拖拽调整'}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="text-[10px] text-white/30">最终输出：1080×1080 · JPG 95%</div>
          </div>
        </div>

        {/* Control Sidebar */}
        <div className="collage-sidebar">
          {/* Layout Selector */}
          <div className="collage-section">
            <h4>布局选择</h4>
            <div className="layout-opts">
              {['2up', '3up-main', '4grid', '3row'].map((layout) => (
                <button
                  key={layout}
                  onClick={() => handleLayoutChange(layout)}
                  className={`layout-opt ${
                    activeLayout === layout ? 'active' : ''
                  } ${layout === recommendedLayout ? '' : ''}`}
                  title={LAYOUT_LABELS[layout]}
                >
                  <div className={`layout-opt-inner ${
                    layout === '2up' ? 'lo-2col' :
                    layout === '3up-main' ? 'lo-3main' :
                    layout === '4grid' ? 'lo-4grid' : 'lo-3row'
                  }`}>
                    {layout === '3up-main' ? (
                      <>
                        <div className="lo-cell-main" />
                        <div className="lo-cell" />
                        <div className="lo-cell" />
                      </>
                    ) : (
                      Array.from({ length: layout === '3row' ? 3 : layout === '2up' ? 2 : 4 }).map((_, i) => (
                        <div key={i} className="lo-cell" />
                      ))
                    )}
                  </div>
                </button>
              ))}
            </div>
            {recommendedLayout !== activeLayout && (
              <div className="text-[10px] text-[#f0a020] mt-2">
                💡 推荐：{LAYOUT_LABELS[recommendedLayout]}（适合 {selectedItems.length} 张）
              </div>
            )}
            {recommendedLayout === activeLayout && (
              <div className="text-[10px] text-[#2d9d5f] mt-2">
                ✓ 推荐布局（{selectedItems.length} 张照片）
              </div>
            )}
          </div>

          {/* Photo Order */}
          <div className="collage-section">
            <h4>照片顺序</h4>
            <div className="flex flex-col gap-1">
              {selectedItems.map((selItem, idx) => {
                const item = selItem.item;
                const imageUrl = loadedImages[item.id];
                const isMain = activeLayout === '3up-main' && idx === 0;

                return (
                  <div key={`${selItem.type}-${item.id}`} className="source-item-v2">
                    <GripVertical className="w-3.5 h-3.5 text-[#b0aca0]" />
                    <div
                      className="w-9 h-6 rounded flex-shrink-0 bg-cover bg-center"
                      style={{
                        backgroundImage: imageUrl ? `url(${imageUrl})` : undefined,
                        background: !imageUrl
                          ? 'linear-gradient(135deg, #3d2414 0%, #1c0d06 100%)'
                          : undefined,
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] text-[#706c63] truncate">
                        {'file_name' in item ? (item as { file_name: string }).file_name : `帧 #${item.id}`}
                      </div>
                      <div className="text-[9px] text-[#b0aca0]">
                        {selItem.type === 'photo' ? '扫描照片' : '视频截帧'}
                      </div>
                    </div>
                    {isMain && (
                      <span className="text-[9px] text-[#f58b3d] bg-[#fff2e6] px-1.5 py-0.5 rounded font-medium">
                        主图
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="text-[10px] text-[#b0aca0] mt-2">拖拽调整照片在拼图中的位置</div>
          </div>

          {/* Gap Control */}
          <div className="collage-section">
            <h4>间距设置</h4>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="0"
                max="12"
                value={collageGap}
                onChange={handleGapChange}
                className="flex-1 h-1 rounded-full appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #f58b3d 0%, #f58b3d ${(collageGap / 12) * 100}%, #f5f4f0 ${(collageGap / 12) * 100}%, #f5f4f0 100%)`,
                }}
              />
              <span className="text-[11px] text-[#706c63] min-w-[28px]">{collageGap}px</span>
            </div>
          </div>

          {/* Footer */}
          <div className="collage-footer">
            <div className="text-[11px] text-[#b0aca0] mb-2">
              输出尺寸: <span className="text-[#706c63] font-medium">1080×1080px</span> · 格式: <span className="text-[#706c63] font-medium">JPG 95%</span>
            </div>
            <button
              onClick={() => onGenerate(activeLayout, collageGap, order)}
              className="btn btn-primary w-full !justify-center !h-[38px]"
            >
              <Sparkles className="w-4 h-4" />
              生成拼图
            </button>
            <button className="btn btn-ghost btn-sm w-full !justify-center mt-1.5">
              <Eye className="w-3.5 h-3.5" />
              预览全屏效果
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
