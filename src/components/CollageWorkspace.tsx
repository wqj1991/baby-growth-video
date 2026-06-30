import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  GripVertical,
  Sparkles,
  Eye,
  Grid3X3,
  RotateCw,
  FlipHorizontal,
  FlipVertical,
  RefreshCw,
  Image,
  Settings2,
} from 'lucide-react';
import { useAppStore } from '../store';
import type { SelectableItem } from '../types';
import { PREVIEW_COLORS } from './TemplateSelector';
import { toCssTransform, estimateFileSize, QUALITY_PRESETS, OUTPUT_SIZE_PRESETS } from '../utils/collageTemplates';

interface CollageWorkspaceProps {
  selectedItems: SelectableItem[];
  loadedImages: Record<number, string>;
  /** 待选区全部项目（含非多选），用于替换照片时选择来源 */
  pendingItems: SelectableItem[];
  onBack: () => void;
  onGenerate: (
    templateId: string,
    gap: number,
    order: number[],
    transforms: Record<number, { rotation: number; flipH: boolean; flipV: boolean }>,
    quality: number,
    outputSize: number,
  ) => void;
}

/**
 * 拼图合成工作区 — Template-Driven + Region Editing
 *
 * 左侧: 实时预览（可点击选中区域、变换预览）
 * 右侧: 区域编辑工具栏 + 照片顺序 + 间距 + 导出设置
 */
