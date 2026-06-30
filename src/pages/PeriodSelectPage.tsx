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
  getPeriodVideoFrames,
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
  getVideoThumbnail,
  getPeriodStats,
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
import TemplateSelector from '../components/TemplateSelector';
import { getTemplateById } from '../utils/collageTemplates';

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
  periodStats,
  setPeriodStats,
  updatePeriodStat,
  // Collage state
    collageMode,
    setCollageMode,
    setCollagePhotoOrder,
    resetRegionTransforms,
    // Video player state
    setShowVideoPlayer,
    currentPlayingVideo,
    setCurrentPlayingVideo,
  } = useAppStore();

  // ---- Local State ----
  const [showAddPeriod, setShowAddPeriod] = useState(false);
  const [newPeriodName, setNewPeriodName] = useState('');
  const [newPeriodDate, setNewPeriodDate] = useState('');
  const [selectedTab, setSelectedTab] = useState<'photos' | 'videos'>('photos');
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

  // Template selector state
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);

  // Draggable pending panel state
  const [pendingPanelWidth, setPendingPanelWidth] = useState(320);
  const [isDragging, setIsDragging] = useState(false);

  const handleMouseDown = () => setIsDragging(true);

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;
    const minWidth = 200;
    const maxWidth = window.innerWidth * 0.5;
    const newWidth = Math.max(minWidth, Math.min(maxWidth, e.clientX));
    setPendingPanelWidth(newWidth);
  };

  const handleMouseUp = () => setIsDragging(false);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

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
      resetRegionTransforms();
      setCurrentVideoForFrames(null);
      setVideoFrameCounts({});
    }
  }, [currentPeriod?.id]);

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
      const [periodsData, statsData] = await Promise.all([
        getPeriods(pid),
        getPeriodStats(pid),
      ]);
      setPeriods(periodsData);
      setPeriodStats(statsData);
      if (periodsData.length > 0 && !currentPeriod) setCurrentPeriod(periodsData[0]);
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
        .map(p => ({ type: 'photo' as const, item: { ...p, is_multi_selected: false } }));
      
      const frames = await getPeriodVideoFrames(periodId);
      setCurrentVideoFrames(frames);
      
      const pendingFrames: SelectableItem[] = frames
        .filter(f => f.is_selected)
        .map(f => ({ type: 'video_frame' as const, item: { ...f, is_multi_selected: false } }));
      
      const allPending = [...pendingPhotos, ...pendingFrames];
      if (allPending.length > 0) setSelectedItems(allPending);
      
      setSelectedTab('photos');
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
      const stats = await getPeriodStats(parseInt(projectId));
      setPeriodStats(stats);
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
      const newSelected = !photo.is_selected;
      const updated = await updatePhoto({ ...photo, is_selected: newSelected });
      const localUpdated = { ...updated, is_multi_selected: newSelected ? photo.is_multi_selected : false };
      setCurrentPhotos(currentPhotos.map(p => p.id === updated.id ? localUpdated : p));
      if (newSelected) {
        addToSelectedItems({ type: 'photo', item: localUpdated });
      } else {
        removeFromSelectedItems({ type: 'photo', item: localUpdated });
      }
      if (currentPeriod) {
        const currentStat = periodStats[currentPeriod.id];
        updatePeriodStat(currentPeriod.id, {
          pending_count: (currentStat?.pending_count || 0) + (newSelected ? 1 : -1),
        });
      }
    } catch (error) { console.error('更新照片失败:', error); }
  };

  const handleSetFinalPhoto = async (photo: Photo) => {
    if (!currentPeriod) return;
    try {
      await setFinalPhoto(currentPeriod.id, photo.id);
      setCurrentPhotos(currentPhotos.map(p => ({ ...p, is_final: p.id === photo.id })));
      // 同步待选区中的 is_final 状态，确保照片留在待选区中
      setSelectedItems(selectedItems.map(item =>
        item.type === 'photo' && item.item.id === photo.id
          ? { ...item, item: { ...item.item, is_final: true } }
          : item
      ));
      const updatedPeriods = periods.map(p =>
        p.id === currentPeriod.id ? { ...p, selected_photo_id: photo.id } : p
      );
      setPeriods(updatedPeriods);
      setCurrentPeriod({ ...currentPeriod, selected_photo_id: photo.id });
      updatePeriodStat(currentPeriod.id, { has_final: true });
    } catch (error) { console.error('设置最终照片失败:', error); }
  };

  const handleCancelFinalPhoto = async () => {
    if (!currentPeriod) return;
    try {
      await cancelFinalPhoto(currentPeriod.id);
      setCurrentPhotos(currentPhotos.map(p => ({ ...p, is_final: false })));
      // 同步待选区中所有照片的 is_final 状态
      setSelectedItems(selectedItems.map(item =>
        item.type === 'photo'
          ? { ...item, item: { ...item.item, is_final: false } }
          : item
      ));
      setPeriods(periods.map(p =>
        p.id === currentPeriod.id ? { ...p, selected_photo_id: undefined } : p
      ));
      setCurrentPeriod({ ...currentPeriod, selected_photo_id: undefined });
      updatePeriodStat(currentPeriod.id, { has_final: false });
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
      const newSelected = !frame.is_selected;
      const updated = await updateVideoFrame({ ...frame, is_selected: newSelected });
      const localUpdated = { ...updated, is_multi_selected: newSelected ? frame.is_multi_selected : false };
      setCurrentVideoFrames(currentVideoFrames.map(f => f.id === updated.id ? localUpdated : f));
      if (newSelected) {
        addToSelectedItems({ type: 'video_frame', item: localUpdated });
      } else {
        removeFromSelectedItems({ type: 'video_frame', item: localUpdated });
      }
      if (currentPeriod) {
        const currentStat = periodStats[currentPeriod.id];
        updatePeriodStat(currentPeriod.id, {
          pending_count: (currentStat?.pending_count || 0) + (newSelected ? 1 : -1),
        });
      }
    } catch (error) { console.error('更新视频帧失败:', error); }
  };

  const handleSetFinalVideoFrame = async (frame: VideoFrame) => {
    if (!currentPeriod) return;
    try {
      await setFinalVideoFrame(currentPeriod.id, frame.id);
      setCurrentVideoFrames(currentVideoFrames.map(f => ({ ...f, is_final: f.id === frame.id })));
      // 同步待选区中的 is_final 状态
      setSelectedItems(selectedItems.map(item =>
        item.type === 'video_frame' && item.item.id === frame.id
          ? { ...item, item: { ...item.item, is_final: true } }
          : item
      ));
      setPeriods(periods.map(p =>
        p.id === currentPeriod.id ? { ...p, selected_photo_id: frame.id } : p
      ));
      setCurrentPeriod({ ...currentPeriod, selected_photo_id: frame.id });
      updatePeriodStat(currentPeriod.id, { has_final: true });
    } catch (error) { console.error('设置最终视频帧失败:', error); }
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
      const photo = item.item as Photo;
      const updated = { ...photo, is_multi_selected: !photo.is_multi_selected };
      setCurrentPhotos(currentPhotos.map(p => p.id === photo.id ? updated : p));
      setSelectedItems(selectedItems.map(i => 
        i.type === 'photo' && i.item.id === photo.id 
          ? { type: 'photo' as const, item: updated } 
          : i
      ));
    } else {
      const frame = item.item as VideoFrame;
      const updated = { ...frame, is_multi_selected: !frame.is_multi_selected };
      setCurrentVideoFrames(currentVideoFrames.map(f => f.id === frame.id ? updated : f));
      setSelectedItems(selectedItems.map(i => 
        i.type === 'video_frame' && i.item.id === frame.id 
          ? { type: 'video_frame' as const, item: updated } 
          : i
      ));
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
    // 获取已勾选的照片
    const multiSelected = selectedItems.filter(i => i.item.is_multi_selected);

    // 补全 photoOrder 为初始顺序
    setCollagePhotoOrder(multiSelected.map((_, i) => i));

    // 重置区域编辑状态
    resetRegionTransforms();

    // 显示模板选择器（内部会自动匹配 count 数量的模板）
    setShowTemplateSelector(true);
  };

  const handleTemplateConfirm = () => {
    setShowTemplateSelector(false);
    setCollageMode(true);
  };

  const handleTemplateCancel = () => {
    setShowTemplateSelector(false);
  };

  const handleGenerateCollage = async (
    templateId: string,
    gap: number,
    order: number[],
    transforms: Record<number, { rotation: number; flipH: boolean; flipV: boolean }>,
    quality: number,
    outputSize: number,
  ) => {
    // Build the payload for Rust backend
    const multiSelected = selectedItems.filter(i => i.item.is_multi_selected);
    const photoPaths = order.map(idx => {
      const item = multiSelected[idx];
      return item.type === 'photo'
        ? (item.item as Photo).file_path
        : (item.item as VideoFrame).file_path;
    });

    // Build region definitions from the template
    const template = getTemplateById(templateId);
    if (!template) {
      alert('未找到模板');
      return;
    }

    const collagePayload = {
      template_id: templateId,
      output_width: outputSize,
      output_height: outputSize,
      gap_px: gap,
      jpeg_quality: quality,
      photo_paths: photoPaths,
      regions: template.regions.map((r, idx) => ({
        x: r.x,
        y: r.y,
        w: r.w,
        h: r.h,
        order: r.order,
        rotation: transforms[idx]?.rotation ?? 0,
        flip_h: transforms[idx]?.flipH ?? false,
        flip_v: transforms[idx]?.flipV ?? false,
      })),
    };

    console.log('拼图生成请求:', collagePayload);

    // TODO: Call Rust backend to generate collage
    // const outputPath = await generateCollage(collagePayload);
    // Then add to pending selection:
    // if (outputPath) {
    //   const newPhoto = await addCollagePhoto(currentPeriod!.id, outputPath);
    //   addToSelectedItems({ type: 'photo', item: { ...newPhoto, is_multi_selected: false } });
    // }

    alert(
      `拼图生成参数已就绪：\n` +
      `模板: ${template.name}\n` +
      `输出尺寸: ${outputSize}×${outputSize}\n` +
      `JPEG质量: ${quality}%\n` +
      `间距: ${gap}px\n` +
      `照片数: ${photoPaths.length}\n` +
      `含变换区域: ${Object.values(transforms).filter(t => t.rotation !== 0 || t.flipH || t.flipV).length}\n\n` +
      `后端接口集成后将自动生成并放入待选区`
    );
    setCollageMode(false);
  };

  const handleExitCollage = () => {
    resetRegionTransforms();
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
          selectedItems={selectedItems.filter(i => i.item.is_multi_selected)}
          loadedImages={loadedImages}
          pendingItems={selectedItems}
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
            addToSelectedItems({ type: 'video_frame', item: { ...frame, is_selected: true } });
          }}
          onAddToStash={(frame) => {
            addToSelectedItems({ type: 'video_frame', item: { ...frame, is_selected: true } });
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
    <div className="flex h-full flex-col min-h-0">
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

      {/* ---- Fixed Header Section ---- */}
      <div className="flex-shrink-0">
        {/* ---- Period Timeline (Horizontal Steps) ---- */}
        <PeriodTimeline
          periods={periods}
          currentPeriod={currentPeriod}
          onSelectPeriod={setCurrentPeriod}
          periodStats={periodStats}
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

        </div>

      {/* ---- Content Area ---- */}
      <div className="flex-1 flex min-h-0">
        {/* 左侧待选区面板 */}
        <div 
          className="flex-shrink-0 border-r border-[#e8e6de] bg-white flex flex-col"
          style={{ width: pendingPanelWidth }}
        >
          <PendingSelectionPanel
            selectedItems={selectedItems}
            loadedImages={loadedImages}
            onToggleMultiSelect={handleToggleMultiSelect}
            onRemoveItem={handleRemoveFromStash}
            onSelectSingle={handleSelectSingle}
            onGenerateCollage={handleEnterCollage}
            onPreview={(item) => {
              if (item.type === 'photo') {
                const index = currentPhotos.findIndex(p => p.id === item.item.id);
                if (index !== -1) handleOpenPreview(index);
              }
            }}
          />
        </div>
        
        {/* 拖拽分割条 */}
        <div 
          className={`w-1 cursor-col-resize bg-[#e8e6de] hover:bg-[#d4d1c7] transition-colors flex-shrink-0 flex items-center justify-center ${isDragging ? 'bg-[#7c5cbf]' : ''}`}
          onMouseDown={handleMouseDown}
        >
          <div className="w-3 h-8 bg-[#c4c0b6] rounded-full" />
        </div>
        
        {/* 右侧内容区 */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {!currentPeriod ? (
            <div className="empty-state-v2 flex-1">
              <Calendar className="w-16 h-16 text-[#d4d1c7] mb-4" />
              <h4>选择一个周期开始</h4>
              <p>在上方周期进度条中选择一个周期，或通过「扫描文件夹」导入照片</p>
            </div>
          ) : (
            <>
              {/* 标签页 */}
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
              </div>
              
              {/* 内容区域 */}
              <div className="flex-1 overflow-hidden">
                {selectedTab === 'photos' && (
                  <div className="h-full overflow-y-auto">
                    {currentPhotos.length === 0 ? (
                      <div className="empty-state-v2 flex-1 h-full flex flex-col items-center justify-center">
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
                        <div 
                          ref={gridWrapperRef} 
                          className="h-full overflow-y-auto px-5 pb-5"
                        >
                          <VirtualPhotoGrid
                            photos={currentPhotos}
                            loadedImages={loadedImages}
                            onContextMenu={handlePhotoContextMenu}
                            onDoubleClick={(photo) => {
                              const index = currentPhotos.findIndex(p => p.id === photo.id);
                              if (index !== -1) handleOpenPreview(index);
                            }}
                            onToggleSelect={handleTogglePhotoSelect}
                            onSetFinal={handleSetFinalPhoto}
                            onCancelFinal={() => handleCancelFinalPhoto()}
                            onOpenPreview={handleOpenPreview}
                          />
                        </div>
                      </>
                    )}
                  </div>
                )}
                {selectedTab === 'videos' && (
                  <div className="h-full overflow-y-auto p-5">
                    {currentVideos.length === 0 ? (
                      <div className="empty-state-v2">
                        <VideoIcon className="w-16 h-16 text-[#d4d1c7] mb-4" />
                        <h4>暂无视频</h4>
                        <p>点击「扫描文件夹」导入视频，然后从中截取画面</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-3">
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
            </>
          )}
          
          {/* 底部统计栏 */}
          <div className="flex-shrink-0 border-t border-[#e8e6de] bg-white px-5 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded-full bg-[#7c5cbf] flex items-center justify-center">
                  <Plus className="w-2.5 h-2.5 text-white" />
                </div>
                <span className="text-xs text-[#706c63]">待选区 <strong className="text-[#7c5cbf]">{selectedItems.length}</strong></span>
              </div>
              <div className="flex items-center gap-1.5">
                <Image className="w-4 h-4 text-[#f58b3d]" />
                <span className="text-xs text-[#706c63]">照片 <strong className="text-[#33312d]">{currentPhotos.length}</strong></span>
              </div>
              <div className="flex items-center gap-1.5">
                <VideoIcon className="w-4 h-4 text-[#10b981]" />
                <span className="text-xs text-[#706c63]">视频 <strong className="text-[#33312d]">{currentVideos.length}</strong></span>
              </div>
            </div>
          </div>
        </div>
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

      {/* ===== TEMPLATE SELECTOR MODAL ===== */}
      {showTemplateSelector && (
        <TemplateSelector
          photoCount={
            selectedItems.filter(i => i.item.is_multi_selected).length
          }
          onConfirm={handleTemplateConfirm}
          onCancel={handleTemplateCancel}
        />
      )}

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
        onPreview={() => {}}
        onAddSingle={(frame) => {
          addToSelectedItems({ type: 'video_frame', item: { ...frame, is_selected: true, is_multi_selected: false } });
        }}
        onConfirmSelection={(selectedFrames) => {
          selectedFrames.forEach(frame => {
            addToSelectedItems({ type: 'video_frame', item: { ...frame, is_selected: true, is_multi_selected: false } });
          });
          setShowFrameViewer(false);
        }}
      />
    </div>
  );
}
