import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Baby, Plus } from 'lucide-react';
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
      // 只有一个宝宝且未选中时，默认选中
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

  if (loading) {
    return (
      <div className="p-8">
        <h2 className="text-xl font-bold mb-2">选择宝宝</h2>
        <p className="text-gray-500 mb-6">选择要为哪个宝宝创建成长视频</p>
        <div className="text-center py-12 text-gray-500">加载中...</div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h2 className="text-xl font-bold mb-2">选择宝宝</h2>
      <p className="text-gray-500 mb-6">选择要为哪个宝宝创建成长视频</p>

      {babies.length === 0 ? (
        <div className="text-center py-12">
          <Baby className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 mb-4">还没有添加宝宝信息</p>
          <button onClick={handleAddBaby} className="btn btn-primary">
            <Plus className="w-4 h-4" />
            添加宝宝
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {babies.map((baby) => (
            <div
              key={baby.id}
              onClick={() => handleSelectBaby(baby)}
              className={`p-4 rounded-lg cursor-pointer transition-all border-2 ${
                selectedBaby?.id === baby.id
                  ? 'bg-primary-50 border-primary-300'
                  : 'bg-gray-50 border-transparent hover:bg-gray-100'
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
                <div>
                  <p className="font-medium text-gray-900">{baby.name}</p>
                  <p className="text-sm text-gray-500">{baby.birth_date} 出生</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {babies.length > 0 && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <button
            onClick={handleAddBaby}
            className="text-primary-600 hover:text-primary-700 text-sm font-medium flex items-center gap-1"
          >
            <Plus className="w-4 h-4" />
            添加新宝宝
          </button>
        </div>
      )}
    </div>
  );
}
