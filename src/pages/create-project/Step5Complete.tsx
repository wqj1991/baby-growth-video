import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Baby, Calendar, Image, ArrowRight, Play } from 'lucide-react';
import { useCreateProjectStore } from '../../store/createProjectStore';
import { useAppStore } from '../../store';
import { getProjects } from '../../utils/tauriCommands';
import type { Project } from '../../types';

export default function Step5Complete() {
  const navigate = useNavigate();
  const {
    selectedBaby, projectName, projectId, scanResult, periods, reset,
  } = useCreateProjectStore();
  const { setCurrentProject, setCurrentBaby, setPeriods } = useAppStore();
  const [createdProject, setCreatedProject] = useState<Project | null>(null);

  useEffect(() => {
    loadProject();
  }, []);

  const loadProject = async () => {
    if (!selectedBaby || !projectId) return;
    try {
      const projects = await getProjects(selectedBaby.id);
      const project = projects.find((p) => p.id === projectId);
      if (project) {
        setCreatedProject(project);
        setCurrentProject(project);
        setCurrentBaby(selectedBaby);
        if (periods.length > 0) {
          setPeriods(periods);
        }
      }
    } catch (err) {
      console.error('加载项目失败:', err);
    }
  };

  const handleGoToOverview = () => {
    if (createdProject) {
      reset();
      navigate(`/project/${createdProject.id}/overview`);
    }
  };

  const handleGoToPeriods = () => {
    if (createdProject) {
      reset();
      navigate(`/project/${createdProject.id}/periods`);
    }
  };

  return (
    <div className="p-10 max-w-lg mx-auto animate-fade-in-scale">
      {/* 成功动画区 */}
      <div className="text-center py-8">
        <div className="relative inline-block mb-6">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-success-bg to-success-bg flex items-center justify-center">
            <CheckCircle2 className="w-12 h-12 text-success" />
          </div>
          {/* 光圈动画 */}
          <div className="absolute inset-0 rounded-full border-2 border-success/30 animate-ping" />
        </div>
        <h2 className="text-2xl font-bold text-stone-800 mb-2 tracking-tight">项目创建成功！</h2>
        <p className="text-stone-500 text-sm">你的成长视频项目已经准备好了</p>
      </div>

      {/* 项目信息摘要 */}
      <div className="card p-6 mb-8">
        <h3 className="text-sm font-semibold text-stone-700 mb-5">项目信息</h3>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-9 h-9 rounded-xl bg-warmth-100 flex items-center justify-center">
              <Baby className="w-4 h-4 text-warmth-500" />
            </div>
            <div>
              <p className="text-xs text-stone-400">宝宝</p>
              <p className="text-sm font-semibold text-stone-800">{selectedBaby?.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center">
              <Calendar className="w-4 h-4 text-indigo-500" />
            </div>
            <div>
              <p className="text-xs text-stone-400">项目名称</p>
              <p className="text-sm font-semibold text-stone-800">{projectName}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-9 h-9 rounded-xl bg-warning-bg flex items-center justify-center">
              <Image className="w-4 h-4 text-warning" />
            </div>
            <div>
              <p className="text-xs text-stone-400">生成周期</p>
              <p className="text-sm font-semibold text-stone-800">{periods.length} 个</p>
            </div>
          </div>
          {scanResult && (
            <div className="flex items-center gap-4">
              <div className="w-9 h-9 rounded-xl bg-success-bg flex items-center justify-center">
                <Image className="w-4 h-4 text-success" />
              </div>
              <div>
                <p className="text-xs text-stone-400">扫描照片</p>
                <p className="text-sm font-semibold text-success-text">{scanResult.total_photos} 张</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="space-y-3">
        <button
          onClick={handleGoToOverview}
          className="btn btn-primary btn-lg w-full justify-center"
        >
          查看项目概览
          <ArrowRight className="w-5 h-5" />
        </button>
        <button
          onClick={handleGoToPeriods}
          className="btn btn-secondary btn-lg w-full justify-center"
        >
          <Play className="w-5 h-5" />
          立即开始选照片
        </button>
      </div>
    </div>
  );
}
