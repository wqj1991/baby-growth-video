import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Baby, Plus, Sparkles } from 'lucide-react';
import { useCreateProjectStore } from '../../store/createProjectStore';
import { getBabies } from '../../utils/tauriCommands';
import type { Baby as BabyType } from '../../types';

export default function Step1SelectBaby() {
  const navigate = useNavigate();
  const { selectedBaby, setSelectedBaby } = useCreateProjectStore();
  const [babies, setBabies] = useState<BabyType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBabies();
  }, []);

  const loadBabies = async () => {
    try {
      const data = await getBabies();
      setBabies(data);
      if (data.length === 1 && !selectedBaby) {
        setSelectedBaby(data[0]);
      }
    } catch (error) {
      console.error('加载宝宝列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectBaby = (baby: BabyType) => {
    setSelectedBaby(baby);
  };

  const handleAddBaby = () => {
    navigate('/baby-setup');
  };

  const getGenderStyles = (gender: string) => {
    switch (gender) {
      case 'boy':
        return {
          bg: 'from-blue-400/10 to-indigo-400/10',
          icon: 'text-blue-500',
          avatar: 'from-blue-400 to-indigo-500',
          badge: 'bg-blue-50 text-blue-600 border-blue-200/60',
          ring: 'ring-blue-300/30',
        };
      case 'girl':
        return {
          bg: 'from-rose-400/10 to-pink-400/10',
          icon: 'text-rose-500',
          avatar: 'from-rose-400 to-pink-500',
          badge: 'bg-rose-50 text-rose-600 border-rose-200/60',
          ring: 'ring-rose-300/30',
        };
      default:
        return {
          bg: 'from-warmth-400/10 to-amber-400/10',
          icon: 'text-warmth-500',
          avatar: 'from-warmth-400 to-amber-500',
          badge: 'bg-warmth-50 text-warmth-600 border-warmth-200/60',
          ring: 'ring-warmth-300/30',
        };
    }
  };

  const getGenderEmoji = (gender: string) => {
    switch (gender) {
      case 'boy': return '👦';
      case 'girl': return '👧';
      default: return '👶';
    }
  };

  if (loading) {
    return (
      <div className="p-10 max-w-3xl mx-auto animate-fade-in-up">
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-warmth-400/12 to-warmth-500/8 flex items-center justify-center">
              <Baby className="w-5 h-5 text-warmth-500" strokeWidth={1.8} />
            </div>
            <h2 className="text-2xl font-bold text-stone-800 tracking-tight">选择宝宝</h2>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center py-20 text-stone-400 gap-3">
          <div className="w-8 h-8 border-2 border-stone-200 border-t-warmth-400 rounded-full animate-spin" />
          <p className="text-sm">加载宝宝信息...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-10 max-w-3xl mx-auto animate-fade-in-up">
      {/* 页面标题区 */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-warmth-400/12 to-warmth-500/8 flex items-center justify-center">
            <Baby className="w-5 h-5 text-warmth-500" strokeWidth={1.8} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-stone-800 tracking-tight">选择宝宝</h2>
            <p className="text-sm text-stone-500 mt-0.5">选择要为哪个宝宝创建成长视频</p>
          </div>
        </div>
      </div>

      {babies.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="w-20 h-20 rounded-full bg-stone-100 flex items-center justify-center mx-auto mb-6">
            <Baby className="w-10 h-10 text-stone-300" />
          </div>
          <h3 className="text-lg font-semibold text-stone-700 mb-2">还没有添加宝宝</h3>
          <p className="text-stone-400 text-sm mb-6">先添加宝宝信息再开始创建视频项目</p>
          <button onClick={handleAddBaby} className="btn btn-primary btn-lg">
            <Plus className="w-5 h-5" />
            添加宝宝
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {babies.map((baby, idx) => {
            const styles = getGenderStyles(baby.gender);
            const isSelected = selectedBaby?.id === baby.id;
            return (
              <button
                key={baby.id}
                onClick={() => handleSelectBaby(baby)}
                className={`group relative p-5 rounded-2xl text-left transition-all duration-300 stagger-${Math.min(idx + 1, 5)} animate-fade-in-up ${
                  isSelected
                    ? `bg-white shadow-lg ring-2 ${styles.ring} border-transparent scale-[1.02]`
                    : `bg-white shadow-sm border border-stone-200/80 hover:shadow-md hover:border-stone-300 hover:scale-[1.01]`
                }`}
              >
                {/* 选中标记 */}
                {isSelected && (
                  <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-500 flex items-center justify-center shadow-sm">
                    <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}

                <div className="flex items-center gap-4">
                  {/* 头像 */}
                  <div
                    className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${styles.avatar} flex items-center justify-center text-2xl shadow-sm flex-shrink-0 transition-transform duration-300 group-hover:scale-105`}
                  >
                    {getGenderEmoji(baby.gender)}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-stone-800 truncate text-base">{baby.name}</p>
                    <p className="text-xs text-stone-500 mt-0.5">{baby.birth_date} 出生</p>
                    {isSelected && (
                      <span className={`inline-flex items-center gap-1 mt-2 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${styles.badge}`}>
                        <Sparkles className="w-3 h-3" />
                        已选择
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* 添加新宝宝 */}
      {babies.length > 0 && (
        <div className="mt-8 pt-6 border-t border-stone-200/60">
          <button
            onClick={handleAddBaby}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-warmth-500 hover:text-warmth-600 hover:bg-warmth-50 transition-all duration-200"
          >
            <Plus className="w-4 h-4" />
            添加新宝宝
          </button>
        </div>
      )}
    </div>
  );
}
