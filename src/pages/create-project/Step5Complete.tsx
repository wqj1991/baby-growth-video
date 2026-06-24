import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Baby, Calendar, Image, ArrowRight, Play } from 'lucide-react';
import { useCreateProjectStore } from '../../store/createProjectStore';
import { useAppStore } from '../../store';
import { createProject } from '../../utils/tauriCommands';
import type { Project } from '../../types';

export default function Step5Complete() {
  const navigate = useNavigate();
  const {
    selectedBaby,
    projectName,
    projectDescription,
    periodDays,
    scanResult,
    periods,
    reset,
  } = useCreateProjectStore();
  const { setCurrentProject, setCurrentBaby, setPeriods } = useAppStore();

  const [creating, setCreating] = useState(true);
  const [createdProject, setCreatedProject] = useState<Project | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    createTheProject();
  }, []);

  const createTheProject = async () => {
    if (!selectedBaby) {
      setError('未选择宝宝');
      setCreating(false);
      return;
    }

    setCreating(true);
    try {
      const project: Project = await createProject({
        baby_id: selectedBaby.id,
        name: projectName,
        description: projectDescription,
        period_days: periodDays,
        status: 'draft',
      });

      setCreatedProject(project);
      setCurrentProject(project);
      setCurrentBaby(selectedBaby);
      if (periods.length > 0) {
        setPeriods(periods);
      }
    } catch (err) {
      console.error('创建项目失败:', err);
      setError('创建项目失败，请重试');
    } finally {
      setCreating(false);
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

  const handleRetry = () => {
    setError(null);
    createTheProject();
  };

  if (creating) {
    return (
      <div className="p-8 text-center">
        <div className="py-16">
          <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Calendar className="w-8 h-8 text-primary-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">正在创建项目...</h2>
          <p className="text-gray-500">请稍候，正在为您创建成长视频项目</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <div className="py-16">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">😕</span>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">创建失败</h2>
          <p className="text-gray-500 mb-6">{error}</p>
          <button onClick={handleRetry} className="btn btn-primary">
            重试
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="text-center py-8">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-10 h-10 text-green-500" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">项目创建成功！</h2>
        <p className="text-gray-500">你的成长视频项目已经准备好了</p>
      </div>

      {/* 项目信息摘要 */}
      <div className="max-w-md mx-auto bg-gray-50 rounded-xl p-6 mb-8">
        <h3 className="font-semibold text-gray-900 mb-4">项目信息</h3>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Baby className="w-5 h-5 text-gray-400" />
            <span className="text-gray-600">宝宝：</span>
            <span className="font-medium text-gray-900">{selectedBaby?.name}</span>
          </div>
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-gray-400" />
            <span className="text-gray-600">项目：</span>
            <span className="font-medium text-gray-900">{projectName}</span>
          </div>
          <div className="flex items-center gap-3">
            <Image className="w-5 h-5 text-gray-400" />
            <span className="text-gray-600">周期：</span>
            <span className="font-medium text-gray-900">{periods.length} 个周期</span>
          </div>
          {scanResult && (
            <div className="flex items-center gap-3">
              <Image className="w-5 h-5 text-gray-400" />
              <span className="text-gray-600">照片：</span>
              <span className="font-medium text-gray-900">
                {scanResult.total_photos} 张
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="max-w-md mx-auto space-y-3">
        <button
          onClick={handleGoToOverview}
          className="btn btn-primary w-full"
        >
          查看项目概览
          <ArrowRight className="w-4 h-4" />
        </button>
        <button
          onClick={handleGoToPeriods}
          className="btn btn-secondary w-full"
        >
          <Play className="w-4 h-4" />
          立即开始选照片
        </button>
      </div>
    </div>
  );
}
