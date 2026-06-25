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
    selectedBaby,
    projectName,
    projectId,
    scanResult,
    periods,
    reset,
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
