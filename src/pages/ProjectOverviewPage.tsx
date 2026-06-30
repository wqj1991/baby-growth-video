import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Baby, Calendar, Image, Clock, Video, History } from 'lucide-react';
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

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-center py-12 text-stone-500">加载中...</div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-8">
      {/* 基础信息卡片 */}
      <div className="bg-gradient-to-r from-primary-500 to-primary-600 rounded-xl p-6 text-white mb-8">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold mb-1 truncate">{currentProject?.name}</h1>
            <p className="text-primary-100 text-sm">
              {currentProject?.description || '暂无描述'}
            </p>
          </div>
          <div className="flex items-center gap-2 bg-white/20 rounded-lg px-3 py-1.5 ml-4 flex-shrink-0">
            <Baby className="w-4 h-4" />
            <span className="text-sm font-medium">{currentBaby?.name}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-5 mt-4 pt-4 border-t border-white/15 text-sm">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-4 h-4 opacity-80" />
            <span>周期：{currentProject?.period_days} 天</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="w-4 h-4 opacity-80" />
            <span>创建于 {currentProject?.created_at?.split('T')[0]}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Image className="w-4 h-4 opacity-80" />
            <span>
              已选 {selectedCount}/{totalCount} 张照片
            </span>
          </div>
          {totalCount > 0 && (
            <div className="flex items-center gap-2">
              <div className="w-24 h-1.5 bg-white/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white rounded-full transition-all duration-500"
                  style={{ width: `${Math.round((selectedCount / totalCount) * 100)}%` }}
                />
              </div>
              <span className="text-xs opacity-70">
                {Math.round((selectedCount / totalCount) * 100)}%
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 快捷操作 */}
      <div className="card">
        <div className="card-header">
          <h2 className="text-lg font-semibold">快捷操作</h2>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-3 gap-4">
            <button
              onClick={() => navigate('periods')}
              className="p-5 rounded-xl bg-primary-50 hover:bg-primary-100 transition-all text-left group border border-transparent hover:border-primary-200"
            >
              <div className="w-12 h-12 rounded-lg bg-primary-500 text-white flex items-center justify-center mb-3 group-hover:scale-105 transition-transform shadow-sm">
                <Image className="w-6 h-6" />
              </div>
              <h3 className="font-semibold text-stone-900">开始选照片</h3>
              <p className="text-sm text-stone-500 mt-1">为每个周期选择代表照片</p>
            </button>

            <button
              onClick={() => navigate('generate')}
              className="p-5 rounded-xl bg-success-bg hover:bg-success-bg/60 transition-all text-left group border border-transparent hover:border-success-border"
            >
              <div className="w-12 h-12 rounded-lg bg-success text-white flex items-center justify-center mb-3 group-hover:scale-105 transition-transform shadow-sm">
                <Video className="w-6 h-6" />
              </div>
              <h3 className="font-semibold text-stone-900">生成视频</h3>
              <p className="text-sm text-stone-500 mt-1">配置并生成成长视频</p>
            </button>

            <button
              onClick={() => navigate('history')}
              className="p-5 rounded-xl bg-stash-bg hover:bg-stash-bg/60 transition-all text-left group border border-transparent hover:border-stash-border"
            >
              <div className="w-12 h-12 rounded-lg bg-stash text-white flex items-center justify-center mb-3 group-hover:scale-105 transition-transform shadow-sm">
                <History className="w-6 h-6" />
              </div>
              <h3 className="font-semibold text-stone-900">历史记录</h3>
              <p className="text-sm text-stone-500 mt-1">查看已生成的视频</p>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
