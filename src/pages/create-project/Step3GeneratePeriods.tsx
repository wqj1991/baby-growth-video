import { useState } from 'react';
import { Calendar, RefreshCw, Star, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { useCreateProjectStore } from '../../store/createProjectStore';
import { generatePeriods } from '../../utils/tauriCommands';
import { showToast } from '../../store/toastStore';
import type { Period } from '../../types';

const specialPeriodNames = ['满月', '百天', '半岁', '一岁', '周岁'];

export default function Step3GeneratePeriods() {
  const {
    selectedBaby,
    periodDays,
    includeSpecialDates,
    endDate,
    periods,
    isGeneratingPeriods,
    projectId,
    setPeriods,
    setIsGeneratingPeriods,
  } = useCreateProjectStore();

  const [expanded, setExpanded] = useState(false);

  const handleGenerate = async () => {
    if (!selectedBaby) return;
    setIsGeneratingPeriods(true);
    try {
      const result: Period[] = await generatePeriods(
        projectId || 0,
        selectedBaby.birth_date,
        periodDays,
        endDate
      );
      setPeriods(result);
    } catch (error) {
      console.error('生成周期失败:', error);
      showToast('error', '生成周期失败', '请重试');
    } finally {
      setIsGeneratingPeriods(false);
    }
  };

  const isSpecialPeriod = (period: Period) => {
    return specialPeriodNames.some((name) => period.name?.includes(name));
  };

  return (
    <div className="p-10 max-w-3xl mx-auto animate-fade-in-up">
      {/* 页面标题区 */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-warmth-400/12 to-warmth-500/8 flex items-center justify-center">
            <Calendar className="w-5 h-5 text-warmth-500" strokeWidth={1.8} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-stone-800 tracking-tight">生成周期</h2>
            <p className="text-sm text-stone-500 mt-0.5">根据宝宝出生日期自动生成成长节点</p>
          </div>
        </div>
      </div>

      {/* 设置摘要卡片 */}
      <div className="card p-6 mb-8">
        <h3 className="text-sm font-semibold text-stone-700 mb-4">周期参数</h3>
        <div className="grid grid-cols-3 gap-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-stone-100 flex items-center justify-center">
              <Calendar className="w-4 h-4 text-stone-500" />
            </div>
            <div>
              <p className="text-xs text-stone-400">出生日期</p>
              <p className="text-sm font-semibold text-stone-700">{selectedBaby?.birth_date || '-'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-warmth-100 flex items-center justify-center">
              <RefreshCw className="w-4 h-4 text-warmth-500" />
            </div>
            <div>
              <p className="text-xs text-stone-400">周期间隔</p>
              <p className="text-sm font-semibold text-warmth-600">{periodDays} 天</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-warning-bg flex items-center justify-center">
              <Star className="w-4 h-4 text-warning" />
            </div>
            <div>
              <p className="text-xs text-stone-400">特殊日期</p>
              <p className="text-sm font-semibold text-stone-700">
                {includeSpecialDates ? '包含' : '不包含'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 生成按钮 */}
      {periods.length === 0 && (
        <button
          onClick={handleGenerate}
          disabled={isGeneratingPeriods || !selectedBaby}
          className="btn btn-primary btn-lg w-full justify-center text-base"
        >
          {isGeneratingPeriods ? (
            <>
              <RefreshCw className="w-5 h-5 animate-spin" />
              生成中...
            </>
          ) : (
            <>
              <Calendar className="w-5 h-5" />
              开始生成周期
            </>
          )}
        </button>
      )}

      {/* 周期列表 */}
      {periods.length > 0 && (
        <div className="card p-0 overflow-hidden">
          <div className="p-6 bg-gradient-to-r from-success-bg/60 to-transparent">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-success-bg flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-success" />
                </div>
                <div>
                  <h3 className="font-bold text-stone-800">生成完成</h3>
                  <p className="text-xs text-stone-500">共 {periods.length} 个成长周期</p>
                </div>
              </div>
              <button
                onClick={handleGenerate}
                disabled={isGeneratingPeriods}
                className="text-sm text-warmth-500 hover:text-warmth-600 font-medium flex items-center gap-1.5 transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${isGeneratingPeriods ? 'animate-spin' : ''}`} />
                重新生成
              </button>
            </div>
          </div>

          {/* 可折叠周期列表 */}
          <div className="border-t border-stone-100">
            <button
              onClick={() => setExpanded(!expanded)}
              className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-stone-50/50 transition-colors"
            >
              <span className="text-sm font-semibold text-stone-600">
                查看周期列表 <span className="text-stone-400 font-normal ml-1">({periods.length})</span>
              </span>
              {expanded ? (
                <ChevronUp className="w-4 h-4 text-stone-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-stone-400" />
              )}
            </button>

            {expanded && (
              <div className="max-h-72 overflow-y-auto">
                {periods.map((period, index) => {
                  const isSpecial = isSpecialPeriod(period);
                  return (
                    <div
                      key={period.id || index}
                      className={`px-6 py-3.5 flex items-center justify-between border-t border-stone-50 transition-colors hover:bg-stone-50/30 ${
                        isSpecial ? 'bg-warning-bg/40' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                            isSpecial
                              ? 'bg-gradient-to-br from-amber-300 to-amber-400 text-white shadow-sm shadow-amber-300/30'
                              : 'bg-stone-100 text-stone-500'
                          }`}
                        >
                          {index + 1}
                        </span>
                        <span className="text-sm font-medium text-stone-700">
                          {period.name || `第${index + 1}周期`}
                        </span>
                        {isSpecial && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-warning-bg text-warning-text text-[11px] font-medium">
                            <Star className="w-3 h-3 fill-warning text-warning" />
                            特殊
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-stone-400 font-mono">
                        {period.start_date} — {period.end_date}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
