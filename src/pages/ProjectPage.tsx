import { useEffect, useState } from 'react';
import { useParams, useNavigate, Outlet, NavLink } from 'react-router-dom';
import { Calendar, Video, History, Settings, ArrowLeft } from 'lucide-react';
import { useAppStore } from '../store';
import { getProjects } from '../utils/tauriCommands';

export default function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { currentProject, setCurrentProject } = useAppStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (projectId) {
      loadProject(parseInt(projectId));
    }
  }, [projectId]);

  const loadProject = async (id: number) => {
    setLoading(true);
    try {
      // 这里应该从项目列表中找到对应的项目
      // 简化处理，先假设项目已存在
      const projects = await getProjects(1); // 临时用babyId=1
      const project = projects.find(p => p.id === id);
      if (project) {
        setCurrentProject(project);
      }
    } catch (error) {
      console.error('加载项目失败:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

  const navItems = [
    { path: 'periods', icon: Calendar, label: '周期选择' },
    { path: 'generate', icon: Video, label: '生成视频' },
    { path: 'history', icon: History, label: '历史记录' },
  ];

  return (
    <div className="h-full flex flex-col">
      {/* 顶部栏 */}
      <div className="bg-white border-b border-gray-200 px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                {currentProject?.name || '成长视频项目'}
              </h1>
              <p className="text-sm text-gray-500">
                {currentProject?.description || '制作宝宝的成长视频'}
              </p>
            </div>
          </div>
          <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
            <Settings className="w-5 h-5" />
          </button>
        </div>

        {/* 子导航 */}
        <div className="flex gap-1 mt-4">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-primary-50 text-primary-600 font-medium'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`
              }
            >
              <item.icon className="w-4 h-4" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </div>
      </div>

      {/* 内容区 */}
      <div className="flex-1 overflow-auto">
        <Outlet />
      </div>
    </div>
  );
}
