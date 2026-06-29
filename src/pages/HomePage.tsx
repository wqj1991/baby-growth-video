import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Baby, Plus, Video, Clock, ChevronRight, Trash2, Sparkles, Calendar, Play } from 'lucide-react';
import { useAppStore } from '../store';
import { getBabies, getProjects, deleteProject } from '../utils/tauriCommands';
import type { Baby as BabyType, Project } from '../types';

export default function HomePage() {
  const navigate = useNavigate();
  const { setCurrentBaby, setCurrentProject, currentProject } = useAppStore();
  const [babies, setBabies] = useState<BabyType[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedBaby, setSelectedBaby] = useState<BabyType | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    loadBabies();
    setMounted(true);
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
      if (data.length > 0 && !selectedBaby) {
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

  const handleDeleteProject = async (e: React.MouseEvent, project: Project) => {
    e.stopPropagation();
    if (!window.confirm(`确定要删除项目「${project.name}」吗？此操作不可恢复。`)) {
      return;
    }
    try {
      await deleteProject(project.id);
      if (selectedBaby) {
        loadProjects(selectedBaby.id);
      }
    } catch (error) {
      console.error('删除项目失败:', error);
      alert('删除项目失败，请重试');
    }
  };

  const getBabyColor = (gender: string) => {
    if (gender === 'boy') return 'from-blue-400 to-indigo-400';
    if (gender === 'girl') return 'from-rose-300 to-rose-400';
    return 'from-warmth-400 to-warmth-500';
  };

  const getBabyEmoji = (gender: string) => {
    if (gender === 'boy') return '👦';
    if (gender === 'girl') return '👧';
    return '👶';
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* ========== 欢迎横幅 ========== */}
      <div
        className={`relative overflow-hidden rounded-3xl p-8 mb-8 transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
        style={{
          background: 'linear-gradient(135deg, #fffaf5 0%, #fff2e6 30%, #fae7ea 70%, #e4e7f6 100%)',
        }}
      >
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/70 text-warmth-600 shadow-sm">
                <Sparkles className="w-3.5 h-3.5" />
                成长记录
              </span>
            </div>
            <h1 className="text-3xl font-bold mb-2 tracking-tight" style={{ color: '#33312d' }}>
              欢迎回来
              {selectedBaby && (
                <span className="ml-2 text-warmth-500">{selectedBaby.name}的家长</span>
              )}
            </h1>
            <p className="text-base" style={{ color: '#706c63' }}>
              记录宝宝每一个珍贵瞬间，制作专属成长视频
            </p>
          </div>
          <div className="hidden lg:block">
            <div className="w-20 h-20 rounded-2xl gradient-warm flex items-center justify-center shadow-glow animate-float">
              <Play className="w-8 h-8 text-white" fill="white" />
            </div>
          </div>
        </div>
        {/* 装饰元素 */}
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #f58b3d 0%, transparent 70%)' }}
        />
        <div className="absolute bottom-0 left-1/3 w-48 h-48 rounded-full opacity-8"
          style={{ background: 'radial-gradient(circle, #d44d68 0%, transparent 70%)' }}
        />
      </div>

      {/* ========== 快速操作卡片 ========== */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {/* 新建项目 */}
        <button
          onClick={handleCreateProject}
          className={`relative overflow-hidden rounded-2xl p-5 text-left transition-all duration-500 hover:shadow-medium group ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
          style={{
            background: 'linear-gradient(135deg, #ffffff 0%, #fffaf5 100%)',
            border: '1px solid #ffe4cc',
            transitionDelay: '0.05s',
          }}
        >
          <div className="w-11 h-11 rounded-xl gradient-warm flex items-center justify-center mb-3 shadow-sm group-hover:scale-110 transition-transform duration-300">
            <Plus className="w-5 h-5 text-white" />
          </div>
          <h3 className="font-semibold text-base mb-1" style={{ color: '#33312d' }}>新建项目</h3>
          <p className="text-xs" style={{ color: '#8f8b80' }}>创建新的成长视频项目</p>
        </button>

        {/* 继续制作 */}
        <button
          onClick={() => {
            if (projects.length > 0) {
              handleOpenProject(projects[0]);
            } else {
              handleCreateProject();
            }
          }}
          className={`relative overflow-hidden rounded-2xl p-5 text-left transition-all duration-500 hover:shadow-medium group ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
          style={{
            background: 'linear-gradient(135deg, #ffffff 0%, #f4f5fb 100%)',
            border: '1px solid #e4e7f6',
            transitionDelay: '0.1s',
          }}
        >
          <div className="w-11 h-11 rounded-xl gradient-indigo flex items-center justify-center mb-3 shadow-sm group-hover:scale-110 transition-transform duration-300">
            <Play className="w-5 h-5 text-white" />
          </div>
          <h3 className="font-semibold text-base mb-1" style={{ color: '#33312d' }}>继续制作</h3>
          <p className="text-xs" style={{ color: '#8f8b80' }}>继续上次的视频项目</p>
        </button>

        {/* 历史记录 */}
        <button
          onClick={() => {
            if (currentProject) {
              navigate(`/project/${currentProject.id}/history`);
            }
          }}
          className={`relative overflow-hidden rounded-2xl p-5 text-left transition-all duration-500 hover:shadow-medium group ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
          style={{
            background: 'linear-gradient(135deg, #ffffff 0%, #f2fbf6 100%)',
            border: '1px solid #d9f2e4',
            transitionDelay: '0.15s',
          }}
        >
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-500 flex items-center justify-center mb-3 shadow-sm group-hover:scale-110 transition-transform duration-300">
            <Calendar className="w-5 h-5 text-white" />
          </div>
          <h3 className="font-semibold text-base mb-1" style={{ color: '#33312d' }}>历史记录</h3>
          <p className="text-xs" style={{ color: '#8f8b80' }}>查看已生成的成长视频</p>
        </button>
      </div>

      {/* ========== 主要内容区 ========== */}
      <div className="grid grid-cols-12 gap-6">
        {/* ---- 宝宝列表 ---- */}
        <div className="col-span-4">
          <div
            className="card p-5"
            style={{ transitionDelay: '0.2s' }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold tracking-tight" style={{ color: '#33312d' }}>我的宝宝</h2>
              <button
                onClick={handleCreateBaby}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white gradient-warm shadow-sm hover:shadow-md transition-all duration-200 hover:scale-105"
              >
                <Plus className="w-3.5 h-3.5" />
                添加
              </button>
            </div>

            {babies.length === 0 ? (
              <div className="text-center py-10">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-warmth-100 to-warmth-200 flex items-center justify-center mx-auto mb-4">
                  <Baby className="w-8 h-8 text-warmth-400" />
                </div>
                <p className="font-medium mb-1" style={{ color: '#706c63' }}>还没有添加宝宝信息</p>
                <p className="text-xs mb-5" style={{ color: '#b0aca0' }}>添加宝宝后开始制作成长视频</p>
                <button
                  onClick={handleCreateBaby}
                  className="btn btn-primary btn-sm"
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
                    className={`group p-4 rounded-xl cursor-pointer transition-all duration-300 ${
                      selectedBaby?.id === baby.id
                        ? 'bg-gradient-to-r from-warmth-50 to-warmth-100 border-2 border-warmth-200 shadow-sm'
                        : 'hover:bg-stone-50 border-2 border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${getBabyColor(baby.gender)} flex items-center justify-center text-xl shadow-sm group-hover:scale-105 transition-transform duration-200`}>
                        {getBabyEmoji(baby.gender)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate" style={{ color: '#33312d' }}>{baby.name}</p>
                        <p className="text-xs" style={{ color: '#8f8b80' }}>
                          {baby.birth_date} 出生
                        </p>
                      </div>
                      <ChevronRight className={`w-4 h-4 transition-all duration-200 ${
                        selectedBaby?.id === baby.id ? 'text-warmth-400 opacity-100' : 'text-stone-300 opacity-0 group-hover:opacity-100'
                      }`} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ---- 项目列表 ---- */}
        <div className="col-span-8">
          <div
            className="card p-6"
            style={{ transitionDelay: '0.25s' }}
          >
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-semibold tracking-tight" style={{ color: '#33312d' }}>视频项目</h2>
                {selectedBaby && (
                  <p className="text-xs mt-0.5" style={{ color: '#b0aca0' }}>
                    {selectedBaby.name} 的成长视频项目 · {projects.length} 个项目
                  </p>
                )}
              </div>
              {selectedBaby && (
                <button
                  onClick={handleCreateProject}
                  className="btn btn-primary btn-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  新建项目
                </button>
              )}
            </div>

            {!selectedBaby ? (
              <div className="text-center py-14">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-stone-100 to-stone-200 flex items-center justify-center mx-auto mb-4">
                  <Video className="w-10 h-10 text-stone-400" />
                </div>
                <p className="font-medium text-lg mb-1" style={{ color: '#706c63' }}>选择一个宝宝</p>
                <p className="text-sm" style={{ color: '#b0aca0' }}>从左侧选择宝宝后查看项目</p>
              </div>
            ) : projects.length === 0 ? (
              <div className="text-center py-14">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-warmth-100 to-warmth-200 flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="w-10 h-10 text-warmth-400" />
                </div>
                <p className="font-medium text-lg mb-1" style={{ color: '#706c63' }}>开启第一个项目</p>
                <p className="text-sm mb-6" style={{ color: '#b0aca0' }}>
                  为 {selectedBaby.name} 创建第一个成长视频项目
                </p>
                <button onClick={handleCreateProject} className="btn btn-primary">
                  <Plus className="w-4 h-4" />
                  创建项目
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {projects.map((project, idx) => (
                  <div
                    key={project.id}
                    onClick={() => handleOpenProject(project)}
                    className="group relative overflow-hidden rounded-2xl p-5 cursor-pointer transition-all duration-300 hover:shadow-medium hover:-translate-y-0.5"
                    style={{
                      background: 'linear-gradient(135deg, #ffffff 0%, #fafaf8 100%)',
                      border: '1px solid #e8e6de',
                      animationDelay: `${0.3 + idx * 0.05}s`,
                    }}
                  >
                    {/* 顶部渐变条 */}
                    <div className="absolute top-0 left-0 right-0 h-1 gradient-warm opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm truncate mb-1" style={{ color: '#33312d' }}>
                          {project.name}
                        </h3>
                        <p className="text-xs line-clamp-2" style={{ color: '#8f8b80' }}>
                          {project.description || '暂无描述'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 ml-3 shrink-0">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          project.status === 'completed'
                            ? 'bg-emerald-50 text-emerald-600'
                            : 'bg-warmth-50 text-warmth-600'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full mr-1 ${
                            project.status === 'completed' ? 'bg-emerald-400' : 'bg-warmth-400'
                          }`} />
                          {project.status === 'completed' ? '已完成' : '进行中'}
                        </span>
                        <button
                          onClick={(e) => handleDeleteProject(e, project)}
                          className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 text-stone-400 hover:text-rose-500 hover:bg-rose-50"
                          title="删除项目"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 mb-3">
                      <span className="inline-flex items-center gap-1.5 text-xs" style={{ color: '#8f8b80' }}>
                        <Clock className="w-3.5 h-3.5" />
                        {project.period_days}天/周期
                      </span>
                    </div>

                    <div className="pt-3 flex items-center justify-between" style={{ borderTop: '1px solid #f5f4f0' }}>
                      <span className="text-xs" style={{ color: '#b0aca0' }}>
                        更新于 {project.updated_at}
                      </span>
                      <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-all duration-300 transform group-hover:translate-x-0.5 text-warmth-400" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
