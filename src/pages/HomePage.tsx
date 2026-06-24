import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Baby, Plus, Video, Clock, ChevronRight } from 'lucide-react';
import { useAppStore } from '../store';
import { getBabies, getProjects } from '../utils/tauriCommands';
import type { Baby as BabyType, Project } from '../types';

export default function HomePage() {
  const navigate = useNavigate();
  const { setCurrentBaby, setCurrentProject } = useAppStore();
  const [babies, setBabies] = useState<BabyType[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedBaby, setSelectedBaby] = useState<BabyType | null>(null);

  useEffect(() => {
    loadBabies();
  }, []);

  useEffect(() => {
    if (selectedBaby) {
      loadProjects(selectedBaby.id);
    }
  }, [selectedBaby]);

  const loadBabies = async () => {
    try {
      const data = await getBabies();
      setBabies(data);
      if (data.length > 0) {
        setSelectedBaby(data[0]);
      }
    } catch (error) {
      console.error('加载宝宝列表失败:', error);
    }
  };

  const loadProjects = async (babyId: number) => {
    try {
      const data = await getProjects(babyId);
      setProjects(data);
    } catch (error) {
      console.error('加载项目列表失败:', error);
    }
  };

  const handleSelectBaby = (baby: BabyType) => {
    setSelectedBaby(baby);
    setCurrentBaby(baby);
  };

  const handleOpenProject = (project: Project) => {
    setCurrentProject(project);
    navigate(`/project/${project.id}/periods`);
  };

  const handleCreateBaby = () => {
    navigate('/baby-setup');
  };

  const handleCreateProject = () => {
    navigate('/create-project');
  };

  return (
    <div className="p-8">
      {/* 欢迎标题 */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">欢迎回来 👋</h1>
        <p className="text-gray-500 mt-1">开始制作宝宝的成长视频吧</p>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* 左侧 - 宝宝列表 */}
        <div className="col-span-4">
          <div className="card">
            <div className="card-header flex items-center justify-between">
              <h2 className="text-lg font-semibold">我的宝宝</h2>
              <button
                onClick={handleCreateBaby}
                className="btn btn-primary btn-sm"
              >
                <Plus className="w-4 h-4" />
                添加
              </button>
            </div>
            <div className="card-body">
              {babies.length === 0 ? (
                <div className="text-center py-8">
                  <Baby className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 mb-4">还没有添加宝宝信息</p>
                  <button
                    onClick={handleCreateBaby}
                    className="btn btn-primary"
                  >
                    添加宝宝
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {babies.map((baby) => (
                    <div
                      key={baby.id}
                      onClick={() => handleSelectBaby(baby)}
                      className={`p-4 rounded-lg cursor-pointer transition-all ${
                        selectedBaby?.id === baby.id
                          ? 'bg-primary-50 border-2 border-primary-200'
                          : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                          baby.gender === 'boy' ? 'bg-blue-100' : baby.gender === 'girl' ? 'bg-pink-100' : 'bg-gray-100'
                        }`}>
                          <Baby className={`w-6 h-6 ${
                            baby.gender === 'boy' ? 'text-blue-600' : baby.gender === 'girl' ? 'text-pink-600' : 'text-gray-600'
                          }`} />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{baby.name}</p>
                          <p className="text-sm text-gray-500">
                            {baby.birth_date} 出生
                          </p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 右侧 - 项目列表 */}
        <div className="col-span-8">
          <div className="card">
            <div className="card-header">
              <h2 className="text-lg font-semibold">视频项目</h2>
              <p className="text-sm text-gray-500 mt-1">
                {selectedBaby ? `${selectedBaby.name} 的成长视频项目` : '请先选择宝宝'}
              </p>
            </div>
            <div className="card-body">
              {!selectedBaby ? (
                <div className="text-center py-12">
                  <Video className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">请先选择一个宝宝</p>
                </div>
              ) : projects.length === 0 ? (
                <div className="text-center py-12">
                  <Video className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 mb-4">还没有视频项目</p>
                  <button onClick={handleCreateProject} className="btn btn-primary">
                    <Plus className="w-4 h-4" />
                    创建新项目
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {projects.map((project) => (
                    <div
                      key={project.id}
                      onClick={() => handleOpenProject(project)}
                      className="p-4 rounded-lg bg-gray-50 border-2 border-transparent hover:border-primary-200 hover:bg-primary-50 cursor-pointer transition-all"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-medium text-gray-900">{project.name}</h3>
                          <p className="text-sm text-gray-500 mt-1">
                            {project.description || '暂无描述'}
                          </p>
                        </div>
                        <span className={`badge ${
                          project.status === 'completed' ? 'badge-success' : 'badge-primary'
                        }`}>
                          {project.status === 'completed' ? '已完成' : '进行中'}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {project.period_days}天/周期
                        </span>
                      </div>
                      <div className="mt-3 pt-3 border-t border-gray-200 flex items-center justify-between">
                        <span className="text-xs text-gray-400">
                          更新于 {project.updated_at}
                        </span>
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 快速操作 */}
          <div className="grid grid-cols-3 gap-4 mt-6">
            <div onClick={handleCreateProject} className="card p-4 cursor-pointer hover:shadow-md transition-shadow">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center mb-3">
                <Plus className="w-5 h-5 text-blue-600" />
              </div>
              <h3 className="font-medium text-gray-900">新建项目</h3>
              <p className="text-sm text-gray-500 mt-1">创建新的成长视频项目</p>
            </div>
            <div className="card p-4 cursor-pointer hover:shadow-md transition-shadow">
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center mb-3">
                <Video className="w-5 h-5 text-green-600" />
              </div>
              <h3 className="font-medium text-gray-900">继续制作</h3>
              <p className="text-sm text-gray-500 mt-1">继续上次的视频项目</p>
            </div>
            <div className="card p-4 cursor-pointer hover:shadow-md transition-shadow">
              <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center mb-3">
                <Clock className="w-5 h-5 text-purple-600" />
              </div>
              <h3 className="font-medium text-gray-900">历史记录</h3>
              <p className="text-sm text-gray-500 mt-1">查看已生成的视频</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
