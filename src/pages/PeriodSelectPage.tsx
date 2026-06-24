import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  FolderOpen,
  Plus,
  Check,
  Image,
  Video as VideoIcon,
  Calendar,
  Trash2,
} from 'lucide-react';
import { useAppStore } from '../store';
import {
  getPeriods,
  generatePeriods,
  createPeriod,
  deletePeriod,
  getPeriodPhotos,
  getPeriodVideos,
  scanMediaFolder,
  selectFolder,
  updatePhoto,
  setFinalPhoto,
} from '../utils/tauriCommands';
import type { Period, Photo } from '../types';

export default function PeriodSelectPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const {
    periods,
    setPeriods,
    currentPeriod,
    setCurrentPeriod,
    currentPhotos,
    setCurrentPhotos,
    currentVideos,
    setCurrentVideos,
    isScanning,
    setIsScanning,
    currentBaby,
  } = useAppStore();

  const [showAddPeriod, setShowAddPeriod] = useState(false);
  const [newPeriodName, setNewPeriodName] = useState('');
  const [newPeriodDate, setNewPeriodDate] = useState('');
  const [selectedTab, setSelectedTab] = useState<'photos' | 'videos'>('photos');

  useEffect(() => {
    if (projectId) {
      loadPeriods(parseInt(projectId));
    }
  }, [projectId]);

  useEffect(() => {
    if (currentPeriod) {
      loadPeriodMedia(currentPeriod.id);
    }
  }, [currentPeriod]);

  const loadPeriods = async (pid: number) => {
    try {
      const data = await getPeriods(pid);
      setPeriods(data);
      if (data.length > 0) {
        setCurrentPeriod(data[0]);
      }
    } catch (error) {
      console.error('加载周期失败:', error);
    }
  };

  const loadPeriodMedia = async (periodId: number) => {
    try {
      const [photos, videos] = await Promise.all([
        getPeriodPhotos(periodId),
        getPeriodVideos(periodId),
      ]);
      setCurrentPhotos(photos);
      setCurrentVideos(videos);
    } catch (error) {
      console.error('加载周期媒体失败:', error);
    }
  };

  const handleGeneratePeriods = async () => {
    if (!projectId || !currentBaby) return;

    try {
      const data = await generatePeriods(
        parseInt(projectId),
        currentBaby.birth_date,
        7
      );
      setPeriods(data);
      if (data.length > 0) {
        setCurrentPeriod(data[0]);
      }
    } catch (error) {
      console.error('生成周期失败:', error);
    }
  };

  const handleScanFolder = async () => {
    if (!projectId) return;

    const folderPath = await selectFolder();
    if (!folderPath) return;

    setIsScanning(true);
    try {
      await scanMediaFolder(parseInt(projectId), folderPath);
      // 重新加载当前周期的媒体
      if (currentPeriod) {
        await loadPeriodMedia(currentPeriod.id);
      }
    } catch (error) {
      console.error('扫描文件夹失败:', error);
      alert('扫描文件夹失败');
    } finally {
      setIsScanning(false);
    }
  };

  const handleAddPeriod = async () => {
    if (!projectId || !newPeriodName || !newPeriodDate) return;

    try {
      const period = await createPeriod({
        project_id: parseInt(projectId),
        name: newPeriodName,
        start_date: newPeriodDate,
        end_date: newPeriodDate,
        period_type: 'custom',
        sort_order: periods.length,
      });
      setPeriods([...periods, period]);
      setShowAddPeriod(false);
      setNewPeriodName('');
      setNewPeriodDate('');
    } catch (error) {
      console.error('添加周期失败:', error);
    }
  };

  const handleDeletePeriod = async (periodId: number) => {
    if (!confirm('确定要删除这个周期吗？')) return;

    try {
      await deletePeriod(periodId);
      const newPeriods = periods.filter(p => p.id !== periodId);
      setPeriods(newPeriods);
      if (currentPeriod?.id === periodId) {
        setCurrentPeriod(newPeriods[0] || null);
      }
    } catch (error) {
      console.error('删除周期失败:', error);
    }
  };

  const handleTogglePhotoSelect = async (photo: Photo) => {
    try {
      const updated = await updatePhoto({
        ...photo,
        is_selected: !photo.is_selected,
      });
      setCurrentPhotos(currentPhotos.map(p => p.id === updated.id ? updated : p));
    } catch (error) {
      console.error('更新照片失败:', error);
    }
  };

  const handleSetFinalPhoto = async (photo: Photo) => {
    if (!currentPeriod) return;

    try {
      await setFinalPhoto(currentPeriod.id, photo.id);
      // 更新所有照片的is_final状态
      const updated = currentPhotos.map(p => ({
        ...p,
        is_final: p.id === photo.id,
      }));
      setCurrentPhotos(updated);
    } catch (error) {
      console.error('设置最终照片失败:', error);
    }
  };

  const getPeriodStatus = (period: Period) => {
    if (period.selected_photo_id) return 'completed';
    return 'pending';
  };

  const completedCount = periods.filter(p => p.selected_photo_id).length;

  return (
    <div className="flex h-full">
      {/* 左侧 - 周期列表 */}
      <div className="w-72 border-r border-gray-200 bg-white flex flex-col">
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">周期列表</h3>
            <span className="text-sm text-gray-500">
              {completedCount}/{periods.length}
            </span>
          </div>

          <div className="flex gap-2">
            {periods.length === 0 && (
              <button
                onClick={handleGeneratePeriods}
                className="btn btn-primary btn-sm flex-1"
              >
                <Calendar className="w-4 h-4" />
                自动生成
              </button>
            )}
            <button
              onClick={() => setShowAddPeriod(true)}
              className="btn btn-outline btn-sm flex-1"
            >
              <Plus className="w-4 h-4" />
              添加
            </button>
          </div>
        </div>

        {/* 添加周期表单 */}
        {showAddPeriod && (
          <div className="p-4 border-b border-gray-100 bg-gray-50">
            <div className="form-group">
              <label className="form-label">周期名称</label>
              <input
                type="text"
                className="form-input text-sm"
                value={newPeriodName}
                onChange={(e) => setNewPeriodName(e.target.value)}
                placeholder="如：满月、百天"
              />
            </div>
            <div className="form-group">
              <label className="form-label">日期</label>
              <input
                type="date"
                className="form-input text-sm"
                value={newPeriodDate}
                onChange={(e) => setNewPeriodDate(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleAddPeriod}
                className="btn btn-primary btn-sm flex-1"
              >
                确认添加
              </button>
              <button
                onClick={() => setShowAddPeriod(false)}
                className="btn btn-secondary btn-sm"
              >
                取消
              </button>
            </div>
          </div>
        )}

        {/* 周期列表 */}
        <div className="flex-1 overflow-auto p-2">
          <div className="period-timeline">
            {periods.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Calendar className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">暂无周期</p>
                <p className="text-xs mt-1">点击上方按钮生成或添加</p>
              </div>
            ) : (
              periods.map((period) => (
                <div
                  key={period.id}
                  onClick={() => setCurrentPeriod(period)}
                  className={`period-item ${
                    currentPeriod?.id === period.id ? 'active' : ''
                  } ${getPeriodStatus(period) === 'completed' ? 'completed' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{period.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {period.start_date} ~ {period.end_date}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      {getPeriodStatus(period) === 'completed' && (
                        <span className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                          <Check className="w-3 h-3 text-white" />
                        </span>
                      )}
                      {period.period_type === 'custom' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeletePeriod(period.id);
                          }}
                          className="p-1 text-gray-400 hover:text-red-500"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 右侧 - 照片/视频选择区 */}
      <div className="flex-1 flex flex-col">
        {/* 工具栏 */}
        <div className="p-4 border-b border-gray-200 bg-white flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold">
              {currentPeriod?.name || '请选择周期'}
            </h2>
            {currentPeriod && (
              <span className="text-sm text-gray-500">
                {currentPeriod.start_date} ~ {currentPeriod.end_date}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleScanFolder}
              disabled={isScanning || !currentPeriod}
              className="btn btn-primary btn-sm"
            >
              <FolderOpen className="w-4 h-4" />
              {isScanning ? '扫描中...' : '扫描文件夹'}
            </button>
          </div>
        </div>

        {/* Tab切换 */}
        <div className="px-4 border-b border-gray-200 bg-white">
          <div className="flex gap-1">
            <button
              onClick={() => setSelectedTab('photos')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                selectedTab === 'photos'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Image className="w-4 h-4 inline mr-1" />
              照片 ({currentPhotos.length})
            </button>
            <button
              onClick={() => setSelectedTab('videos')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                selectedTab === 'videos'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <VideoIcon className="w-4 h-4 inline mr-1" />
              视频 ({currentVideos.length})
            </button>
          </div>
        </div>

        {/* 内容区 */}
        <div className="flex-1 overflow-auto p-6 bg-gray-50">
          {!currentPeriod ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <Calendar className="w-16 h-16 mb-4 text-gray-300" />
              <p>请先选择一个周期</p>
            </div>
          ) : selectedTab === 'photos' ? (
            <div>
              {currentPhotos.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                  <Image className="w-16 h-16 mb-4 text-gray-300" />
                  <p>暂无照片</p>
                  <p className="text-sm mt-1">点击"扫描文件夹"添加照片</p>
                </div>
              ) : (
                <>
                  <div className="mb-4 flex items-center justify-between">
                    <p className="text-sm text-gray-600">
                      已选择 {currentPhotos.filter(p => p.is_selected).length} 张候选照片，
                      {currentPhotos.find(p => p.is_final) ? '已确认最终照片' : '请确认1张最终照片'}
                    </p>
                  </div>
                  <div className="photo-grid">
                    {currentPhotos.map((photo) => (
                      <div
                        key={photo.id}
                        className={`photo-item ${
                          photo.is_selected ? 'selected' : ''
                        } ${photo.is_final ? 'final' : ''}`}
                        onClick={() => handleTogglePhotoSelect(photo)}
                      >
                        <img
                          src={`file://${photo.file_path}`}
                          alt={photo.file_name}
                        />
                        {photo.is_final && (
                          <div className="photo-badge final">
                            <Check className="w-3 h-3" />
                          </div>
                        )}
                        {photo.is_selected && !photo.is_final && (
                          <div className="photo-badge selected">
                            ✓
                          </div>
                        )}
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                          <p className="text-white text-xs truncate">
                            {photo.file_name}
                          </p>
                        </div>
                        {photo.is_selected && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSetFinalPhoto(photo);
                            }}
                            className="absolute top-2 left-2 px-2 py-1 bg-green-500 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                            style={{ opacity: photo.is_selected ? 1 : 0 }}
                          >
                            设为最终
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div>
              {currentVideos.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                  <VideoIcon className="w-16 h-16 mb-4 text-gray-300" />
                  <p>暂无视频</p>
                  <p className="text-sm mt-1">点击"扫描文件夹"添加视频</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {currentVideos.map((video) => (
                    <div
                      key={video.id}
                      className="card overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
                    >
                      <div className="aspect-video bg-gray-900 flex items-center justify-center relative">
                        <VideoIcon className="w-12 h-12 text-gray-600" />
                        <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/70 text-white text-xs rounded">
                          {Math.floor(video.duration / 60)}:{(video.duration % 60).toString().padStart(2, '0')}
                        </div>
                      </div>
                      <div className="p-3">
                        <p className="text-sm font-medium truncate">{video.file_name}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {video.width}x{video.height}
                        </p>
                        <button className="mt-2 w-full btn btn-outline btn-sm">
                          截取画面
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
