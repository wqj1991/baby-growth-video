import { useMemo, useState, useRef, useEffect } from 'react';
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
  Move,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useAppStore } from '../store';
import { showToast } from '../store/toastStore';
import type { Thumbnail } from '../types';
import { PREVIEW_COLORS } from './TemplateSelector';
import { estimateFileSize, QUALITY_PRESETS, OUTPUT_SIZE_PRESETS, DEFAULT_TRANSFORM } from '../utils/collageTemplates';

interface CollageWorkspaceProps {
  selectedItems: Thumbnail[];
  loadedImages: Record<number, string>;
  pendingItems: Thumbnail[];
  onBack: () => void;
  onGenerate: (
    templateId: string,
    gap: number,
    order: number[],
    transforms: Record<number, { rotation: number; flipH: boolean; flipV: boolean }>,
    quality: number,
    outputSize: number,
    projectId: number,
    periodId: number,
  ) => void;
  generating: boolean;
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
  generating,
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
    currentProject,
    currentPeriod,
  } = useAppStore();

  // 照片替换面板
  const [showReplacer, setShowReplacer] = useState(false);
  // 导出设置面板
  const [showExportSettings, setShowExportSettings] = useState(false);
  // 照片顺序拖拽状态（用 ref 避免 React state 异步导致事件丢失）
  const dragIdxRef = useRef<number | null>(null);
  const dragOverIdxRef = useRef<number | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  type GesturePhase = 'idle' | 'pressing' | 'panning' | 'swapping' | 'settling';
  const [gestureState, setGestureState] = useState<{
    phase: GesturePhase;
    pointerId: number | null;
    sourceRegionIdx: number | null;
    startX: number;
    startY: number;
    startOffsetX: number;
    startOffsetY: number;
    currentX: number;
    currentY: number;
    swapCandidateRegionIdx: number | null;
  }>({
    phase: 'idle',
    pointerId: null,
    sourceRegionIdx: null,
    startX: 0,
    startY: 0,
    startOffsetX: 0,
    startOffsetY: 0,
    currentX: 0,
    currentY: 0,
    swapCandidateRegionIdx: null,
  });
  const longPressTimerRef = useRef<number | null>(null);
  // 区域元素引用（用于计算尺寸）
  const regionRefs = useRef<Record<number, HTMLDivElement | null>>({});
  // 图片尺寸缓存
  const imageSizes = useRef<Record<number, { width: number; height: number }>>({});

  // 默认按区域 order 排序的顺序
  const order = useMemo(() => {
    if (collagePhotoOrder.length > 0) return collagePhotoOrder;
    return selectedItems.map((_, i) => i);
  }, [collagePhotoOrder, selectedItems]);

  const template = selectedTemplate;

  // ── 帮助函数 ──

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

  /** 缩放照片 */
  const handleZoom = (delta: number) => {
    if (selectedRegionIndex === null) return;
    const current = regionTransforms[selectedRegionIndex] ?? DEFAULT_TRANSFORM;
    const newScale = Math.max(0.5, Math.min(3, current.scale + delta));
    setRegionTransform(selectedRegionIndex, { scale: newScale });
  };

  /** 重置位置和缩放 */
  const handleResetTransform = () => {
    if (selectedRegionIndex === null) return;
    setRegionTransform(selectedRegionIndex, {
      offsetX: 0,
      offsetY: 0,
      scale: 1,
    });
  };

  // ── 照片顺序拖拽排序 handlers ──

  const handleOrderDragStart = (index: number, e: React.DragEvent) => {
    dragIdxRef.current = index;
    setDragIdx(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
    const el = e.currentTarget as HTMLElement;
    requestAnimationFrame(() => {
      el.style.opacity = '0.4';
      el.style.transform = 'scale(0.98)';
    });
  };

  const handleOrderDragOver = (index: number, e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragIdxRef.current === null || index === dragIdxRef.current) return;
    dragOverIdxRef.current = index;
    setDragOverIdx(index);
  };

  const handleOrderDragLeave = (e: React.DragEvent) => {
    if ((e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) return;
    dragOverIdxRef.current = null;
    setDragOverIdx(null);
  };

  const handleOrderDrop = (dropIndex: number, e: React.DragEvent) => {
    e.preventDefault();
    const fromIdx = dragIdxRef.current;
    if (fromIdx === null || fromIdx === dropIndex) { resetOrderDrag(); return; }
    const slots = template
      ? template.regions
        .map((region, regionIndex) => ({ regionIndex, slotOrder: region.order }))
        .sort((a, b) => a.slotOrder - b.slotOrder)
      : selectedItems.map((_, idx) => ({ regionIndex: idx, slotOrder: idx }));

    const entries = slots
      .map((slot) => {
        const itemIdx = order[slot.slotOrder];
        const item = itemIdx !== undefined ? selectedItems[itemIdx] : undefined;
        if (!item || itemIdx === undefined) return null;
        return { ...slot, itemIdx };
      })
      .filter((entry): entry is { regionIndex: number; slotOrder: number; itemIdx: number } => Boolean(entry));

    if (fromIdx >= entries.length || dropIndex >= entries.length) {
      resetOrderDrag();
      return;
    }

    const reorderedItemIdx = entries.map((entry) => entry.itemIdx);
    const [moved] = reorderedItemIdx.splice(fromIdx, 1);
    // 右侧列表使用“插入”语义：拖到某项上方后，该项及其后续依次下移
    const insertIndex = fromIdx < dropIndex ? Math.max(0, dropIndex - 1) : dropIndex;
    reorderedItemIdx.splice(insertIndex, 0, moved);

    const newOrder = [...order];
    entries.forEach((entry, idx) => {
      newOrder[entry.slotOrder] = reorderedItemIdx[idx];
    });
    setCollagePhotoOrder(newOrder);
    resetOrderDrag();
  };

  const handleOrderDragEnd = () => { resetOrderDrag(); };
  const resetOrderDrag = () => {
    dragIdxRef.current = null;
    dragOverIdxRef.current = null;
    setDragIdx(null);
    setDragOverIdx(null);
  };

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const applyPanOffset = (
    regionIndex: number,
    startOffsetX: number,
    startOffsetY: number,
    deltaX: number,
    deltaY: number,
  ) => {
    const regionEl = regionRefs.current[regionIndex];
    if (!regionEl) {
      setRegionTransform(regionIndex, {
        offsetX: startOffsetX + deltaX,
        offsetY: startOffsetY + deltaY,
      });
      return;
    }

    const current = regionTransforms[regionIndex] ?? DEFAULT_TRANSFORM;
    const itemIdx = order[template?.regions[regionIndex]?.order ?? regionIndex];
    const item = selectedItems[itemIdx];
    const imgSize = item ? imageSizes.current[item.id] : null;

    if (imgSize && imgSize.width > 0 && imgSize.height > 0) {
      const regionWidth = regionEl.offsetWidth;
      const regionHeight = regionEl.offsetHeight;
      const scale = current.scale;

      const imgRatio = imgSize.width / imgSize.height;
      const regionRatio = regionWidth / regionHeight;

      let scaledImgWidth: number;
      let scaledImgHeight: number;

      if (imgRatio > regionRatio) {
        scaledImgHeight = regionHeight * scale;
        scaledImgWidth = scaledImgHeight * imgRatio;
      } else {
        scaledImgWidth = regionWidth * scale;
        scaledImgHeight = scaledImgWidth / imgRatio;
      }

      const maxOffsetX = Math.max(0, (scaledImgWidth - regionWidth) / 2);
      const maxOffsetY = Math.max(0, (scaledImgHeight - regionHeight) / 2);

      const newOffsetX = Math.max(-maxOffsetX, Math.min(maxOffsetX, startOffsetX + deltaX));
      const newOffsetY = Math.max(-maxOffsetY, Math.min(maxOffsetY, startOffsetY + deltaY));

      setRegionTransform(regionIndex, {
        offsetX: newOffsetX,
        offsetY: newOffsetY,
      });
      return;
    }

    setRegionTransform(regionIndex, {
      offsetX: startOffsetX + deltaX,
      offsetY: startOffsetY + deltaY,
    });
  };

  const pickSwapCandidate = (sourceRegionIdx: number, pointerX: number, pointerY: number) => {
    if (!template) return null;

    const SNAP_THRESHOLD_PX = 24;
    const SNAP_RECT_MARGIN_PX = 10;
    const candidates: Array<{ idx: number; distance: number; inside: boolean }> = [];
    template.regions.forEach((_, idx) => {
      if (idx === sourceRegionIdx) return;
      const targetItemIdx = order[template.regions[idx]?.order ?? idx];
      if (targetItemIdx === undefined) return;
      const el = regionRefs.current[idx];
      if (!el) return;

      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const distance = Math.hypot(pointerX - cx, pointerY - cy);
      const inside =
        pointerX >= rect.left - SNAP_RECT_MARGIN_PX
        && pointerX <= rect.right + SNAP_RECT_MARGIN_PX
        && pointerY >= rect.top - SNAP_RECT_MARGIN_PX
        && pointerY <= rect.bottom + SNAP_RECT_MARGIN_PX;

      if (!inside && distance > SNAP_THRESHOLD_PX) return;
      candidates.push({ idx, distance, inside });
    });

    if (candidates.length === 0) return null;
    candidates.sort((a, b) => (Number(b.inside) - Number(a.inside)) || (a.distance - b.distance) || (a.idx - b.idx));
    const nearest = candidates[0];
    if (!nearest.inside && nearest.distance > SNAP_THRESHOLD_PX) return null;
    return nearest.idx;
  };

  const startRegionPointerGesture = (regionIndex: number, e: React.PointerEvent<HTMLDivElement>) => {
    const itemIdx = order[template?.regions[regionIndex]?.order ?? regionIndex];
    if (itemIdx === undefined) return;

    const current = regionTransforms[regionIndex] ?? DEFAULT_TRANSFORM;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    setSelectedRegionIndex(regionIndex);
    setShowReplacer(false);

    clearLongPressTimer();
    setGestureState({
      phase: 'pressing',
      pointerId: e.pointerId,
      sourceRegionIdx: regionIndex,
      startX: e.clientX,
      startY: e.clientY,
      startOffsetX: current.offsetX,
      startOffsetY: current.offsetY,
      currentX: e.clientX,
      currentY: e.clientY,
      swapCandidateRegionIdx: null,
    });

    longPressTimerRef.current = window.setTimeout(() => {
      setGestureState((prev) => {
        if (prev.phase !== 'pressing' || prev.sourceRegionIdx !== regionIndex) {
          return prev;
        }
        const moved = Math.hypot(prev.currentX - prev.startX, prev.currentY - prev.startY);
        if (moved > 4) return prev;
        return { ...prev, phase: 'swapping' };
      });
    }, 300);
  };

  const moveRegionPointerGesture = (regionIndex: number, e: React.PointerEvent<HTMLDivElement>) => {
    const prev = gestureState;
    if (prev.pointerId !== e.pointerId || prev.sourceRegionIdx !== regionIndex) {
      return;
    }

    const next = { ...prev, currentX: e.clientX, currentY: e.clientY };
    const deltaX = e.clientX - prev.startX;
    const deltaY = e.clientY - prev.startY;
    const moveDistance = Math.hypot(deltaX, deltaY);

    if (next.phase === 'pressing' && moveDistance > 4) {
      clearLongPressTimer();
      applyPanOffset(regionIndex, prev.startOffsetX, prev.startOffsetY, deltaX, deltaY);
      setGestureState({ ...next, phase: 'panning' });
      return;
    }

    if (next.phase === 'panning') {
      applyPanOffset(regionIndex, prev.startOffsetX, prev.startOffsetY, deltaX, deltaY);
      setGestureState(next);
      return;
    }

    if (next.phase === 'swapping') {
      setGestureState({
        ...next,
        swapCandidateRegionIdx: pickSwapCandidate(regionIndex, e.clientX, e.clientY),
      });
      return;
    }

    setGestureState(next);
  };

  const endRegionPointerGesture = (regionIndex: number, e: React.PointerEvent<HTMLDivElement>) => {
    const prev = gestureState;
    if (prev.pointerId !== e.pointerId || prev.sourceRegionIdx !== regionIndex) {
      return;
    }

    if (prev.phase === 'swapping' && prev.swapCandidateRegionIdx !== null && template) {
      const fromOrder = template.regions[regionIndex]?.order;
      const toOrder = template.regions[prev.swapCandidateRegionIdx]?.order;
      if (fromOrder !== undefined && toOrder !== undefined && fromOrder !== toOrder) {
        const newOrder = [...order];
        const temp = newOrder[fromOrder];
        newOrder[fromOrder] = newOrder[toOrder];
        newOrder[toOrder] = temp;
        setCollagePhotoOrder(newOrder);
      }
    }

    setGestureState({
      phase: 'idle',
      pointerId: null,
      sourceRegionIdx: null,
      startX: 0,
      startY: 0,
      startOffsetX: 0,
      startOffsetY: 0,
      currentX: 0,
      currentY: 0,
      swapCandidateRegionIdx: null,
    });

    clearLongPressTimer();
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
  };

  /** 图片加载完成时记录尺寸 */
  const handleImageLoad = (itemId: number, e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    imageSizes.current[itemId] = {
      width: img.naturalWidth,
      height: img.naturalHeight,
    };
  };

  useEffect(() => () => {
    clearLongPressTimer();
  }, []);

  /** 替换照片：从待选区 pendingItems 中选择 */
  const handleReplacePhoto = (pendingItem: Thumbnail) => {
    if (selectedRegionIndex === null || !template) return;
    const region = template.regions[selectedRegionIndex];
    if (!region) return;

    let newIdx = selectedItems.findIndex(
      (si) => si.id === pendingItem.id,
    );

    if (newIdx === -1) {
      return;
    }

    const newOrder = [...order];
    newOrder[region.order] = newIdx;
    setCollagePhotoOrder(newOrder);
    setShowReplacer(false);
  };

  /** 处理生成拼图 */
  const handleGenerate = () => {
    if (!selectedTemplateId) return;
    if (!currentProject || !currentPeriod) {
      showToast?.('error', '项目或周期未选择', '无法生成拼图');
      return;
    }

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

    onGenerate(selectedTemplateId, collageGap, order, transforms, collageQuality, collageOutputSize, currentProject.id, currentPeriod.id);
  };

  // 当前选中的区域信息
  const selectedRegion = selectedRegionIndex !== null && template
    ? template.regions[selectedRegionIndex]
    : null;

  // 当前画布上已有的 photo IDs
  const usedPhotoIds = useMemo(
    () => new Set(order.map((oi) => selectedItems[oi]?.id).filter(Boolean)),
    [order, selectedItems],
  );

  // 当前选中的 photo (用于编辑工具栏)
  const selectedPhoto = selectedRegion
    ? selectedItems[order[selectedRegion.order]]
    : null;

  // 右侧列表项与左侧画布保持一致（仅显示画布实际有图的格子）
  const rightPanelEntries = useMemo(() => {
    const slots = template
      ? template.regions
        .map((region, regionIndex) => ({ regionIndex, slotOrder: region.order }))
        .sort((a, b) => a.slotOrder - b.slotOrder)
      : selectedItems.map((_, idx) => ({ regionIndex: idx, slotOrder: idx }));

    return slots
      .map((slot) => {
        const itemIdx = order[slot.slotOrder];
        const item = itemIdx !== undefined ? selectedItems[itemIdx] : undefined;
        if (!item || itemIdx === undefined) return null;
        return {
          key: `${item.source_type}-${item.id}-${slot.regionIndex}`,
          regionIndex: slot.regionIndex,
          slotOrder: slot.slotOrder,
          item,
          itemIdx,
        };
      })
      .filter((entry): entry is {
        key: string;
        regionIndex: number;
        slotOrder: number;
        item: Thumbnail;
        itemIdx: number;
      } => Boolean(entry));
  }, [template, selectedItems, order]);

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
          {rightPanelEntries.length} 张照片
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
            disabled={generating}
          >
            {generating ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                生成中...
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                生成拼图
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── Main Area ── */}
      <div className="collage-layout">
        {/* Preview Canvas */}
        <div className="collage-preview">
            <div className="flex flex-col items-center gap-3">
            <div className="text-[11px] text-white/40">
              短按拖拽调整位置 · 长按 0.3s 后拖拽可换位
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
                    const imageUrl = item ? loadedImages[item.id] : null;
                    const padding = collageGap / 2;
                    const isSelected = selectedRegionIndex === idx;
                    const currentTf = regionTransforms[idx] ?? DEFAULT_TRANSFORM;
                    const hasTransform = currentTf.offsetX !== 0 || currentTf.offsetY !== 0 || currentTf.scale !== 1;
                    const isSwapSource = gestureState.phase === 'swapping' && gestureState.sourceRegionIdx === idx;
                    const isSwapCandidate = gestureState.phase === 'swapping' && gestureState.swapCandidateRegionIdx === idx;
                    const gestureDeltaX = gestureState.currentX - gestureState.startX;
                    const gestureDeltaY = gestureState.currentY - gestureState.startY;

                    return (
                      <div
                        key={idx}
                        ref={(el) => { regionRefs.current[idx] = el; }}
                        data-region-idx={idx}
                        className={`absolute transition-all duration-200 ${
                          isSelected
                            ? 'ring-[3px] ring-warmth-500 ring-offset-0 z-10'
                            : ''
                        } ${!isSelected ? 'hover:ring-2 hover:ring-white/30' : ''} ${
                          isSwapCandidate
                            ? 'ring-[3px] ring-warmth-500 bg-warmth-500/20'
                            : ''
                        }`}
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
                          cursor: imageUrl ? 'grab' : 'pointer',
                          transform: isSwapSource
                            ? `translate(${gestureDeltaX}px, ${gestureDeltaY}px) scale(1.04)`
                            : undefined,
                          border: isSwapSource ? '2px dashed rgba(245, 139, 61, 0.9)' : undefined,
                          boxShadow: isSwapSource ? '0 14px 28px rgba(0, 0, 0, 0.28)' : undefined,
                          opacity: isSwapSource ? 0.9 : undefined,
                          zIndex: isSwapSource ? 30 : undefined,
                          transition: gestureState.phase === 'idle' ? 'transform 0.18s ease, box-shadow 0.18s ease' : undefined,
                        }}
                        onClick={(e) => handleRegionClick(idx, e)}
                        onPointerDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (!imageUrl) return;
                          startRegionPointerGesture(idx, e);
                        }}
                        onPointerMove={(e) => {
                          if (!imageUrl) return;
                          moveRegionPointerGesture(idx, e);
                        }}
                        onPointerUp={(e) => {
                          if (!imageUrl) return;
                          endRegionPointerGesture(idx, e);
                        }}
                        onPointerCancel={(e) => {
                          if (!imageUrl) return;
                          endRegionPointerGesture(idx, e);
                        }}
                      >
                        {imageUrl ? (
                          <div className="w-full h-full relative overflow-hidden">
                            <img
                              src={imageUrl}
                              alt=""
                              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 select-none"
                              style={{
                                minWidth: '100%',
                                minHeight: '100%',
                                maxWidth: 'none',
                                maxHeight: 'none',
                                objectFit: 'cover',
                                width: hasTransform ? 'auto' : '100%',
                                height: hasTransform ? '100%' : '100%',
                                transform: hasTransform
                                  ? `translate(calc(-50% + ${currentTf.offsetX}px), calc(-50% + ${currentTf.offsetY}px)) scale(${currentTf.scale})`
                                  : 'translate(-50%, -50%)',
                                transformOrigin: 'center center',
                                userSelect: 'none',
                                pointerEvents: 'none',
                              }}
                              onLoad={(e) => handleImageLoad(item.id, e)}
                              draggable={false}
                            />
                          </div>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <span className="text-white/20 text-sm font-bold select-none">
                              {region.order + 1}
                            </span>
                          </div>
                        )}

                        {/* 选中指示器 */}
                        {isSelected && (
                          <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-warmth-500 rounded-full flex items-center justify-center shadow-lg z-10">
                            <span className="text-[10px] text-white font-bold">
                              {region.order + 1}
                            </span>
                          </div>
                        )}

                        {/* 拖拽提示 */}
                        {isSelected && imageUrl && (
                          <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-black/60 rounded text-[9px] text-white/80 pointer-events-none z-10 whitespace-nowrap">
                            {isSwapSource ? '换位拖拽中...' : '短按拖拽调整位置 · 长按进入换位'}
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
                  {selectedPhoto.original_file_name}
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

              {/* 缩放和位置控制 */}
              <div className="mt-2 pt-2 border-t border-stone-200/60">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] text-stone-500 flex items-center gap-1">
                    <Move className="w-3 h-3" />
                    位置 & 缩放
                  </span>
                  <button
                    onClick={handleResetTransform}
                    className="text-[10px] text-warmth-500 hover:underline"
                  >
                    重置
                  </button>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleZoom(-0.1)}
                    className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-white border border-stone-200 text-stone-600 hover:border-warmth-500 hover:text-warmth-500 transition-colors"
                  >
                    <ZoomOut className="w-3 h-3" />
                  </button>
                  <span className="text-[10px] text-stone-500 min-w-[40px] text-center font-medium">
                    {Math.round((regionTransforms[selectedRegionIndex]?.scale ?? 1) * 100)}%
                  </span>
                  <button
                    onClick={() => handleZoom(0.1)}
                    className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-white border border-stone-200 text-stone-600 hover:border-warmth-500 hover:text-warmth-500 transition-colors"
                  >
                    <ZoomIn className="w-3 h-3" />
                  </button>
                </div>
                <p className="text-[9px] text-stone-400 mt-1 text-center">
                  选中照片后可拖拽调整位置
                </p>
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
                        const thumbUrl = loadedImages[pendingItem.id];
                        const isUsed = usedPhotoIds.has(pendingItem.id);
                        const displayName = pendingItem.original_file_name;
                        return (
                          <button
                            key={`${pendingItem.source_type}-${pendingItem.id}`}
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
            <p className="text-[10px] text-stone-400 mb-2">拖拽排序 · 也可直接在画布中拖拽照片到另一区域</p>
            <div className="flex flex-col gap-1">
              {rightPanelEntries.map((entry, idx) => {
                const selItem = entry.item;
                const imageUrl = loadedImages[selItem.id];
                const isDragging = dragIdx === idx;
                const isDragOver = dragOverIdx === idx;
                const isBetween = dragOverIdx !== null && dragIdx !== null
                  && ((dragIdx < dragOverIdx && idx > dragIdx && idx <= dragOverIdx)
                    || (dragIdx > dragOverIdx && idx >= dragOverIdx && idx < dragIdx));

                return (
                  <div
                    key={`${selItem.source_type}-${selItem.id}`}
                    draggable={true}
                    onDragStart={(e) => handleOrderDragStart(idx, e)}
                    onDragOver={(e) => handleOrderDragOver(idx, e)}
                    onDragLeave={(e) => handleOrderDragLeave(e)}
                    onDrop={(e) => handleOrderDrop(idx, e)}
                    onDragEnd={handleOrderDragEnd}
                    className={`source-item-v2 cursor-grab active:cursor-grabbing transition-all ${
                      selectedRegionIndex === entry.regionIndex
                        ? 'ring-2 ring-warmth-500 bg-warmth-50'
                        : ''
                    } ${
                      isDragging ? 'opacity-40 scale-[0.98]' : ''
                    } ${
                      isDragOver ? 'ring-2 ring-primary-500 bg-primary-50 border-dashed' : ''
                    } ${
                      isBetween ? 'transform -translate-y-1' : ''
                    }`}
                    onClick={() => {
                      setSelectedRegionIndex(entry.regionIndex);
                      setShowReplacer(false);
                    }}
                  >
                    <GripVertical className={`w-3.5 h-3.5 transition-colors cursor-grab active:cursor-grabbing ${
                      isDragging ? 'text-primary-500' : 'text-stone-400 hover:text-stone-600'
                    }`} />
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
                        {selItem.original_file_name}
                      </div>
                      <div className="text-[9px] text-stone-400">
                        {selItem.source_type === 'scan' ? '扫描照片' : selItem.source_type === 'video_frame' ? '视频截帧' : '拼图'}
                        <span className="ml-1">· 区域 #{entry.slotOrder + 1}</span>
                      </div>
                    </div>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${
                      isDragging
                        ? 'text-primary-600 bg-primary-100 border-primary-200'
                        : 'text-warmth-800 bg-warmth-100 border-warmth-200'
                    }`}>
                      #{entry.slotOrder + 1}
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
              disabled={generating}
            >
              {generating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  生成中...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  生成拼图
                </>
              )}
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
