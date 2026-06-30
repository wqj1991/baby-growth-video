import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Home, Baby, Video, History, Settings, Sparkles, ChevronRight } from 'lucide-react';
import { useAppStore } from '../store';

interface NavItem {
  id: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  disabled?: boolean;
}

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentBaby, currentProject } = useAppStore();

  const navItems: NavItem[] = [
    { id: 'home', path: '/', icon: Home, label: '首页' },
    { id: 'baby', path: '/baby-setup', icon: Baby, label: '宝宝信息' },
    {
      id: 'video',
      path: currentProject ? `/project/${currentProject.id}/periods` : '/',
      icon: Video,
      label: '视频制作',
      disabled: !currentProject,
    },
    {
      id: 'history',
      path: currentProject ? `/project/${currentProject.id}/history` : '/',
      icon: History,
      label: '历史记录',
      disabled: !currentProject,
    },
  ];

  const isActive = (path: string, disabled?: boolean) => {
    if (disabled) return false;
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const getBabyEmoji = (gender: string) => {
    if (gender === 'boy') return '👦';
    if (gender === 'girl') return '👧';
    return '👶';
  };

  const getBabyColor = (gender: string) => {
    if (gender === 'boy') return 'from-blue-400 to-indigo-400';
    if (gender === 'girl') return 'from-rose-300 to-rose-400';
    return 'from-warmth-400 to-warmth-500';
  };

  return (
    <div className="flex h-screen" style={{ background: 'linear-gradient(135deg, var(--color-stone-50) 0%, var(--color-stone-100) 50%, var(--color-warmth-50) 100%)' }}>
      {/* ========== 侧边栏 ========== */}
      <aside className="w-64 flex flex-col relative z-10">
        {/* 侧边栏背景 — 玻璃拟态 */}
        <div className="absolute inset-0 glass-strong" />

        <div className="relative flex flex-col h-full px-3 py-4">
          {/* ---- Logo 区域 ---- */}
          <div className="px-3 mb-6">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-xl gradient-warm flex items-center justify-center shadow-glow">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight text-stone-900">
                  成长视频
                </h1>
                <p className="text-xs font-medium text-stone-400">记录宝宝每一刻</p>
              </div>
            </div>
          </div>

          {/* ---- 当前宝宝信息卡片 ---- */}
          {currentBaby ? (
            <div className="px-3 mb-5">
              <div
                className="relative overflow-hidden rounded-2xl p-4 cursor-pointer group transition-all duration-300 hover:shadow-medium border border-warmth-200"
                style={{
                  background: 'linear-gradient(135deg, var(--color-warmth-50) 0%, var(--color-warmth-100) 50%, #ffffff 100%)',
                }}
                onClick={() => navigate('/baby-setup')}
              >
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${getBabyColor(currentBaby.gender)} flex items-center justify-center text-xl shadow-sm`}>
                      {getBabyEmoji(currentBaby.gender)}
                    </div>
                    <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-success border-2 border-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate text-stone-900">
                      {currentBaby.name}
                    </p>
                    <p className="text-xs text-stone-400">
                      {currentBaby.gender === 'boy' ? '小王子' : currentBaby.gender === 'girl' ? '小公主' : '小宝贝'}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-stone-400 opacity-0 group-hover:opacity-100 transition-all duration-300 transform group-hover:translate-x-0.5" />
                </div>
              </div>
            </div>
          ) : (
            <div className="px-3 mb-5">
              <button
                onClick={() => navigate('/baby-setup')}
                className="w-full rounded-2xl p-4 text-center transition-all duration-300 hover:shadow-soft border-[1.5px] border-dashed border-stone-300"
                style={{
                  background: 'linear-gradient(135deg, var(--color-stone-50) 0%, var(--color-stone-100) 100%)',
                }}
              >
                <Baby className="w-6 h-6 mx-auto mb-2 text-stone-400" />
                <p className="text-xs font-medium text-stone-500">添加宝宝信息</p>
              </button>
            </div>
          )}

          {/* ---- 导航 ---- */}
          <nav className="flex-1 px-2">
            <p className="px-2 mb-2 text-xs font-semibold uppercase tracking-wider text-stone-400">
              导航
            </p>
            <ul className="space-y-1">
              {navItems.map((item) => {
                const active = isActive(item.path, item.disabled);
                const disabled = item.disabled;

                return (
                  <li key={item.id}>
                    <button
                      onClick={disabled ? undefined : () => navigate(item.path)}
                      disabled={disabled}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                        active
                          ? 'bg-white shadow-soft text-warmth-600'
                          : disabled
                            ? 'text-stone-300 cursor-not-allowed'
                            : 'text-stone-600 hover:bg-white/60 hover:text-warmth-500'
                      }`}
                    >
                      <item.icon className={`w-[18px] h-[18px] transition-transform duration-200 ${active ? 'scale-110' : ''}`} />
                      <span>{item.label}</span>
                      {active && (
                        <span className="ml-auto w-1.5 h-1.5 rounded-full bg-warmth-500" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* ---- 底部操作 ---- */}
          <div className="px-2 pt-3 border-t border-stone-200">
            <button
              onClick={() => navigate('/settings')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                location.pathname === '/settings'
                  ? 'bg-white shadow-soft text-warmth-600'
                  : 'text-stone-600 hover:bg-white/60 hover:text-warmth-500'
              }`}
            >
              <Settings className="w-[18px] h-[18px]" />
              <span>设置</span>
              {location.pathname === '/settings' && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-warmth-500" />
              )}
            </button>
          </div>
        </div>
      </aside>

      {/* ========== 主内容区 ========== */}
      <main className="flex-1 overflow-hidden relative">
        {/* 背景装饰 */}
        <div className="absolute top-0 right-0 w-[600px] h-[600px] pointer-events-none opacity-[0.03]"
          style={{
            background: 'radial-gradient(circle at 100% 0%, var(--color-warmth-500) 0%, transparent 70%)',
          }}
        />
        <div className="relative flex h-full">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
