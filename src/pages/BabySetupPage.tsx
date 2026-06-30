import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Baby, Save, ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { useAppStore } from '../store';
import { getBabies, createBaby, updateBaby, deleteBaby } from '../utils/tauriCommands';
import type { Baby as BabyType } from '../types';

export default function BabySetupPage() {
  const navigate = useNavigate();
  const { currentBaby, setCurrentBaby } = useAppStore();
  const [babies, setBabies] = useState<BabyType[]>([]);
  const [editingBaby, setEditingBaby] = useState<Partial<BabyType>>({
    name: '',
    nickname: '',
    birth_date: '',
    gender: 'unknown',
  });
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadBabies();
  }, []);

  const loadBabies = async () => {
    try {
      const data = await getBabies();
      setBabies(data);
    } catch (error) {
      console.error('加载宝宝列表失败:', error);
    }
  };

  const handleEdit = (baby: BabyType) => {
    setEditingBaby(baby);
    setIsEditing(true);
  };

  const handleAddNew = () => {
    setEditingBaby({
      name: '',
      nickname: '',
      birth_date: '',
      gender: 'unknown',
    });
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditingBaby({
      name: '',
      nickname: '',
      birth_date: '',
      gender: 'unknown',
    });
  };

  const handleSave = async () => {
    if (!editingBaby.name || !editingBaby.birth_date) {
      alert('请填写宝宝姓名和出生日期');
      return;
    }

    setSaving(true);
    try {
      if (editingBaby.id) {
        // 更新
        const updated = await updateBaby(editingBaby as BabyType);
        setBabies(babies.map(b => b.id === updated.id ? updated : b));
        if (currentBaby?.id === updated.id) {
          setCurrentBaby(updated);
        }
      } else {
        // 创建
        const created = await createBaby(editingBaby as Omit<BabyType, 'id' | 'created_at' | 'updated_at'>);
        setBabies([...babies, created]);
      }
      setIsEditing(false);
    } catch (error) {
      console.error('保存失败:', error);
      alert('保存失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (babyId: number) => {
    if (!confirm('确定要删除这个宝宝的信息吗？相关的项目和数据也会被删除。')) {
      return;
    }

    try {
      await deleteBaby(babyId);
      setBabies(babies.filter(b => b.id !== babyId));
      if (currentBaby?.id === babyId) {
        setCurrentBaby(null);
      }
    } catch (error) {
      console.error('删除失败:', error);
      alert('删除失败，请重试');
    }
  };

  return (
    <div className="p-8">
      {/* 页面标题 */}
      <div className="mb-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-stone-500 hover:text-stone-700 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          返回
        </button>
        <h1 className="text-2xl font-bold text-stone-900">宝宝信息</h1>
        <p className="text-stone-500 mt-1">管理宝宝的基本信息</p>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* 左侧 - 宝宝列表 */}
        <div className="col-span-5">
          <div className="card">
            <div className="card-header flex items-center justify-between">
              <h2 className="text-lg font-semibold">宝宝列表</h2>
              <button
                onClick={handleAddNew}
                className="btn btn-primary btn-sm"
              >
                <Plus className="w-4 h-4" />
                添加宝宝
              </button>
            </div>
            <div className="card-body">
              {babies.length === 0 ? (
                <div className="text-center py-8">
                  <Baby className="w-12 h-12 text-stone-300 mx-auto mb-3" />
                  <p className="text-stone-500">还没有添加宝宝</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {babies.map((baby) => (
                    <div
                      key={baby.id}
                      className="p-4 rounded-lg bg-stone-100 hover:bg-stone-100 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                          baby.gender === 'boy' ? 'bg-info-bg' : baby.gender === 'girl' ? 'bg-warmth-100' : 'bg-stone-100'
                        }`}>
                          <Baby className={`w-6 h-6 ${
                            baby.gender === 'boy' ? 'text-info-text' : baby.gender === 'girl' ? 'text-warmth-700' : 'text-stone-600'
                          }`} />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-stone-900">{baby.name}</p>
                          {baby.nickname && (
                            <p className="text-sm text-stone-500">小名：{baby.nickname}</p>
                          )}
                          <p className="text-sm text-stone-500">
                            {baby.birth_date} 出生
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEdit(baby)}
                            className="p-2 text-stone-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                          >
                            编辑
                          </button>
                          <button
                            onClick={() => handleDelete(baby.id)}
                            className="p-2 text-stone-500 hover:text-error hover:bg-error-bg rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 右侧 - 编辑表单 */}
        <div className="col-span-7">
          <div className="card">
            <div className="card-header">
              <h2 className="text-lg font-semibold">
                {editingBaby.id ? '编辑宝宝信息' : '添加宝宝'}
              </h2>
            </div>
            <div className="card-body">
              {!isEditing ? (
                <div className="text-center py-12">
                  <Baby className="w-16 h-16 text-stone-300 mx-auto mb-4" />
                  <p className="text-stone-500 mb-4">选择左侧宝宝进行编辑，或添加新宝宝</p>
                  <button
                    onClick={handleAddNew}
                    className="btn btn-primary"
                  >
                    <Plus className="w-4 h-4" />
                    添加宝宝
                  </button>
                </div>
              ) : (
                <div className="max-w-md">
                  <div className="form-group">
                    <label className="form-label">宝宝姓名 *</label>
                    <input
                      type="text"
                      className="form-input"
                      value={editingBaby.name || ''}
                      onChange={(e) => setEditingBaby({ ...editingBaby, name: e.target.value })}
                      placeholder="请输入宝宝姓名"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">小名</label>
                    <input
                      type="text"
                      className="form-input"
                      value={editingBaby.nickname || ''}
                      onChange={(e) => setEditingBaby({ ...editingBaby, nickname: e.target.value })}
                      placeholder="请输入宝宝小名"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">出生日期 *</label>
                    <input
                      type="date"
                      className="form-input"
                      value={editingBaby.birth_date || ''}
                      onChange={(e) => setEditingBaby({ ...editingBaby, birth_date: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">性别</label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="gender"
                          value="boy"
                          checked={editingBaby.gender === 'boy'}
                          onChange={(e) => setEditingBaby({ ...editingBaby, gender: e.target.value as 'boy' | 'girl' | 'unknown' })}
                          className="w-4 h-4 text-primary-600"
                        />
                        <span>男宝</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="gender"
                          value="girl"
                          checked={editingBaby.gender === 'girl'}
                          onChange={(e) => setEditingBaby({ ...editingBaby, gender: e.target.value as 'boy' | 'girl' | 'unknown' })}
                          className="w-4 h-4 text-primary-600"
                        />
                        <span>女宝</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="gender"
                          value="unknown"
                          checked={editingBaby.gender === 'unknown'}
                          onChange={(e) => setEditingBaby({ ...editingBaby, gender: e.target.value as 'boy' | 'girl' | 'unknown' })}
                          className="w-4 h-4 text-primary-600"
                        />
                        <span>保密</span>
                      </label>
                    </div>
                  </div>

                  <div className="flex gap-3 mt-8">
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="btn btn-primary flex-1"
                    >
                      <Save className="w-4 h-4" />
                      {saving ? '保存中...' : '保存'}
                    </button>
                    <button
                      onClick={handleCancel}
                      className="btn btn-secondary"
                    >
                      取消
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
