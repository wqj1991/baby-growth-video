import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Baby, Calendar, Image, Clock, Play, Video, History, ChevronRight } from 'lucide-react';
import { useAppStore } from '../store';
import { getPeriods } from '../utils/tauriCommands';
import type { Period } from '../types';

export default function ProjectOverviewPage() {
  const navigate = useNavigate();
  const { currentProject, currentBaby } = useAppStore();
  const [periods, setPeriods] = useState<Period[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentProject) {
      loadPeriods();
    }
  }, [currentProject]);

  const loadPeriods = async () => {
    if (!currentProject) return;
    try {
      const data = await getPeriods(currentProject.id);
      setPeriods(data);
    } catch (error) {
      console.error('加载周期失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectedCount = periods.filter((p) => p.selected_photo_id).length;
  const totalCount = periods.length;
  const progressPercent =
    totalCount > 0 ? Math.round((selectedCount / totalCount) * 100) : 0;
  const remainingCount = totalCount - selectedCount;

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-center py-12 text-gray-500">加载中...</div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-8">
      {/* 基础信息卡片 */}
      <div className="bg-gradient-to-r from-primary-500 to-primary-600 rounded-xl p-6 text-white mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-1">{currentProject?.name}</h1>
            <p className="text-primary-100">
              {currentProject?.description || '暂无描述'}
            </p>
          </div>
          <div className="flex items-center gap-2 bg-white/20 rounded-lg px-3 py-1.5">
            <Baby className="w-4 h-4" />
            <span className="text-sm font-medium">{currentBaby?.name}</span>
          </div>
        </div>
        <div className="flex gap-6 mt-4 text-sm">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-4 h-4 opacity-80" />
            <span>周期：{currentProject?.period_days}天</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="w-4 h-4 opacity-80" />
            <span>创建于 {currentProject?.created_at?.split('T')[0]}</span>
          </div>
        </div>
      </div>

      {/* 数据统计卡片 */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="card">
          <div className="card-body">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <div className="w-5 h-5 text-blue-600">📊</div>
              </div>
              <span className="text-gray-600">完成进度</span>
            </div>
            <p className="text-3xl font-bold text-gray-900 mb-2">
              {progressPercent}%
            </p>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                <Image className="w-5 h-5 text-green-600" />
              </div>
              <span className="text-gray-600">已选照片</span>
            </div>
            <p className="text-3xl font-bold text-gray-900">
              {selectedCount}
              <span className="text-lg font-normal text-gray-400">
                {' '}
                / {totalCount}
              </span>
            </p>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                <Clock className="w-5 h-5 text-orange-600" />
              </div>
              <span className="text-gray-600">剩余周期</span>
            </div>
            <p className="text-3xl font-bold text-gray-900">{remainingCount}</p>
          </div>
        </div>
      </div>

      {/* 快捷操作 */}
      <div className="card mb-6">
        <div className="card-header">
          <h2 className="text-lg font-semibold">快捷操作</h2>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-3 gap-4">
            <button
              onClick={() => navigate('periods')}
              className="p-4 rounded-xl bg-primary-50 hover:bg-primary-100 transition-colors text-left group"
            >
              <div className="w-12 h-12 rounded-lg bg-primary-500 text-white flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                <Image className="w-6 h-6" />
              </div>
              <h3 className="font-semibold text-gray-900">开始选照片</h3>
              <p className="text-sm text-gray-500 mt-1">为每个周期选择代表照片</p>
            </button>

            <button
              onClick={() => navigate('generate')}
              className="p-4 rounded-xl bg-green-50 hover:bg-green-100 transition-colors text-left group"
            >
              <div className="w-12 h-12 rounded-lg bg-green-500 text-white flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                <Video className="w-6 h-6" />
              </div>
              <h3 className="font-semibold text-gray-900">生成视频</h3>
              <p className="text-sm text-gray-500 mt-1">配置并生成成长视频</p>
            </button>

            <button
              onClick={() => navigate('history')}
              className="p-4 rounded-xl bg-purple-50 hover:bg-purple-100 transition-colors text-left group"
            >
              <div className="w-12 h-12 rounded-lg bg-purple-500 text-white flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                <History className="w-6 h-6" />
              </div>
              <h3 className="font-semibold text-gray-900">历史记录</h3>
              <p className="text-sm text-gray-500 mt-1">查看已生成的视频</p>
            </button>
          </div>
        </div>
      </div>

      {/* 周期概览 */}
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <h2 className="text-lg font-semibold">周期概览</h2>
          <button
            onClick={() => navigate('periods')}
            className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
          >
            查看全部
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-6 gap-3">
            {periods.slice(0, 12).map((period, index) => {
              const isSelected = !!period.selected_photo_id;
              return (
                <div
                  key={period.id}
                  className={`aspect-square rounded-lg flex flex-col items-center justify-center text-center p-2 ${
                    isSelected
                      ? 'bg-green-50 border-2 border-green-200'
                      : 'bg-gray-50 border-2 border-transparent'
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center mb-1 ${
                      isSelected
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-200 text-gray-500'
                    }`}
                  >
                    {isSelected ? (
                      <Play className="w-4 h-4" />
                    ) : (
                      <span className="text-xs font-medium">{index + 1}</span>
                    )}
                  </div>
                  <span className="text-xs text-gray-600 truncate w-full">
                    {period.name || `第${index + 1}周`}
                  </span>
                </div>
              );
            })}
          </div>
          {periods.length > 12 && (
            <p className="text-center text-sm text-gray-400 mt-4">
              还有 {periods.length - 12} 个周期...
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
