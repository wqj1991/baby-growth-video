import { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import {
  FolderOpen,
  Plus,
  Image,
  Video as VideoIcon,
  Calendar,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';
import { useAppStore } from '../store';
import {
  getPeriods,
  generatePeriods,
  createPeriod,
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
import type { Photo, Video, VideoFrame, SelectableItem } from '../types';
import VirtualPhotoGrid from '../components/VirtualPhotoGrid';
import PhotoContextMenu from '../components/PhotoContextMenu';
import VideoFrameSettingsModal from '../components/VideoFrameSettingsModal';
import VideoFrameViewerModal from '../components/VideoFrameViewerModal';
import PeriodTimeline from '../components/PeriodTimeline';
import PendingSelectionPanel from '../components/PendingSelectionPanel';
import CollageWorkspace from '../components/CollageWorkspace';
import VideoFramePlayer from '../components/VideoFramePlayer';

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
    // Collage state
    collageMode,
    setCollageMode,
    setCollageLayout,
    setCollagePhotoOrder,
    // Video player state
    setShowVideoPlayer,
    currentPlayingVideo,
    setCurrentPlayingVideo,
  } = useAppStore();

  // ---- Local State ----
  const [showAddPeriod, setShowAddPeriod] = useState(false);
  const [newPeriodName, setNewPeriodName] = useState('');
  const [newPeriodDate, setNewPeriodDate] = useState('');
  const [selectedTab, setSelectedTab] = useState<'photos' | 'pending' | 'videos'>('photos');
  const [loadedImages, setLoadedImages] = useState<Record<number, string>>({});
  const loadedImageIds = useRef<Set<number>>(new Set());
  const [showPreview, setShowPreview] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);

  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    position: { x: number; y: number };
    photo: Photo | null;
  }>({ visible: false, position: { x: 0, y: 0 }, photo: null });

  const [currentVideoForFrames, setCurrentVideoForFrames] = useState<Video | null>(null);
  const [showFrameSettings, setShowFrameSettings] = useState(false);
  const [showFrameViewer, setShowFrameViewer] = useState(false);
  const [isExtractingFrames, setIsExtractingFrames] = useState(false);
  const [videoFrameCounts, setVideoFrameCounts] = useState<Record<number, number>>({});
  const [videoThumbnails, setVideoThumbnails] = useState<Record<number, string>>({});

  // Inline video player state
  const [showInlinePlayer, setShowInlinePlayer] = useState(false);

  const gridWrapperRef = useRef<HTMLDivElement>(null);

  // Load periods
  useEffect(() => {
    if (projectId) loadPeriods(parseInt(projectId));
  }, [projectId]);

  // Load media on period change
  useEffect(() => {
    if (currentPeriod) {
      loadPeriodMedia(currentPeriod.id);
      setShowPreview(false);
      setPreviewIndex(0);
      handleCloseContextMenu();
      setShowFrameSettings(false);
      setShowFrameViewer(false);
      setShowInlinePlayer(false);
      setCollageMode(false);
      setCurrentVideoForFrames(null);
      setVideoFrameCounts({});
    }
  }, [currentPeriod]);

  // Load photo base64 images
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
              loadedImageIds.current.delete(photo.id);
              return { id: photo.id, url: '' };
            }
          })
        );
        const newLoadedImages: Record<number, string> = {};
        results.forEach(({ id, url }) => { if (url) newLoadedImages[id] = url; });
        setLoadedImages(prev => ({ ...prev, ...newLoadedImages }));
      }
    };
    loadImages();
  }, [currentPhotos]);

  // Load video frame images
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
              loadedImageIds.current.delete(frame.id);
              return { id: frame.id, url: '' };
            }
          })
        );
        const newLoadedImages: Record<number, string> = {};
        results.forEach(({ id, url }) => { if (url) newLoadedImages[id] = url; });
        setLoadedImages(prev => ({ ...prev, ...newLoadedImages }));
      }
    };
    loadFrameImages();
  }, [currentVideoFrames]);

  // Load video thumbnails
  useEffect(() => {
    const loadVideoThumbs = async () => {
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
              return { id: video.id, thumbnail: '' };
            }
          })
        );
        const newThumbnails: Record<number, string> = {};
        results.forEach(({ id, thumbnail }) => { if (thumbnail) newThumbnails[id] = thumbnail; });
        setVideoThumbnails(prev => ({ ...prev, ...newThumbnails }));
      }
    };
    loadVideoThumbs();
  }, [currentVideos]);

  // Keyboard events for preview
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!showPreview) return;
      if (e.key === 'ArrowLeft') handlePrevPhoto();
      else if (e.key === 'ArrowRight') handleNextPhoto();
      else if (e.key === 'Escape') handleClosePreview();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showPreview, previewIndex]);

  // ============================
  // DATA LOADING
  // ============================

  const loadPeriods = async (pid: number) => {
    try {
      const data = await getPeriods(pid);
      setPeriods(data);
      if (data.length > 0 && !currentPeriod) setCurrentPeriod(data[0]);
    } catch (error) { console.error('加载周期失败:', error); }
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

      const pendingPhotos: SelectableItem[] = photos
        .filter(p => p.is_selected)
        .map(p => ({ type: 'photo' as const, item: p }));
      if (pendingPhotos.length > 0) setSelectedItems(pendingPhotos);
    } catch (error) { console.error('加载周期媒体失败:', error); }
  };

  // ============================
  // PERIOD ACTIONS
  // ============================

  const handleGeneratePeriods = async () => {
    if (!projectId || !currentBaby) return;
    try {
      const data = await generatePeriods(parseInt(projectId), currentBaby.birth_date, 7);
      setPeriods(data);
      if (data.length > 0) setCurrentPeriod(data[0]);
    } catch (error) { console.error('生成周期失败:', error); }
  };

  const handleScanFolder = async () => {
    if (!projectId || !currentPeriod) return;
    const folderPath = await selectFolder();
    if (!folderPath) return;
    setIsScanning(true);
    try {
      await scanPeriodFolder(parseInt(projectId), currentPeriod.id, folderPath);
      await loadPeriodMedia(currentPeriod.id);
    } catch (error) { alert('扫描文件夹失败'); }
    finally { setIsScanning(false); }
  };

  const handleAddPeriod = async () => {
    if (!projectId || !newPeriodName || !newPeriodDate) return;
    try {
      const period = await createPeriod({
        project_id: parseInt(projectId), name: newPeriodName,
        start_date: newPeriodDate, end_date: newPeriodDate,
        period_type: 'custom', sort_order: periods.length,
      });
      setPeriods([...periods, period]);
      setShowAddPeriod(false);
      setNewPeriodName('');
      setNewPeriodDate('');
    } catch (error) { console.error('添加周期失败:', error); }
  };

  // ============================
  // PHOTO ACTIONS
  // ============================

  const handleTogglePhotoSelect = async (photo: Photo) => {
    try {
      const updated = await updatePhoto({ ...photo, is_selected: !photo.is_selected });
      setCurrentPhotos(currentPhotos.map(p => p.id === updated.id ? updated : p));
      if (updated.is_selected) {
        addToSelectedItems({ type: 'photo', item: updated });
      } else {
        removeFromSelectedItems({ type: 'photo', item: updated });
      }
    } catch (error) { console.error('更新照片失败:', error); }
  };

  const handleSetFinalPhoto = async (photo: Photo) => {
    if (!currentPeriod) return;
    try {
      await setFinalPhoto(currentPeriod.id, photo.id);
      setCurrentPhotos(currentPhotos.map(p => ({ ...p, is_final: p.id === photo.id })));
      const updatedPeriods = periods.map(p =>
        p.id === currentPeriod.id ? { ...p, selected_photo_id: photo.id } : p
      );
      setPeriods(updatedPeriods);
      setCurrentPeriod({ ...currentPeriod, selected_photo_id: photo.id });
    } catch (error) { console.error('设置最终照片失败:', error); }
  };

  const handleCancelFinalPhoto = async () => {
    if (!currentPeriod) return;
    try {
      await cancelFinalPhoto(currentPeriod.id);
      setCurrentPhotos(currentPhotos.map(p => ({ ...p, is_final: false })));
      setPeriods(periods.map(p =>
        p.id === currentPeriod.id ? { ...p, selected_photo_id: undefined } : p
      ));
      setCurrentPeriod({ ...currentPeriod, selected_photo_id: undefined });
    } catch (error) { console.error('取消最终照片失败:', error); }
  };

  // ============================
  // VIDEO / FRAME ACTIONS
  // ============================

  const handleExtractFrames = (video: Video) => {
    setCurrentVideoForFrames(video);
    setShowFrameSettings(true);
  };

  const handleGenerateFrames = async (mode: 'count' | 'interval', value: number) => {
    setShowFrameSettings(false);
    setIsExtractingFrames(true);
    try {
      let frames: VideoFrame[];
      if (mode === 'count') frames = await generateVideoFrames(currentVideoForFrames!.id, value);
      else frames = await generateVideoFramesByInterval(currentVideoForFrames!.id, value);
      setCurrentVideoFrames(frames);
      setVideoFrameCounts(prev => ({ ...prev, [currentVideoForFrames!.id]: frames.length }));
      setShowFrameViewer(true);
    } catch (error) { alert('抽帧失败，请重试'); }
    finally { setIsExtractingFrames(false); }
  };

  const handleToggleFrameSelect = async (frame: VideoFrame) => {
    try {
      const updated = await updateVideoFrame({ ...frame, is_selected: !frame.is_selected });
      setCurrentVideoFrames(currentVideoFrames.map(f => f.id === updated.id ? updated : f));
      if (updated.is_selected) {
        addToSelectedItems({ type: 'frame', item: updated });
      } else {
        removeFromSelectedItems({ type: 'frame', item: updated });
      }
    } catch (error) { console.error('更新视频帧失败:', error); }
  };

  const handleSetFinalVideoFrame = async (frame: VideoFrame) => {
    if (!currentPeriod) return;
    try {
      await setFinalVideoFrame(currentPeriod.id, frame.id);
      setCurrentVideoFrames(currentVideoFrames.map(f => ({ ...f, is_final: f.id === frame.id })));
      setPeriods(periods.map(p =>
        p.id === currentPeriod.id ? { ...p, selected_photo_id: frame.id } : p
      ));
      setCurrentPeriod({ ...currentPeriod, selected_photo_id: frame.id });
    } catch (error) { console.error('设置最终视频帧失败:', error); }
  };

  const handleCancelFinalVideoFrame = async () => {
    if (!currentPeriod) return;
    try {
      await cancelFinalVideoFrame(currentPeriod.id);
      setCurrentVideoFrames(currentVideoFrames.map(f => ({ ...f, is_final: false })));
      setPeriods(periods.map(p =>
        p.id === currentPeriod.id ? { ...p, selected_photo_id: undefined } : p
      ));
      setCurrentPeriod({ ...currentPeriod, selected_photo_id: undefined });
    } catch (error) { console.error('取消最终视频帧失败:', error); }
  };

  // ============================
  // CONTEXT MENU
  // ============================

  const handlePhotoContextMenu = (e: React.MouseEvent, photo: Photo) => {
    e.preventDefault();
    setContextMenu({ visible: true, position: { x: e.clientX, y: e.clientY }, photo });
  };

  const handleCloseContextMenu = () => {
    setContextMenu({ visible: false, position: { x: 0, y: 0 }, photo: null });
  };

  // ============================
  // PREVIEW
  // ============================

  const handleOpenPreview = (index: number) => { setPreviewIndex(index); setShowPreview(true); };
  const handleClosePreview = () => setShowPreview(false);
  const handlePrevPhoto = () => {
    if (currentPhotos.length === 0) return;
    setPreviewIndex(prev => (prev - 1 + currentPhotos.length) % currentPhotos.length);
  };
  const handleNextPhoto = () => {
    if (currentPhotos.length === 0) return;
    setPreviewIndex(prev => (prev + 1) % currentPhotos.length);
  };

  // ============================
  // PENDING / COLLAGE ACTIONS
  // ============================

  const handleToggleMultiSelect = (item: SelectableItem) => {
    if (item.type === 'photo') {
      handleTogglePhotoSelect(item.item as Photo);
    } else {
      handleToggleFrameSelect(item.item as VideoFrame);
    }
  };

  const handleRemoveFromStash = (item: SelectableItem) => {
    if (item.type === 'photo') {
      handleTogglePhotoSelect({ ...(item.item as Photo), is_selected: true } as Photo);
    } else {
      handleToggleFrameSelect({ ...(item.item as VideoFrame), is_selected: true } as VideoFrame);
    }
  };

  const handleSelectSingle = (item: SelectableItem) => {
    if (item.type === 'photo') {
      handleSetFinalPhoto(item.item as Photo);
    } else {
      handleSetFinalVideoFrame(item.item as VideoFrame);
    }
  };

  const handleEnterCollage = () => {
    // Auto-recommend layout based on count
    const count = selectedItems.filter(i => i.item.is_selected).length;
    const layoutMap: Record<number, string> = { 2: '2up', 3: '3up-main', 4: '4grid' };
    setCollageLayout(layoutMap[count] || '4grid');
    setCollagePhotoOrder(selectedItems.filter(i => i.item.is_selected).map((_, i) => i));
    setCollageMode(true);
  };

  const handleGenerateCollage = (_layout: string, _gap: number, _order: number[]) => {
    // TODO: Call Rust backend to generate collage image via FFmpeg
    alert('拼图生成功能将在后端集成后可用');
    setCollageMode(false);
  };

  const handleExitCollage = () => {
    setCollageMode(false);
  };

  // ============================
  // VIDEO INLINE PLAYER
  // ============================

  const handleOpenInlinePlayer = (video: Video) => {
    setCurrentPlayingVideo(video);
    setShowVideoPlayer(true);
    setShowInlinePlayer(true);
  };

  const handleCloseInlinePlayer = () => {
    setShowInlinePlayer(false);
    setShowVideoPlayer(false);
    setCurrentPlayingVideo(null);
  };

  // ============================
  // RENDER: COLLAGE MODE
  // ============================

  if (collageMode) {
    return (
      <div className="flex h-full flex-col">
        <CollageWorkspace
          selectedItems={selectedItems.filter(i => i.item.is_selected)}
          loadedImages={loadedImages}
          onBack={handleExitCollage}
          onGenerate={handleGenerateCollage}
        />
      </div>
    );
  }

  // ============================
  // RENDER: VIDEO INLINE PLAYER
  // ============================

  if (showInlinePlayer && currentPlayingVideo) {
    return (
      <div className="flex h-full flex-col">
        <VideoFramePlayer
          video={currentPlayingVideo}
          onBack={handleCloseInlinePlayer}
          onCapture={(frame) => {
            addToSelectedItems({ type: 'frame', item: { ...frame, is_selected: true } });
          }}
          onAddToStash={(frame) => {
            addToSelectedItems({ type: 'frame', item: { ...frame, is_selected: true } });
          }}
          capturedFrames={currentVideoFrames}
          loadedImages={loadedImages}
        />
      </div>
    );
  }

  // ============================
  // RENDER: MAIN PAGE
  // ============================

  const completedCount = periods.filter(p => p.selected_photo_id).length;

  return (
    <div className="flex h-full flex-col">
      {/* ---- Top Toolbar ---- */}
      <div className="h-[52px] flex items-center justify-between px-5 border-b border-[#e8e6de] bg-white flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={handleScanFolder}
            disabled={isScanning || !currentPeriod}
            className="btn btn-primary btn-sm"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            {isScanning ? '扫描中...' : '扫描文件夹'}
          </button>

          {periods.length === 0 && (
            <button onClick={handleGeneratePeriods} className="btn btn-outline btn-sm">
              <Calendar className="w-3.5 h-3.5" />
              自动生成周期
            </button>
          )}

          <button
            onClick={() => setShowAddPeriod(true)}
            className="btn btn-ghost btn-sm text-[#706c63]"
          >
            <Plus className="w-3.5 h-3.5" />
            添加周期
          </button>
        </div>

        <div className="flex items-center gap-3">
          {currentPeriod && (
            <span className="text-xs text-[#b0aca0]">
              {completedCount}/{periods.length} 已完成
            </span>
          )}
        </div>
      </div>

      {/* ---- Period Timeline (Horizontal Steps) ---- */}
      <PeriodTimeline
        periods={periods}
        currentPeriod={currentPeriod}
        onSelectPeriod={setCurrentPeriod}
      />

      {/* ---- Add Period Form ---- */}
      {showAddPeriod && (
        <div className="p-4 border-b border-[#e8e6de] bg-[#fafaf8]">
          <div className="flex items-end gap-3 max-w-xl">
            <div className="form-group flex-1 !mb-0">
              <label className="form-label">周期名称</label>
              <input
                type="text"
                className="form-input"
                value={newPeriodName}
                onChange={(e) => setNewPeriodName(e.target.value)}
                placeholder="如：满月、百天"
              />
            </div>
            <div className="form-group flex-1 !mb-0">
              <label className="form-label">日期</label>
              <input
                type="date"
                className="form-input"
                value={newPeriodDate}
                onChange={(e) => setNewPeriodDate(e.target.value)}
              />
            </div>
            <button onClick={handleAddPeriod} className="btn btn-primary btn-sm h-[38px]">
              确认添加
            </button>
            <button onClick={() => setShowAddPeriod(false)} className="btn btn-ghost btn-sm h-[38px]">
              取消
            </button>
          </div>
        </div>
      )}

      {/* ---- Tab Bar ---- */}
      <div className="tab-bar-v2">
        <button
          onClick={() => { setSelectedTab('photos'); handleCloseContextMenu(); }}
          className={`tab-item-v2 ${selectedTab === 'photos' ? 'active' : ''}`}
        >
          <Image className="w-4 h-4" />
          全部照片
          <span className="tab-count-v2">{currentPhotos.length}</span>
        </button>
        <button
          onClick={() => { setSelectedTab('videos'); handleCloseContextMenu(); }}
          className={`tab-item-v2 ${selectedTab === 'videos' ? 'active' : ''}`}
        >
          <VideoIcon className="w-4 h-4" />
          视频
          <span className="tab-count-v2 video">{currentVideos.length}</span>
        </button>
        <button
          onClick={() => { setSelectedTab('pending'); handleCloseContextMenu(); }}
          className={`tab-item-v2 ${selectedTab === 'pending' ? 'active' : ''}`}
        >
          <Plus className="w-4 h-4" />
          待选区
          <span className="tab-count-v2 stash">{selectedItems.length}</span>
        </button>
      </div>

      {/* ---- Content Area ---- */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {!currentPeriod ? (
          <div className="empty-state-v2 flex-1">
            <Calendar className="w-16 h-16 text-[#d4d1c7] mb-4" />
            <h4>选择一个周期开始</h4>
            <p>在上方周期进度条中选择一个周期，或通过「扫描文件夹」导入照片</p>
          </div>
        ) : selectedTab === 'photos' ? (
          /* ===== PHOTOS TAB ===== */
          <div className="flex-1 overflow-hidden flex flex-col">
            {currentPhotos.length === 0 ? (
              <div className="empty-state-v2 flex-1">
                <Image className="w-16 h-16 text-[#d4d1c7] mb-4" />
                <h4>暂无照片</h4>
                <p>点击「扫描文件夹」导入照片，或从视频中截取画面</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between px-5 py-3">
                  <span className="text-xs text-[#706c63]">
                    显示 <strong className="text-[#33312d]">{currentPhotos.length}</strong> 张照片
                    {currentPeriod && (
                      <span className="ml-2 text-[#b0aca0]">
                        · {currentPeriod.start_date} ~ {currentPeriod.end_date}
                      </span>
                    )}
                  </span>
                </div>
                <div ref={gridWrapperRef} className="flex-1 overflow-hidden px-5 pb-5">
                  <VirtualPhotoGrid
                    photos={currentPhotos}
                    loadedImages={loadedImages}
                    parentRef={gridWrapperRef}
                    onContextMenu={handlePhotoContextMenu}
                    onDoubleClick={(photo) => {
                      const index = currentPhotos.findIndex(p => p.id === photo.id);
                      if (index !== -1) handleOpenPreview(index);
                    }}
                    onOpenPreview={handleOpenPreview}
                    className="w-full"
                  />
                </div>
              </>
            )}
          </div>
        ) : selectedTab === 'pending' ? (
          /* ===== PENDING TAB ===== */
          <div className="flex-1 overflow-hidden">
            <PendingSelectionPanel
              selectedItems={selectedItems}
              loadedImages={loadedImages}
              onToggleMultiSelect={handleToggleMultiSelect}
              onRemoveItem={handleRemoveFromStash}
              onSelectSingle={handleSelectSingle}
              onGenerateCollage={handleEnterCollage}
            />
          </div>
        ) : (
          /* ===== VIDEOS TAB ===== */
          <div className="flex-1 overflow-y-auto p-5">
            {currentVideos.length === 0 ? (
              <div className="empty-state-v2">
                <VideoIcon className="w-16 h-16 text-[#d4d1c7] mb-4" />
                <h4>暂无视频</h4>
                <p>点击「扫描文件夹」导入视频，然后从中截取画面</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {currentVideos.map((video) => (
                  <div
                    key={video.id}
                    className="cursor-pointer rounded-xl overflow-hidden bg-white border border-[#e8e6de] shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
                  >
                    {/* Thumbnail */}
                    <div
                      className="aspect-video bg-[#3a2010] relative overflow-hidden"
                      onClick={() => handleOpenInlinePlayer(video)}
                    >
                      {videoThumbnails[video.id] ? (
                        <img
                          src={videoThumbnails[video.id]}
                          alt={video.file_name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <div className="w-10 h-10 rounded-full bg-white/10 backdrop-blur flex items-center justify-center">
                            <VideoIcon className="w-5 h-5 text-white/60" />
                          </div>
                        </div>
                      )}
                      <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 bg-black/65 text-white text-[10px] font-medium rounded">
                        {Math.floor(video.duration / 60)}:{(video.duration % 60).toString().padStart(2, '0')}
                      </div>
                    </div>

                    {/* Info */}
                    <div className="p-3">
                      <p className="text-xs font-medium text-[#33312d] truncate">{video.file_name}</p>
                      <p className="text-[10px] text-[#b0aca0] mt-0.5">
                        {video.width}×{video.height}
                      </p>
                      <div className="flex gap-1.5 mt-2">
                        <button
                          onClick={() => handleExtractFrames(video)}
                          className="btn btn-outline btn-sm flex-1 text-[11px]"
                          disabled={isExtractingFrames}
                        >
                          {isExtractingFrames ? '抽帧中...' : videoFrameCounts[video.id] > 0 ? `查看(${videoFrameCounts[video.id]})` : '截取画面'}
                        </button>
                        <button
                          onClick={() => handleOpenInlinePlayer(video)}
                          className="btn btn-ghost btn-sm flex-1 text-[11px]"
                        >
                          播放
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ===== IMAGE PREVIEW MODAL ===== */}
      {showPreview && currentPhotos[previewIndex] && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 animate-fade-in"
          onClick={handleClosePreview}
        >
          <button
            className="absolute top-4 right-4 p-2 text-white/80 hover:text-white transition-colors"
            onClick={handleClosePreview}
          >
            <X className="w-8 h-8" />
          </button>

          <button
            className="absolute left-4 top-1/2 -translate-y-1/2 p-3 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-all"
            onClick={(e) => { e.stopPropagation(); handlePrevPhoto(); }}
          >
            <ChevronLeft className="w-10 h-10" />
          </button>

          <button
            className="absolute right-4 top-1/2 -translate-y-1/2 p-3 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-all"
            onClick={(e) => { e.stopPropagation(); handleNextPhoto(); }}
          >
            <ChevronRight className="w-10 h-10" />
          </button>

          <div className="max-w-[90vw] max-h-[85vh] flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
            <img
              src={loadedImages[currentPhotos[previewIndex].id] || ''}
              alt={currentPhotos[previewIndex].file_name}
              className="max-w-full max-h-[85vh] object-contain"
            />
          </div>

          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/80 text-sm">
            <span className="font-medium">{currentPhotos[previewIndex].file_name}</span>
            <span className="mx-2">·</span>
            <span>{previewIndex + 1} / {currentPhotos.length}</span>
          </div>
        </div>
      )}

      {/* ===== CONTEXT MENU ===== */}
      <PhotoContextMenu
        visible={contextMenu.visible}
        position={contextMenu.position}
        photo={contextMenu.photo}
        onAddToPending={(p) => { handleTogglePhotoSelect(p); handleCloseContextMenu(); }}
        onRemoveFromPending={(p) => { handleTogglePhotoSelect(p); handleCloseContextMenu(); }}
        onSetFinal={(p) => { handleSetFinalPhoto(p); handleCloseContextMenu(); }}
        onCancelFinal={() => { handleCancelFinalPhoto(); handleCloseContextMenu(); }}
        onPreview={(p) => {
          handleCloseContextMenu();
          const idx = currentPhotos.findIndex(ph => ph.id === p.id);
          if (idx !== -1) handleOpenPreview(idx);
        }}
        onClose={handleCloseContextMenu}
      />

      {/* ===== VIDEO FRAME SETTINGS MODAL ===== */}
      <VideoFrameSettingsModal
        visible={showFrameSettings}
        video={currentVideoForFrames}
        onClose={() => setShowFrameSettings(false)}
        onGenerate={handleGenerateFrames}
      />

      {/* ===== VIDEO FRAME VIEWER MODAL ===== */}
      <VideoFrameViewerModal
        visible={showFrameViewer}
        video={currentVideoForFrames}
        frames={currentVideoFrames}
        onClose={() => setShowFrameViewer(false)}
        onReExtract={() => { setShowFrameViewer(false); setShowFrameSettings(true); }}
        onToggleSelect={handleToggleFrameSelect}
        onSetFinal={handleSetFinalVideoFrame}
        onCancelFinal={handleCancelFinalVideoFrame}
        onPreview={() => {}}
      />
    </div>
  );
}
