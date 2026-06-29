import { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import {
  FolderOpen,
  Plus,
  Check,
  Image,
  Video as VideoIcon,
  Calendar,
  Trash2,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';
import { useAppStore } from '../store';
import {
  getPeriods,
  generatePeriods,
  createPeriod,
  deletePeriod,
  getPeriodPhotos,
  getPeriodVideos,
  scanPeriodFolder,
  selectFolder,
  updatePhoto,
  setFinalPhoto,
  cancelFinalPhoto,
  getImageBase64,
  generateVideoFrames,
  generateVideoFramesByInterval,
  updateVideoFrame,
  setFinalVideoFrame,
  cancelFinalVideoFrame,
  getVideoThumbnail,
} from '../utils/tauriCommands';
import type { Period, Photo, Video, VideoFrame, SelectableItem } from '../types';
import VirtualPhotoGrid from '../components/VirtualPhotoGrid';
import PhotoContextMenu from '../components/PhotoContextMenu';
import VideoFrameSettingsModal from '../components/VideoFrameSettingsModal';
import VideoFrameViewerModal from '../components/VideoFrameViewerModal';

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
    currentVideoFrames,
    setCurrentVideoFrames,
    isScanning,
    setIsScanning,
    currentBaby,
    selectedItems,
    setSelectedItems,
    addToSelectedItems,
    removeFromSelectedItems,
  } = useAppStore();

  const [showAddPeriod, setShowAddPeriod] = useState(false);
  const [newPeriodName, setNewPeriodName] = useState('');
  const [newPeriodDate, setNewPeriodDate] = useState('');
  const [selectedTab, setSelectedTab] = useState<'photos' | 'pending' | 'videos'>('photos');
  const [loadedImages, setLoadedImages] = useState<Record<number, string>>({});
  const loadedImageIds = useRef<Set<number>>(new Set());
  const [showPreview, setShowPreview] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  
  // 右键菜单状态
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    position: { x: number; y: number };
    photo: Photo | null;
  }>({
    visible: false,
    position: { x: 0, y: 0 },
    photo: null,
  });

  // 视频帧相关状态
  const [currentVideoForFrames, setCurrentVideoForFrames] = useState<Video | null>(null);
  const [showFrameSettings, setShowFrameSettings] = useState(false);
  const [showFrameViewer, setShowFrameViewer] = useState(false);
  const [isExtractingFrames, setIsExtractingFrames] = useState(false);
  const [videoFrameCounts, setVideoFrameCounts] = useState<Record<number, number>>({});
  const [videoThumbnails, setVideoThumbnails] = useState<Record<number, string>>({});
  const contentAreaRef = useRef<HTMLDivElement>(null);
  const [contentAreaHeight, setContentAreaHeight] = useState(400);

  // 测量内容区高度（传递给 VirtualPhotoGrid）
  useEffect(() => {
    const el = contentAreaRef.current;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      setContentAreaHeight(Math.max(100, rect.height - 48)); // subtract header padding
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (projectId) {
      loadPeriods(parseInt(projectId));
    }
  }, [projectId]);

  useEffect(() => {
    if (currentPeriod) {
      loadPeriodMedia(currentPeriod.id);
      // 切换周期时关闭预览
      setShowPreview(false);
      setPreviewIndex(0);
      // 切换周期时关闭右键菜单
      handleCloseContextMenu();
      // 切换周期时关闭视频帧弹窗
      setShowFrameSettings(false);
      setShowFrameViewer(false);
      setCurrentVideoForFrames(null);
      setVideoFrameCounts({});
    }
  }, [currentPeriod]);

  // 加载图片 base64
  useEffect(() => {
    const loadImages = async () => {
      const photosToLoad = currentPhotos.filter(photo => !loadedImageIds.current.has(photo.id));
      
      if (photosToLoad.length === 0) return;
      
      photosToLoad.forEach(photo => loadedImageIds.current.add(photo.id));
      
      const batchSize = 5;
      for (let i = 0; i < photosToLoad.length; i += batchSize) {
        const batch = photosToLoad.slice(i, i + batchSize);
        const results = await Promise.all(
          batch.map(async (photo) => {
            try {
              const base64 = await getImageBase64(photo.file_path);
              return { id: photo.id, url: base64 };
            } catch (error) {
              console.error('加载图片失败:', photo.file_name, error);
              loadedImageIds.current.delete(photo.id);
              return { id: photo.id, url: '' };
            }
          })
        );
        
        const newLoadedImages: Record<number, string> = {};
        results.forEach(({ id, url }) => {
          if (url) newLoadedImages[id] = url;
        });
        
        setLoadedImages(prev => ({ ...prev, ...newLoadedImages }));
      }
    };
    
    loadImages();
  }, [currentPhotos]);

  // 加载视频帧图片 base64
  useEffect(() => {
    const loadFrameImages = async () => {
      const framesToLoad = currentVideoFrames.filter(frame => !loadedImageIds.current.has(frame.id));
      
      if (framesToLoad.length === 0) return;
      
      framesToLoad.forEach(frame => loadedImageIds.current.add(frame.id));
      
      const batchSize = 5;
      for (let i = 0; i < framesToLoad.length; i += batchSize) {
        const batch = framesToLoad.slice(i, i + batchSize);
        const results = await Promise.all(
          batch.map(async (frame) => {
            try {
              const base64 = await getImageBase64(frame.file_path);
              return { id: frame.id, url: base64 };
            } catch (error) {
              console.error('加载视频帧失败:', frame.id, error);
              loadedImageIds.current.delete(frame.id);
              return { id: frame.id, url: '' };
            }
          })
        );
        
        const newLoadedImages: Record<number, string> = {};
        results.forEach(({ id, url }) => {
          if (url) newLoadedImages[id] = url;
        });
        
        setLoadedImages(prev => ({ ...prev, ...newLoadedImages }));
      }
    };
    
    loadFrameImages();
  }, [currentVideoFrames]);

  // 加载视频缩略图
  useEffect(() => {
    const loadVideoThumbnails = async () => {
      const videosToLoad = currentVideos.filter(v => !videoThumbnails[v.id]);
      
      if (videosToLoad.length === 0) return;
      
      const batchSize = 3;
      for (let i = 0; i < videosToLoad.length; i += batchSize) {
        const batch = videosToLoad.slice(i, i + batchSize);
        const results = await Promise.all(
          batch.map(async (video) => {
            try {
              const thumbnail = await getVideoThumbnail(video.file_path);
              return { id: video.id, thumbnail };
            } catch (error) {
              console.error('加载视频缩略图失败:', video.file_name, error);
              return { id: video.id, thumbnail: '' };
            }
          })
        );
        
        const newThumbnails: Record<number, string> = {};
        results.forEach(({ id, thumbnail }) => {
          if (thumbnail) newThumbnails[id] = thumbnail;
        });
        
        setVideoThumbnails(prev => ({ ...prev, ...newThumbnails }));
      }
    };
    
    loadVideoThumbnails();
  }, [currentVideos]);

  // 图片预览 - 键盘事件
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!showPreview) return;
      
      if (e.key === 'ArrowLeft') {
        handlePrevPhoto();
      } else if (e.key === 'ArrowRight') {
        handleNextPhoto();
      } else if (e.key === 'Escape') {
        handleClosePreview();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showPreview, previewIndex]);

  // 打开图片预览
  const handleOpenPreview = (index: number) => {
    setPreviewIndex(index);
    setShowPreview(true);
  };

  // 关闭图片预览
  const handleClosePreview = () => {
    setShowPreview(false);
  };

  // 上一张
  const handlePrevPhoto = () => {
    if (currentPhotos.length === 0) return;
    setPreviewIndex(prev => (prev - 1 + currentPhotos.length) % currentPhotos.length);
  };

  // 下一张
  const handleNextPhoto = () => {
    if (currentPhotos.length === 0) return;
    setPreviewIndex(prev => (prev + 1) % currentPhotos.length);
  };

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
      setLoadedImages({});
      loadedImageIds.current.clear();
      
      setSelectedItems([]);
      
      const [photos, videos] = await Promise.all([
        getPeriodPhotos(periodId),
        getPeriodVideos(periodId),
      ]);
      setCurrentPhotos(photos);
      setCurrentVideos(videos);
      
      const selectedPhotos: SelectableItem[] = photos
        .filter(p => p.is_selected)
        .map(p => ({ type: 'photo' as const, item: p }));
      if (selectedPhotos.length > 0) {
        setSelectedItems(selectedPhotos);
      }
    } catch (error) {
      console.error('加载周期媒体失败:', error);
    }
  };

  // 批量刷新日志
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
    if (!projectId || !currentPeriod) return;

    const folderPath = await selectFolder();
    if (!folderPath) return;

    setIsScanning(true);

    try {
      await scanPeriodFolder(parseInt(projectId), currentPeriod.id, folderPath);
      // 重新加载当前周期的媒体
      await loadPeriodMedia(currentPeriod.id);
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
      
      if (updated.is_selected) {
        addToSelectedItems({ type: 'photo', item: updated });
      } else {
        removeFromSelectedItems({ type: 'photo', item: updated });
      }
    } catch (error) {
      console.error('更新照片失败:', error);
    }
  };

  const handleExtractFrames = (video: Video) => {
    setCurrentVideoForFrames(video);
    setShowFrameSettings(true);
  };

  const handleGenerateFrames = async (mode: 'count' | 'interval', value: number) => {
    setShowFrameSettings(false);
    setIsExtractingFrames(true);
    
    try {
      let frames: VideoFrame[];
      if (mode === 'count') {
        frames = await generateVideoFrames(currentVideoForFrames!.id, value);
      } else {
        frames = await generateVideoFramesByInterval(currentVideoForFrames!.id, value);
      }
      setCurrentVideoFrames(frames);
      setVideoFrameCounts(prev => ({
        ...prev,
        [currentVideoForFrames!.id]: frames.length
      }));
      setShowFrameViewer(true);
    } catch (error) {
      console.error('抽帧失败:', error);
      alert('抽帧失败，请重试');
    } finally {
      setIsExtractingFrames(false);
    }
  };

  const handleToggleFrameSelect = async (frame: VideoFrame) => {
    try {
      const updated = await updateVideoFrame({
        ...frame,
        is_selected: !frame.is_selected,
      });
      
      setCurrentVideoFrames(currentVideoFrames.map(f => 
        f.id === updated.id ? updated : f
      ));
      
      if (updated.is_selected) {
        addToSelectedItems({ type: 'frame', item: updated });
      } else {
        removeFromSelectedItems({ type: 'frame', item: updated });
      }
    } catch (error) {
      console.error('更新视频帧失败:', error);
    }
  };

  const handleSetFinalVideoFrame = async (frame: VideoFrame) => {
    if (!currentPeriod) return;
    
    try {
      await setFinalVideoFrame(currentPeriod.id, frame.id);
      
      setCurrentVideoFrames(currentVideoFrames.map(f => ({
        ...f,
        is_final: f.id === frame.id,
      })));
      
      const updatedPeriods = periods.map(p => 
        p.id === currentPeriod.id 
          ? { ...p, selected_photo_id: frame.id }
          : p
      );
      setPeriods(updatedPeriods);
      
      setCurrentPeriod({
        ...currentPeriod,
        selected_photo_id: frame.id,
      });
    } catch (error) {
      console.error('设置最终视频帧失败:', error);
    }
  };

  const handleCancelFinalVideoFrame = async () => {
    if (!currentPeriod) return;
    
    try {
      await cancelFinalVideoFrame(currentPeriod.id);
      
      setCurrentVideoFrames(currentVideoFrames.map(f => ({
        ...f,
        is_final: false,
      })));
      
      const updatedPeriods = periods.map(p =>
        p.id === currentPeriod.id
          ? { ...p, selected_photo_id: undefined }
          : p
      );
      setPeriods(updatedPeriods);
      
      setCurrentPeriod({
        ...currentPeriod,
        selected_photo_id: undefined,
      });
    } catch (error) {
      console.error('取消最终视频帧失败:', error);
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
      
      // 更新周期列表中的selected_photo_id，实时标记完成状态
      const updatedPeriods = periods.map(p => 
        p.id === currentPeriod.id 
          ? { ...p, selected_photo_id: photo.id }
          : p
      );
      setPeriods(updatedPeriods);
      
      // 同时更新currentPeriod
      setCurrentPeriod({
        ...currentPeriod,
        selected_photo_id: photo.id,
      });
    } catch (error) {
      console.error('设置最终照片失败:', error);
    }
  };

  // 右键菜单处理
  const handlePhotoContextMenu = (e: React.MouseEvent, photo: Photo) => {
    e.preventDefault();
    setContextMenu({
      visible: true,
      position: { x: e.clientX, y: e.clientY },
      photo,
    });
  };

  const handleCloseContextMenu = () => {
    setContextMenu({
      visible: false,
      position: { x: 0, y: 0 },
      photo: null,
    });
  };

  const handleAddToPending = (photo: Photo) => {
    handleTogglePhotoSelect(photo);
  };

  const handleRemoveFromPending = (photo: Photo) => {
    handleTogglePhotoSelect(photo);
  };

  const handleContextMenuSetFinal = (photo: Photo) => {
    handleSetFinalPhoto(photo);
  };

  const handleCancelFinalPhoto = async (_photo: Photo) => {
    if (!currentPeriod) return;

    try {
      await cancelFinalPhoto(currentPeriod.id);
      // 更新所有照片的is_final状态
      const updated = currentPhotos.map(p => ({
        ...p,
        is_final: false,
      }));
      setCurrentPhotos(updated);

      // 更新周期列表中的selected_photo_id，取消完成状态
      const updatedPeriods = periods.map(p =>
        p.id === currentPeriod.id
          ? { ...p, selected_photo_id: undefined }
          : p
      );
      setPeriods(updatedPeriods);
      
      // 同时更新currentPeriod
      setCurrentPeriod({
        ...currentPeriod,
        selected_photo_id: undefined,
      });
    } catch (error) {
      console.error('取消最终照片失败:', error);
    }
  };

  const handleContextMenuPreview = (photo: Photo) => {
    // 根据当前 tab 确定照片列表
    const photoList = selectedTab === 'pending' 
      ? currentPhotos.filter(p => p.is_selected)
      : currentPhotos;
    const index = photoList.findIndex(p => p.id === photo.id);
    if (index !== -1) {
      // 预览始终使用完整的 currentPhotos 列表，保持一致性
      const fullIndex = currentPhotos.findIndex(p => p.id === photo.id);
      if (fullIndex !== -1) {
        handleOpenPreview(fullIndex);
      }
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
              onClick={() => {
                setSelectedTab('pending');
                handleCloseContextMenu();
              }}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                selectedTab === 'pending'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Plus className="w-4 h-4 inline mr-1" />
              待选区 ({selectedItems.length})
            </button>
            <button
              onClick={() => {
                setSelectedTab('photos');
                handleCloseContextMenu();
              }}
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
              onClick={() => {
                setSelectedTab('videos');
                handleCloseContextMenu();
              }}
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
        <div ref={contentAreaRef} className="flex-1 overflow-auto p-6 bg-gray-50">
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
                  <VirtualPhotoGrid
                    photos={currentPhotos}
                    loadedImages={loadedImages}
                    onContextMenu={handlePhotoContextMenu}
                    onDoubleClick={(photo) => {
                      const index = currentPhotos.findIndex(p => p.id === photo.id);
                      if (index !== -1) handleOpenPreview(index);
                    }}
                    onOpenPreview={handleOpenPreview}
                    gridHeight={contentAreaHeight}
                    className="w-full"
                  />
                </>
              )}
            </div>
          ) : selectedTab === 'pending' ? (
            <div>
              {selectedItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                  <Plus className="w-16 h-16 mb-4 text-gray-300" />
                  <p>暂无待选项目</p>
                  <p className="text-sm mt-1">在"照片"或"视频"中选择项目加入待选区</p>
                </div>
              ) : (
                <>
                  <div className="mb-4 flex items-center justify-between">
                    <p className="text-sm text-gray-600">
                      待选区共有 {selectedItems.length} 个项目，
                      {currentPhotos.find(p => p.is_final) || currentVideoFrames.find(f => f.is_final) 
                        ? '已确认最终项目' 
                        : '请确认1个最终项目'}
                    </p>
                  </div>
                  <div className="photo-grid">
                    {selectedItems.map((selectable) => {
                      if (selectable.type === 'photo') {
                        const photo = selectable.item;
                        return (
                          <div
                            key={`photo-${photo.id}`}
                            className={`photo-item ${
                              photo.is_selected ? 'selected' : ''
                            } ${photo.is_final ? 'final' : ''}`}
                            onContextMenu={(e) => handlePhotoContextMenu(e, photo)}
                            onDoubleClick={(e) => {
                              e.stopPropagation();
                              const index = currentPhotos.findIndex(p => p.id === photo.id);
                              handleOpenPreview(index);
                            }}
                          >
                            <img
                              src={loadedImages[photo.id] || ''}
                              alt={photo.file_name}
                              loading="lazy"
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
                          </div>
                        );
                      } else {
                        const frame = selectable.item;
                        return (
                          <div
                            key={`frame-${frame.id}`}
                            className={`photo-item ${
                              frame.is_selected ? 'selected' : ''
                            } ${frame.is_final ? 'final' : ''}`}
                          >
                            <img
                              src={loadedImages[frame.id] || ''}
                              alt={`frame-${frame.id}`}
                              loading="lazy"
                            />
                            {frame.is_final && (
                              <div className="photo-badge final">
                                <Check className="w-3 h-3" />
                              </div>
                            )}
                            {frame.is_selected && !frame.is_final && (
                              <div className="photo-badge selected">
                                ✓
                              </div>
                            )}
                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                              <p className="text-white text-xs font-mono text-center">
                                {Math.floor(frame.time_seconds / 60)}:{(frame.time_seconds % 60).toString().padStart(2, '0')}
                              </p>
                            </div>
                          </div>
                        );
                      }
                    })}
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
                      <div className="aspect-video bg-gray-900 relative overflow-hidden">
                        {videoThumbnails[video.id] ? (
                          <img
                            src={videoThumbnails[video.id]}
                            alt={video.file_name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <VideoIcon className="w-12 h-12 text-gray-600" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/0 hover:bg-black/20 transition-colors" />
                        <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/70 text-white text-xs rounded">
                          {Math.floor(video.duration / 60)}:{(video.duration % 60).toString().padStart(2, '0')}
                        </div>
                      </div>
                      <div className="p-3">
                        <p className="text-sm font-medium truncate">{video.file_name}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {video.width}x{video.height}
                        </p>
                        <button
                          onClick={() => handleExtractFrames(video)}
                          className="mt-2 w-full btn btn-outline btn-sm"
                          disabled={isExtractingFrames}
                        >
                          {isExtractingFrames ? '抽帧中...' : (videoFrameCounts[video.id] > 0 ? `查看帧(${videoFrameCounts[video.id]}张)` : '截取画面')}
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

      {/* 图片预览弹窗 */}
      {showPreview && currentPhotos[previewIndex] && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
          onClick={handleClosePreview}
        >
          {/* 关闭按钮 */}
          <button
            className="absolute top-4 right-4 p-2 text-white/80 hover:text-white transition-colors"
            onClick={handleClosePreview}
          >
            <X className="w-8 h-8" />
          </button>

          {/* 上一张按钮 */}
          <button
            className="absolute left-4 top-1/2 -translate-y-1/2 p-3 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-all"
            onClick={(e) => {
              e.stopPropagation();
              handlePrevPhoto();
            }}
          >
            <ChevronLeft className="w-10 h-10" />
          </button>

          {/* 下一张按钮 */}
          <button
            className="absolute right-4 top-1/2 -translate-y-1/2 p-3 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-all"
            onClick={(e) => {
              e.stopPropagation();
              handleNextPhoto();
            }}
          >
            <ChevronRight className="w-10 h-10" />
          </button>

          {/* 图片 */}
          <div 
            className="max-w-[90vw] max-h-[85vh] flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={loadedImages[currentPhotos[previewIndex].id] || ''}
              alt={currentPhotos[previewIndex].file_name}
              className="max-w-full max-h-[85vh] object-contain"
            />
          </div>

          {/* 底部信息 */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/80 text-sm">
            <span className="font-medium">{currentPhotos[previewIndex].file_name}</span>
            <span className="mx-2">·</span>
            <span>{previewIndex + 1} / {currentPhotos.length}</span>
          </div>
        </div>
      )}

      {/* 右键菜单 */}
      <PhotoContextMenu
        visible={contextMenu.visible}
        position={contextMenu.position}
        photo={contextMenu.photo}
        onAddToPending={handleAddToPending}
        onRemoveFromPending={handleRemoveFromPending}
        onSetFinal={handleContextMenuSetFinal}
        onCancelFinal={handleCancelFinalPhoto}
        onPreview={handleContextMenuPreview}
        onClose={handleCloseContextMenu}
      />

      {/* 视频抽帧设置弹窗 */}
      <VideoFrameSettingsModal
        visible={showFrameSettings}
        video={currentVideoForFrames}
        onClose={() => setShowFrameSettings(false)}
        onGenerate={handleGenerateFrames}
      />

      {/* 视频帧查看弹窗 */}
      <VideoFrameViewerModal
        visible={showFrameViewer}
        video={currentVideoForFrames}
        frames={currentVideoFrames}
        onClose={() => setShowFrameViewer(false)}
        onReExtract={() => {
          setShowFrameViewer(false);
          setShowFrameSettings(true);
        }}
        onToggleSelect={handleToggleFrameSelect}
        onSetFinal={handleSetFinalVideoFrame}
        onCancelFinal={handleCancelFinalVideoFrame}
        onPreview={(frame) => {
          console.log('预览视频帧:', frame);
        }}
      />
    </div>
  );
}
