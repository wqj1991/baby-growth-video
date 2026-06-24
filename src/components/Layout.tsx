import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Home, Baby, Video, History, Settings } from 'lucide-react';
import { useAppStore } from '../store';

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentBaby, currentProject } = useAppStore();

  const navItems = [
    { path: '/', icon: Home, label: '首页' },
    { path: '/baby-setup', icon: Baby, label: '宝宝信息' },
    { path: currentProject ? `/project/${currentProject.id}/periods` : '/', icon: Video, label: '视频制作' },
    { path: currentProject ? `/project/${currentProject.id}/history` : '/', icon: History, label: '历史记录' },
  ];

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* 侧边栏 */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-gray-100">
          <h1 className="text-xl font-bold text-primary-600 flex items-center gap-2">
            <Baby className="w-6 h-6" />
            成长视频
          </h1>
          <p className="text-sm text-gray-500 mt-1">记录宝宝每一刻</p>
        </div>

        {/* 当前宝宝信息 */}
        {currentBaby && (
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                <Baby className="w-5 h-5 text-primary-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">{currentBaby.name}</p>
                <p className="text-xs text-gray-500">
                  {currentBaby.gender === 'boy' ? '男宝' : currentBaby.gender === 'girl' ? '女宝' : '未知'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 导航 */}
        <nav className="flex-1 p-4">
          <ul className="space-y-1">
            {navItems.map((item) => (
              <li key={item.path}>
                <button
                  onClick={() => navigate(item.path)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                    isActive(item.path)
                      ? 'bg-primary-50 text-primary-600 font-medium'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* 底部 */}
        <div className="p-4 border-t border-gray-100">
          <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors">
            <Settings className="w-5 h-5" />
            <span>设置</span>
          </button>
        </div>
      </aside>

      {/* 主内容区 */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
