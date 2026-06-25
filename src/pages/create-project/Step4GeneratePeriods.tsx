import { useState } from 'react';
import { Calendar, RefreshCw, Star, CheckCircle } from 'lucide-react';
import { useCreateProjectStore } from '../../store/createProjectStore';
import { generatePeriods } from '../../utils/tauriCommands';
import type { Period } from '../../types';

const specialPeriodNames = ['满月', '百天', '半岁', '一岁', '周岁'];

export default function Step4GeneratePeriods() {
  const {
    selectedBaby,
    periodDays,
    includeSpecialDates,
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
        periodDays
      );
      setPeriods(result);
    } catch (error) {
      console.error('生成周期失败:', error);
      alert('生成周期失败，请重试');
    } finally {
      setIsGeneratingPeriods(false);
    }
  };

  const isSpecialPeriod = (period: Period) => {
    return specialPeriodNames.some((name) => period.name?.includes(name));
  };

  return (
    <div className="p-8 max-w-2xl">
      <h2 className="text-xl font-bold mb-2">生成周期</h2>
      <p className="text-gray-500 mb-6">
        根据宝宝出生日期和周期设置，自动生成成长周期
      </p>

      {/* 设置摘要 */}
      <div className="bg-gray-50 rounded-lg p-4 mb-6">
        <h3 className="font-medium text-gray-900 mb-3">周期设置</h3>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-gray-500">出生日期：</span>
            <span className="font-medium text-gray-900">
              {selectedBaby?.birth_date || '-'}
            </span>
          </div>
          <div>
            <span className="text-gray-500">周期：</span>
            <span className="font-medium text-gray-900">{periodDays} 天</span>
          </div>
          <div>
            <span className="text-gray-500">特殊日期：</span>
            <span className="font-medium text-gray-900">
              {includeSpecialDates ? '包含' : '不包含'}
            </span>
          </div>
        </div>
      </div>

      {/* 生成按钮 */}
      {periods.length === 0 && (
        <button
          onClick={handleGenerate}
          disabled={isGeneratingPeriods || !selectedBaby}
          className={`btn btn-primary w-full ${
            isGeneratingPeriods ? 'opacity-75' : ''
          }`}
        >
          {isGeneratingPeriods ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              生成中...
            </>
          ) : (
            <>
              <Calendar className="w-4 h-4" />
              生成周期
            </>
          )}
        </button>
      )}

      {/* 周期列表 */}
      {periods.length > 0 && (
        <div className="bg-gray-50 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-500" />
                周期生成完成
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                共生成 {periods.length} 个周期
              </p>
            </div>
            <button
              onClick={handleGenerate}
              disabled={isGeneratingPeriods}
              className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
            >
              <RefreshCw
                className={`w-4 h-4 ${isGeneratingPeriods ? 'animate-spin' : ''}`}
              />
              重新生成
            </button>
          </div>

          {/* 周期概览（折叠/展开） */}
          <div className="bg-white rounded-lg border border-gray-200">
            <button
              onClick={() => setExpanded(!expanded)}
              className="w-full px-4 py-3 flex items-center justify-between text-left"
            >
              <span className="text-sm font-medium text-gray-700">
                查看周期列表 ({periods.length} 个)
              </span>
              <span className="text-gray-400">{expanded ? '收起' : '展开'}</span>
            </button>

            {expanded && (
              <div className="border-t border-gray-200 max-h-64 overflow-y-auto">
                {periods.map((period, index) => {
                  const isSpecial = isSpecialPeriod(period);
                  return (
                    <div
                      key={period.id || index}
                      className={`px-4 py-3 border-b border-gray-100 last:border-b-0 flex items-center justify-between ${
                        isSpecial ? 'bg-yellow-50' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900">
                          {period.name || `第${index + 1}周期`}
                        </span>
                        {isSpecial && (
                          <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded-full flex items-center gap-1">
                            <Star className="w-3 h-3" />
                            特殊
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-gray-500">
                        {period.start_date} ~ {period.end_date}
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