export default function CollageWorkspace({
  selectedItems,
  loadedImages,
  pendingItems,
  onBack,
  onGenerate,
}: CollageWorkspaceProps) {
  const {
    selectedTemplate,
    selectedTemplateId,
    collageGap,
    setCollageGap,
    collagePhotoOrder,
    setCollagePhotoOrder,
    selectedRegionIndex,
    setSelectedRegionIndex,
    regionTransforms,
    setRegionTransform,
    resetRegionTransforms,
    collageQuality,
    setCollageQuality,
    collageOutputSize,
    setCollageOutputSize,
    addToSelectedItems,
  } = useAppStore();

  // 照片替换面板
  const [showReplacer, setShowReplacer] = useState(false);
  // 导出设置面板
  const [showExportSettings, setShowExportSettings] = useState(false);

  // 默认按区域 order 排序的顺序
  const order = useMemo(() => {
    if (collagePhotoOrder.length > 0) return collagePhotoOrder;
    return selectedItems.map((_, i) => i);
  }, [collagePhotoOrder, selectedItems]);

  const template = selectedTemplate;

  // ── 帮助函数 ──

  /** 获取指定区域的变换 CSS */
  const getTransform = (regionIndex: number) => {
    const tf = regionTransforms[regionIndex];
    return tf ? toCssTransform(tf) : 'none';
  };

  /** 处理区域点击 */
  const handleRegionClick = (regionIndex: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedRegionIndex(selectedRegionIndex === regionIndex ? null : regionIndex);
    setShowReplacer(false);
  };

  /** 点击画布空白区取消选中 */
  const handleCanvasClick = () => {
    setSelectedRegionIndex(null);
    setShowReplacer(false);
  };

  /** 旋转 90° */
  const handleRotate = () => {
    if (selectedRegionIndex === null) return;
    const current = regionTransforms[selectedRegionIndex];
    const prevRotation = current?.rotation ?? 0;
    setRegionTransform(selectedRegionIndex, { rotation: (prevRotation + 90) % 360 });
  };

  /** 水平翻转 */
  const handleFlipH = () => {
    if (selectedRegionIndex === null) return;
    const current = regionTransforms[selectedRegionIndex];
    setRegionTransform(selectedRegionIndex, { flipH: !(current?.flipH ?? false) });
  };

  /** 垂直翻转 */
  const handleFlipV = () => {
    if (selectedRegionIndex === null) return;
    const current = regionTransforms[selectedRegionIndex];
    setRegionTransform(selectedRegionIndex, { flipV: !(current?.flipV ?? false) });
  };

  /** 替换照片：从待选区 pendingItems 中选择 */
  const handleReplacePhoto = (pendingItem: SelectableItem) => {
    if (selectedRegionIndex === null || !template) return;
    const region = template.regions[selectedRegionIndex];
    if (!region) return;

    // 查找该 pending 项是否已在拼图列表中
    let newIdx = selectedItems.findIndex(
      (si) => si.item.id === pendingItem.item.id && si.type === pendingItem.type,
    );

    if (newIdx === -1) {
      // 不在拼图中 → 先加入（标记为 multi_selected），再更新顺序
      addToSelectedItems({
        type: pendingItem.type,
        item: { ...pendingItem.item, is_multi_selected: true },
      } as SelectableItem);
      // 新增项索引为当前拼图列表末尾
      newIdx = selectedItems.length;
    }

    const newOrder = [...order];
    newOrder[region.order] = newIdx;
    setCollagePhotoOrder(newOrder);
    setShowReplacer(false);
  };

  /** 处理生成拼图 */
  const handleGenerate = () => {
    if (!selectedTemplateId) return;

    // 收集所有 transforms（确保非空）
    const transforms: Record<number, { rotation: number; flipH: boolean; flipV: boolean }> = {};
    if (template) {
      template.regions.forEach((_, idx) => {
        const tf = regionTransforms[idx];
        transforms[idx] = {
          rotation: tf?.rotation ?? 0,
          flipH: tf?.flipH ?? false,
          flipV: tf?.flipV ?? false,
        };
      });
    }

    onGenerate(selectedTemplateId, collageGap, order, transforms, collageQuality, collageOutputSize);
  };

  // 当前选中的区域信息
  const selectedRegion = selectedRegionIndex !== null && template
    ? template.regions[selectedRegionIndex]
    : null;

  // 当前画布上已有的 photo IDs
  const usedPhotoIds = useMemo(
    () => new Set(order.map((oi) => selectedItems[oi]?.item.id).filter(Boolean)),
    [order, selectedItems],
  );

  // 当前选中的 photo (用于编辑工具栏)
  const selectedPhoto = selectedRegion
    ? selectedItems[order[selectedRegion.order]]
    : null;

  // 预估文件大小
  const estimatedSize = useMemo(
    () => estimateFileSize(collageOutputSize * collageOutputSize, collageQuality),
    [collageOutputSize, collageQuality],
  );

  return (
    <div className="flex flex-col h-full">
      {/* ── Top Bar ── */}
      <div className="h-[52px] flex items-center gap-3 px-5 border-b border-stone-200 bg-white flex-shrink-0">
        <button
          onClick={() => {
            resetRegionTransforms();
            onBack();
          }}
          className="flex items-center gap-1.5 text-sm text-stone-600 hover:text-stone-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          返回待选区
        </button>
        <span className="text-stone-200">|</span>
        <span className="text-sm font-medium text-stone-600">拼图工作区</span>
        <span className="badge badge-primary ml-2 text-xs">
          {selectedItems.length} 张照片
        </span>
        {template && (
          <span className="text-[11px] text-stone-400 ml-1">
            · {template.name}
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => {
              resetRegionTransforms();
              setCollageGap(3);
              setCollagePhotoOrder([]);
            }}
            className="btn btn-secondary btn-sm"
          >
            重置
          </button>
          <button
            onClick={handleGenerate}
            className="btn btn-primary btn-sm"
          >
            <Sparkles className="w-3.5 h-3.5" />
            生成拼图
          </button>
        </div>
      </div>

      {/* ── Main Area ── */}
      <div className="collage-layout">
        {/* Preview Canvas */}
        <div className="collage-preview">
          <div className="flex flex-col items-center gap-3">
            <div className="text-[11px] text-white/40">
              点击区域选中 · 实时编辑预览
              {selectedRegionIndex !== null && (
                <span className="ml-2 text-warmth-500">
                  已选中区域 #{selectedRegionIndex + 1}
                </span>
              )}
            </div>
            <div className="collage-canvas">
              {template ? (
                /* Template-Driven Layout */
                <div
                  className="relative w-full aspect-square cursor-pointer bg-warmth-950 rounded-xl overflow-hidden"
                  onClick={handleCanvasClick}
                >
                  {template.regions.map((region, idx) => {
                    const itemIdx = order[region.order] ?? region.order;
                    const item = selectedItems[itemIdx];
                    const imageUrl = item ? loadedImages[item.item.id] : null;
                    const padding = collageGap / 2;
                    const isSelected = selectedRegionIndex === idx;
                    const transform = getTransform(idx);

                    return (
                      <div
                        key={idx}
                        className={`absolute transition-all duration-200 ${
                          isSelected
                            ? 'ring-[3px] ring-warmth-500 ring-offset-0 z-10'
                            : ''
                        } ${!isSelected ? 'hover:ring-2 hover:ring-white/30' : ''}`}
                        style={{
                          left: `calc(${region.x * 100}% + ${padding}px)`,
                          top: `calc(${region.y * 100}% + ${padding}px)`,
                          width: `calc(${region.w * 100}% - ${collageGap}px)`,
                          height: `calc(${region.h * 100}% - ${collageGap}px)`,
                          borderRadius: '4px',
                          overflow: 'hidden',
                          background: imageUrl
                            ? undefined
                            : PREVIEW_COLORS[idx % PREVIEW_COLORS.length],
                        }}
                        onClick={(e) => handleRegionClick(idx, e)}
                      >
                        {imageUrl ? (
                          <img
                            src={imageUrl}
                            alt=""
                            className="w-full h-full object-cover pointer-events-none"
                            style={{ transform, transformOrigin: 'center center' }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <span className="text-white/20 text-sm font-bold select-none">
                              {region.order + 1}
                            </span>
                          </div>
                        )}

                        {/* 选中指示器 */}
                        {isSelected && (
                          <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-warmth-500 rounded-full flex items-center justify-center shadow-lg">
                            <span className="text-[10px] text-white font-bold">
                              {region.order + 1}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* Fallback: no template selected */
                <div className="w-full aspect-square flex items-center justify-center bg-warmth-950 rounded-xl">
                  <div className="text-center">
                    <Grid3X3 className="w-10 h-10 text-white/15 mx-auto mb-3" />
                    <p className="text-white/30 text-sm">未选择模板</p>
                    <p className="text-white/15 text-xs mt-1">请返回选择拼图模板</p>
                  </div>
                </div>
              )}
            </div>
            <div className="text-[10px] text-white/30">
              最终输出：{collageOutputSize}×{collageOutputSize} · JPG {collageQuality}%
              {' · '}预估 {estimatedSize.label}
              {template && ` · ${template.name}`}
            </div>
          </div>
        </div>

        {/* Control Sidebar */}
        <div className="collage-sidebar">
          {/* ── Region Edit Toolbar (when selected) ── */}
          {selectedRegionIndex !== null && selectedPhoto && (
            <div className="collage-section !bg-gradient-to-r !from-warmth-50 !to-rose-50 !border !border-warmth-500/20 !rounded-xl !p-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="px-1.5 py-0.5 bg-warmth-500/10 rounded text-[10px] font-bold text-warmth-500">
                  区域 #{selectedRegionIndex + 1}
                </div>
                <span className="text-[11px] text-stone-600 truncate flex-1">
                  {('file_name' in selectedPhoto.item
                    ? (selectedPhoto.item as { file_name: string }).file_name
                    : `视频截帧 #${selectedPhoto.item.id}`)}
                </span>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => setShowReplacer(true)}
                  className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-white border border-stone-200 text-[11px] text-stone-600 hover:border-warmth-500 hover:text-warmth-500 transition-colors"
                >
                  <RefreshCw className="w-3 h-3" />
                  替换照片
                </button>
                <button
                  onClick={handleRotate}
                  className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-white border border-stone-200 text-[11px] text-stone-600 hover:border-warmth-500 hover:text-warmth-500 transition-colors"
                >
                  <RotateCw className="w-3 h-3" />
                  旋转 90°
                </button>
                <button
                  onClick={handleFlipH}
                  className={`flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg border text-[11px] transition-colors ${
                    (regionTransforms[selectedRegionIndex]?.flipH)
                      ? 'bg-warmth-500/10 border-warmth-500 text-warmth-500'
                      : 'bg-white border-stone-200 text-stone-600 hover:border-warmth-500 hover:text-warmth-500'
                  }`}
                >
                  <FlipHorizontal className="w-3 h-3" />
                  水平翻转
                </button>
                <button
                  onClick={handleFlipV}
                  className={`flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg border text-[11px] transition-colors ${
                    (regionTransforms[selectedRegionIndex]?.flipV)
                      ? 'bg-warmth-500/10 border-warmth-500 text-warmth-500'
                      : 'bg-white border-stone-200 text-stone-600 hover:border-warmth-500 hover:text-warmth-500'
                  }`}
                >
                  <FlipVertical className="w-3 h-3" />
                  垂直翻转
                </button>
              </div>

              {/* Photo Replacer Mini-panel */}
              {showReplacer && (
                <div className="mt-2 border border-stone-200 rounded-lg bg-white overflow-hidden">
                  <div className="px-2.5 py-1.5 text-[10px] font-semibold text-stone-400 border-b border-stone-100">
                    从待选区选择替换照片
                  </div>
                  <div className="max-h-[160px] overflow-y-auto p-1.5">
                    <div className="grid grid-cols-4 gap-1">
                      {pendingItems.map((pendingItem) => {
                        const thumbUrl = loadedImages[pendingItem.item.id];
                        const isUsed = usedPhotoIds.has(pendingItem.item.id);
                        const displayName =
                          'file_name' in pendingItem.item
                            ? (pendingItem.item as { file_name: string }).file_name
                            : `帧 #${pendingItem.item.id}`;
                        return (
                          <button
                            key={`${pendingItem.type}-${pendingItem.item.id}`}
                            onClick={() => handleReplacePhoto(pendingItem)}
                            className={`relative aspect-square rounded overflow-hidden border-2 transition-all ${
                              isUsed
                                ? 'border-warmth-500/30 opacity-50'
                                : 'border-transparent hover:border-warmth-500'
                            }`}
                            title={displayName}
                          >
                            {thumbUrl ? (
                              <img
                                src={thumbUrl}
                                alt={displayName}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full bg-warmth-950 flex items-center justify-center">
                                <Image className="w-3 h-3 text-white/30" />
                              </div>
                            )}
                            {isUsed && (
                              <div className="absolute inset-0 flex items-center justify-center bg-warmth-500/20">
                                <span className="text-[8px] text-white font-bold">已用</span>
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    {pendingItems.length === 0 && (
                      <p className="text-[10px] text-stone-400 text-center py-4">
                        待选区暂无照片
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 选中提示（未选中时） */}
          {selectedRegionIndex === null && template && (
            <div className="collage-section !bg-gradient-to-r !from-stone-100 !to-stone-50">
              <div className="flex items-center gap-2">
                <Settings2 className="w-3.5 h-3.5 text-stone-400" />
                <span className="text-[11px] text-stone-400">
                  点击预览中的区域进行编辑
                </span>
              </div>
            </div>
          )}

          {/* Template Info */}
          {template && (
            <div className="collage-section">
              <h4>当前模板</h4>
              <div className="flex items-center gap-2 p-2 rounded-lg bg-gradient-to-r from-warmth-50 to-rose-50 border border-warmth-500/20">
                <Grid3X3 className="w-4 h-4 text-warmth-500" />
                <div>
                  <div className="text-xs font-semibold text-stone-900">{template.name}</div>
                  <div className="text-[10px] text-stone-400">{template.desc}</div>
                </div>
              </div>
              <p className="text-[10px] text-stone-600 mt-2 leading-relaxed">{template.tips}</p>
            </div>
          )}

          {/* Photo Order */}
          <div className="collage-section">
            <h4>照片顺序</h4>
            <div className="flex flex-col gap-1">
              {selectedItems.map((selItem, idx) => {
                const item = selItem.item;
                const imageUrl = loadedImages[item.id];
                // 找到该照片在模板中对应的 region
                const regionIdx = template?.regions.find(
                  (r) => r.order === idx
                );

                return (
                  <div
                    key={`${selItem.type}-${item.id}`}
                    className={`source-item-v2 cursor-pointer transition-colors ${
                      selectedRegionIndex === regionIdx?.order
                        ? 'ring-2 ring-warmth-500 bg-warmth-50'
                        : ''
                    }`}
                    onClick={() => {
                      if (regionIdx !== undefined) {
                        // 找到 region 在 regions 数组中的索引
                        const rIdx = template?.regions.findIndex(
                          (r) => r.order === regionIdx.order
                        );
                        if (rIdx !== undefined && rIdx >= 0) {
                          setSelectedRegionIndex(rIdx);
                          setShowReplacer(false);
                        }
                      }
                    }}
                  >
                    <GripVertical className="w-3.5 h-3.5 text-stone-400" />
                    <div
                      className="w-9 h-6 rounded flex-shrink-0 bg-cover bg-center"
                      style={{
                        backgroundImage: imageUrl ? `url(${imageUrl})` : undefined,
                        background: !imageUrl
                          ? 'var(--color-warmth-950)'
                          : undefined,
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] text-stone-600 truncate">
                        {'file_name' in item
                          ? (item as { file_name: string }).file_name
                          : `帧 #${item.id}`}
                      </div>
                      <div className="text-[9px] text-stone-400">
                        {selItem.type === 'photo' ? '扫描照片' : '视频截帧'}
                        {regionIdx !== undefined && (
                          <span className="ml-1">· 区域 #{idx + 1}</span>
                        )}
                      </div>
                    </div>
                    <span className="text-[9px] text-warmth-500 bg-warmth-100 px-1.5 py-0.5 rounded font-medium">
                      #{idx + 1}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Gap Control */}
          <div className="collage-section">
            <h4>间距设置</h4>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="0"
                max="16"
                value={collageGap}
                onChange={(e) => setCollageGap(Number(e.target.value))}
                className="flex-1 h-1 rounded-full appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, var(--color-brand) 0%, var(--color-brand) ${(collageGap / 16) * 100}%, var(--color-stone-100) ${(collageGap / 16) * 100}%, var(--color-stone-100) 100%)`,
                }}
              />
              <span className="text-[11px] text-stone-600 min-w-[28px]">{collageGap}px</span>
            </div>
          </div>

          {/* ── Export Settings ── */}
          <div className="collage-section">
            <div className="flex items-center justify-between mb-2">
              <h4>导出设置</h4>
              <button
                onClick={() => setShowExportSettings(!showExportSettings)}
                className="text-[10px] text-warmth-500 hover:underline"
              >
                {showExportSettings ? '收起' : '展开'}
              </button>
            </div>

            {showExportSettings && (
              <div className="space-y-3">
                {/* Quality */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] text-stone-600">清晰度</span>
                    <span className="text-[10px] font-semibold text-rose-500">
                      {QUALITY_PRESETS.find((p) => p.value === collageQuality)?.label ?? collageQuality}
                      {' '}({collageQuality}%)
                    </span>
                  </div>
                  <input
                    type="range"
                    min="60"
                    max="100"
                    step="1"
                    value={collageQuality}
                    onChange={(e) => setCollageQuality(Number(e.target.value))}
                    className="w-full h-1 rounded-full appearance-none cursor-pointer"
                    style={{
                      background: `linear-gradient(to right, var(--color-brand) 0%, var(--color-brand) ${((collageQuality - 60) / 40) * 100}%, var(--color-stone-100) ${((collageQuality - 60) / 40) * 100}%, var(--color-stone-100) 100%)`,
                    }}
                  />
                  <div className="flex justify-between mt-0.5">
                    {QUALITY_PRESETS.map((preset) => (
                      <button
                        key={preset.value}
                        onClick={() => setCollageQuality(preset.value)}
                        className={`text-[9px] px-1.5 py-0.5 rounded-full transition-colors ${
                          collageQuality === preset.value
                            ? 'bg-warmth-500 text-white'
                            : 'text-stone-400 hover:text-stone-600'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Output Size */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] text-stone-600">输出尺寸</span>
                    <span className="text-[10px] font-semibold text-stone-600">
                      {collageOutputSize}×{collageOutputSize}
                    </span>
                  </div>
                  <div className="flex gap-1.5">
                    {OUTPUT_SIZE_PRESETS.map((preset) => (
                      <button
                        key={preset.value}
                        onClick={() => setCollageOutputSize(preset.value)}
                        className={`flex-1 px-2 py-1.5 rounded-lg text-[10px] text-center border transition-all ${
                          collageOutputSize === preset.value
                            ? 'border-warmth-500 bg-warmth-50 text-rose-500 font-semibold'
                            : 'border-stone-200 bg-white text-stone-600 hover:border-warmth-500/50'
                        }`}
                      >
                        <div>{preset.label}</div>
                        <div className="text-[8px] opacity-60">{preset.value}px</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* File Size Estimate */}
                <div
                  className="flex items-center justify-between px-3 py-2 rounded-lg"
                  style={{
                    background: 'linear-gradient(135deg, rgba(245,139,61,0.06), rgba(212,77,104,0.06))',
                  }}
                >
                  <span className="text-[11px] text-stone-600">预估文件大小</span>
                  <span className="text-sm font-bold text-rose-500">
                    {estimatedSize.label}
                  </span>
                </div>

                <p className="text-[9px] text-stone-400 leading-relaxed">
                  实际文件大小可能因照片内容而异，以上为经验估算值
                </p>
              </div>
            )}

            {/* Quick display when collapsed */}
            {!showExportSettings && (
              <div className="flex items-center gap-3 text-[10px] text-stone-600">
                <span>清晰度: <strong className="text-rose-500">{QUALITY_PRESETS.find((p) => p.value === collageQuality)?.label ?? collageQuality}</strong></span>
                <span>尺寸: <strong>{collageOutputSize}px</strong></span>
                <span>预估: <strong className="text-warmth-500">{estimatedSize.label}</strong></span>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="collage-footer">
            <button
              onClick={handleGenerate}
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
