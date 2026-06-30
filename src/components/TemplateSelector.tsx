import { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, Grid3X3, Check } from 'lucide-react';
import { useAppStore } from '../store';
import {
  getTemplatesByCount,
  getTemplateById,
  type CollageRegion,
} from '../utils/collageTemplates';

interface TemplateSelectorProps {
  photoCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}

/** 预览色板 — 暖调柔和渐变 */
const PREVIEW_COLORS = [
  'linear-gradient(135deg, #fef0e0, #ffe4c8)',
  'linear-gradient(135deg, #fde8ee, #fbc1cd)',
  'linear-gradient(135deg, #e6f0fa, #c5d9f0)',
  'linear-gradient(135deg, #e2f0eb, #c0e0d5)',
  'linear-gradient(135deg, #fef8e8, #fce8c0)',
  'linear-gradient(135deg, #f4e8f0, #e8c8e0)',
  'linear-gradient(135deg, #e8f0f8, #d0e0f0)',
  'linear-gradient(135deg, #f0ece0, #e4dcc8)',
  'linear-gradient(135deg, #fce8ee, #f4c8d4)',
];

/** 渲染单个模板的缩略预览 */
function TemplateThumbnail({
  regions,
  selected,
  onClick,
}: {
  regions: CollageRegion[];
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <div
      className={`relative aspect-square rounded-xl overflow-hidden border-2 cursor-pointer transition-all duration-200 ${
        selected
          ? 'border-rose-500 shadow-[0_0_0_3px_rgba(var(--color-rose-500),0.15)] bg-gradient-to-br from-warmth-50 to-rose-50'
          : 'border-stone-200 hover:border-warmth-500 hover:-translate-y-1 hover:shadow-lg bg-stone-50'
      }`}
      onClick={onClick}
    >
      {regions.map((r, i) => (
        <div
          key={i}
          className="absolute border border-black/[0.04] flex items-center justify-center"
          style={{
            left: `${r.x * 100}%`,
            top: `${r.y * 100}%`,
            width: `${r.w * 100}%`,
            height: `${r.h * 100}%`,
            background: PREVIEW_COLORS[i % PREVIEW_COLORS.length],
          }}
        >
          <span className="text-[0.6em] font-bold text-black/15 select-none">
            {r.order + 1}
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * 拼图模板选择器 — Modal Overlay
 *
 * 交互流程:
 * 1. 显示当前照片数量，不可切换
 * 2. 展示该数量下的所有可用模板卡片
 * 3. 点击卡片选中 → 右侧预览更新
 * 4. 点击「确认」进入拼图工作区
 */
export default function TemplateSelector({
  photoCount,
  onConfirm,
  onCancel,
}: TemplateSelectorProps) {
  const { selectedTemplateId, setSelectedTemplateId } = useAppStore();

  // 当前照片数量下可用的所有模板
  const availableTemplates = useMemo(
    () => getTemplatesByCount(photoCount),
    [photoCount],
  );

  // 初始化选中状态：已选模板优先 → 第一个模板
  const [activeId, setActiveId] = useState<string>(
    selectedTemplateId && availableTemplates.some((t) => t.id === selectedTemplateId)
      ? selectedTemplateId
      : availableTemplates[0]?.id || '',
  );

  const activeTemplate = useMemo(
    () => getTemplateById(activeId),
    [activeId],
  );

  // 当照片数量变化时重置选中
  useEffect(() => {
    if (availableTemplates.length > 0) {
      setActiveId(availableTemplates[0].id);
    }
  }, [photoCount]);

  const handleConfirm = () => {
    if (activeId) {
      setSelectedTemplateId(activeId);
    }
    onConfirm();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onCancel();
    if (e.key === 'Enter') handleConfirm();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in"
      onKeyDown={handleKeyDown}
    >
      {/* Modal Container */}
      <div
        className="relative w-full max-w-[960px] max-h-[92vh] mx-4 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-stone-200 flex-shrink-0">
          <button
            onClick={onCancel}
            className="flex items-center gap-1 text-sm text-stone-600 hover:text-stone-900 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            返回
          </button>
          <span className="text-stone-200">|</span>
          <Grid3X3 className="w-4 h-4 text-warmth-500" />
          <h3 className="text-base font-semibold text-stone-900">
            选择拼图模板
          </h3>
          <span
            className="ml-auto text-xs font-semibold px-2.5 py-1 rounded-full text-rose-500"
            style={{
              background: 'linear-gradient(135deg, rgba(245,139,61,0.12), rgba(212,77,104,0.12))',
            }}
          >
            {photoCount} 张照片 · {availableTemplates.length} 个模板
          </span>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 flex min-h-0">
          {/* 左侧: 模板卡片网格 */}
          <div className="flex-1 overflow-y-auto p-5">
            {availableTemplates.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-stone-400">
                <Grid3X3 className="w-12 h-12 mb-3 opacity-30" />
                <p className="text-sm">暂无可用的拼图模板</p>
                <p className="text-xs mt-1">请选择 2–9 张照片后重试</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {availableTemplates.map((tpl) => (
                  <button
                    key={tpl.id}
                    className="text-left group"
                    onClick={() => setActiveId(tpl.id)}
                  >
                    <TemplateThumbnail
                      regions={tpl.regions}
                      selected={activeId === tpl.id}
                      onClick={() => setActiveId(tpl.id)}
                    />
                    <div className="mt-1.5 px-1">
                      <p
                        className={`text-xs font-semibold truncate transition-colors ${
                          activeId === tpl.id ? 'text-rose-500' : 'text-stone-900 group-hover:text-warmth-500'
                        }`}
                      >
                        {tpl.name}
                      </p>
                      <p className="text-[10px] text-stone-400 truncate">{tpl.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 右侧: 预览 + 详情面板 */}
          <div className="w-[300px] flex-shrink-0 border-l border-stone-200 p-5 flex flex-col bg-stone-50/80">
            {/* 大预览 */}
            <div className="aspect-square rounded-xl overflow-hidden border-2 border-stone-200 bg-white shadow-md relative mb-4">
              {activeTemplate ? (
                activeTemplate.regions.map((r, i) => (
                  <div
                    key={i}
                    className="absolute border border-black/[0.04] flex items-center justify-center"
                    style={{
                      left: `${r.x * 100}%`,
                      top: `${r.y * 100}%`,
                      width: `${r.w * 100}%`,
                      height: `${r.h * 100}%`,
                      background: PREVIEW_COLORS[i % PREVIEW_COLORS.length],
                    }}
                  >
                    <span className="text-sm font-bold text-black/12 select-none">
                      {r.order + 1}
                    </span>
                  </div>
                ))
              ) : (
                <div className="w-full h-full flex items-center justify-center text-stone-400 text-sm">
                  请选择一个模板
                </div>
              )}
            </div>

            {/* 模板信息 */}
            {activeTemplate && (
              <div className="flex-1">
                <h4 className="text-sm font-bold text-stone-900 mb-0.5">
                  {activeTemplate.name}
                </h4>
                <p className="text-xs text-stone-400 mb-3">{activeTemplate.desc}</p>
                <p className="text-[11px] text-stone-600 leading-relaxed mb-4">
                  {activeTemplate.tips}
                </p>

                {/* 区域定义列表 */}
                <h5 className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-2">
                  区域布局
                </h5>
                <div className="space-y-1 mb-4">
                  {activeTemplate.regions.map((r, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 px-2 py-1 rounded-md text-[11px] border border-stone-200 bg-white"
                    >
                      <div
                        className="w-5 h-5 rounded flex-shrink-0 flex items-center justify-center text-[8px] font-bold text-white"
                        style={{ background: PREVIEW_COLORS[i % PREVIEW_COLORS.length] }}
                      >
                        {r.order + 1}
                      </div>
                      <span className="text-stone-900">照片 #{r.order + 1}</span>
                      <span className="ml-auto text-[9px] text-stone-400 font-mono">
                        x:{(r.x * 100).toFixed(0)}% y:{(r.y * 100).toFixed(0)}%
                        {' '}w:{(r.w * 100).toFixed(0)}% h:{(r.h * 100).toFixed(0)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 确认按钮 */}
            <div className="flex gap-2 mt-auto pt-4 border-t border-stone-200">
              <button onClick={onCancel} className="btn btn-ghost btn-sm flex-1">
                取消
              </button>
              <button
                onClick={handleConfirm}
                disabled={!activeId}
                className="btn btn-primary btn-sm flex-1 !justify-center"
              >
                <Check className="w-3.5 h-3.5" />
                确认模板
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export { TemplateThumbnail, PREVIEW_COLORS };
export type { TemplateSelectorProps };
