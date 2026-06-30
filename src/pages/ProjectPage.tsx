import { useEffect, useState } from 'react';
import { useParams, useNavigate, Outlet, NavLink } from 'react-router-dom';
import { Calendar, Video, History, ArrowLeft, LayoutDashboard } from 'lucide-react';
import { useAppStore } from '../store';
import { getProjects } from '../utils/tauriCommands';

export default function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { currentProject, setCurrentProject, currentBaby } = useAppStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (projectId) {
      loadProject(parseInt(projectId));
    }
  }, [projectId]);

  const loadProject = async (id: number) => {
    setLoading(true);
    try {
      const babyId = currentBaby?.id || 1;
      const projects = await getProjects(babyId);
      const project = projects.find(p => p.id === id);
      if (project) setCurrentProject(project);
    } catch (error) {
      console.error('加载项目失败:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-2 text-stone-400">
          <div className="w-4 h-4 border-2 border-warmth-500 border-t-transparent rounded-full animate-spin" />
          加载中...
        </div>
      </div>
    );
  }

  const navItems = [
    { path: 'overview', icon: LayoutDashboard, label: '项目概览' },
    { path: 'periods', icon: Calendar, label: '周期选择' },
    { path: 'generate', icon: Video, label: '生成视频' },
    { path: 'history', icon: History, label: '历史记录' },
  ];

  return (
    <div className="h-full w-full flex flex-col">
      {/* ===== Top Header ===== */}
      <div className="bg-white border-b border-stone-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="p-2 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-stone-900">
                {currentProject?.name || '成长视频项目'}
              </h1>
              {currentProject?.description && (
                <p className="text-sm text-stone-500">{currentProject.description}</p>
              )}
            </div>
          </div>

          {currentProject && (
            <span className="text-xs text-stone-400">
              {currentProject.status === 'completed' ? (
                <span className="badge badge-success">已完成</span>
              ) : (
                <span className="badge badge-primary">草稿</span>
              )}
            </span>
          )}
        </div>

        {/* Sub Navigation */}
        <div className="flex gap-1 mt-4">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-warmth-100 text-warmth-700 shadow-sm'
                    : 'text-stone-600 hover:bg-stone-50 hover:text-stone-900'
                }`
              }
            >
              <item.icon className="w-4 h-4" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col min-h-0">
        <Outlet />
      </div>
    </div>
  );
}
