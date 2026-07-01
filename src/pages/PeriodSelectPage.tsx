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
  Download,
} from 'lucide-react';
import { useAppStore } from '../store';
import { showToast } from '../store/toastStore';
import {
  getPeriods,
  generatePeriods,
  createPeriod,
  getPeriodVideos,
  scanPeriodFolder,
  selectFolder,
  generateVideoFrames,
  generateVideoFramesByInterval,
  getVideoThumbnail,
  getPeriodStats,
  generateCollage,
  exportProjectPhotos,
  saveFile,
  getOriginalFile,
} from '../utils/tauriCommands';
import type { Video, Thumbnail } from '../types';
import ThumbnailGrid from '../components/ThumbnailGrid';
import ThumbnailPreviewModal from '../components/ThumbnailPreviewModal';
import VideoFrameSettingsModal from '../components/VideoFrameSettingsModal';
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
    currentVideos,
    setCurrentVideos,
    isScanning,
    setIsScanning,
    currentBaby,
    periodStats,
    setPeriodStats,
    loadPendingItems,
    loadTempFrames,
    // Collage state
    collageMode,
    setCollageMode,
    setCollagePhotoOrder,
    resetRegionTransforms,
    // Video player state
    setShowVideoPlayer,
    currentPlayingVideo,
    setCurrentPlayingVideo,
    // Thumbnail state
    thumbnails,
    pendingThumbnails,
    loadThumbnails,
    addThumbToPending,
    setThumbAsFinal,
    cancelThumbFinal,
    currentProject,
  } = useAppStore();

  // ---- Local State ----
  const [showAddPeriod, setShowAddPeriod] = useState(false);
  const [newPeriodName, setNewPeriodName] = useState('');
  const [newPeriodDate, setNewPeriodDate] = useState('');
  const [selectedTab, setSelectedTab] = useState<'photos' | 'videos' | 'pending'>('photos');
  const [loadedImages, setLoadedImages] = useState<Record<number, string>>({});
  const loadedImageIds = useRef<Set<number>>(new Set());
  const [showPreview, setShowPreview] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState<string | null>(null);
  const [pendingPreviewLoading, setPendingPreviewLoading] = useState(false);
  const [previewingPendingItem, setPreviewingPendingItem] = useState<Thumbnail | null>(null);
  const pendingPreviewRequestIdRef = useRef(0);

  const [currentVideoForFrames, setCurrentVideoForFrames] = useState<Video | null>(null);
  const [showFrameSettings, setShowFrameSettings] = useState(false);
  const [isExtractingFrames, setIsExtractingFrames] = useState(false);
  const [videoFrameCounts, setVideoFrameCounts] = useState<Record<number, number>>({});
  const [videoThumbnails, setVideoThumbnails] = useState<Record<number, string>>({});

  // Inline video player state
  const [showInlinePlayer, setShowInlinePlayer] = useState(false);

  // Template selector state
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [collagePhotoCount, setCollagePhotoCount] = useState(0);

  // Draggable pending panel state
  const [pendingPanelWidth, setPendingPanelWidth] = useState(320);
  const [isDragging, setIsDragging] = useState(false);

  // Loading states
  const [loadingPeriods, setLoadingPeriods] = useState(true);
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [generatingPeriods, setGeneratingPeriods] = useState(false);
  const [addingPeriod, setAddingPeriod] = useState(false);
  const [generatingCollage, setGeneratingCollage] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Thumbnail preview state
  const [previewThumb, setPreviewThumb] = useState<Thumbnail | null>(null);
  const [thumbShowPreview, setThumbShowPreview] = useState(false);

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

  // Load periods
  useEffect(() => {
    if (projectId) loadPeriods(parseInt(projectId));
  }, [projectId]);

  // Load media on period change
  useEffect(() => {
    if (currentPeriod) {
      loadPeriodMedia(currentPeriod.id);
      loadPendingItems(currentPeriod.id);
      loadThumbnails(currentPeriod.id);
      setShowPreview(false);
      setPreviewIndex(0);
      setPendingPreviewUrl(null);
      setPendingPreviewLoading(false);
      setShowFrameSettings(false);
      setShowInlinePlayer(false);
      setCollageMode(false);
      resetRegionTransforms();
      setCurrentVideoForFrames(null);
      setVideoFrameCounts({});
      setThumbShowPreview(false);
      setPreviewThumb(null);
    }
  }, [currentPeriod?.id]);

  // Load thumbnail base64 images
  useEffect(() => {
    const newLoadedImages: Record<number, string> = {};
    thumbnails.forEach(thumb => {
      if (thumb.base64_data) {
        newLoadedImages[thumb.id] = thumb.base64_data;
      }
    });
    setLoadedImages(newLoadedImages);
  }, [thumbnails]);

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
    finally { setLoadingPeriods(false); }
  };

  const loadPeriodMedia = async (periodId: number) => {
    setLoadingMedia(true);
    try {
      setLoadedImages({});
      loadedImageIds.current.clear();
      const videos = await getPeriodVideos(periodId);
      setCurrentVideos(videos);
      setSelectedTab('photos');
    } catch (error) { console.error('加载周期媒体失败:', error); }
    finally { setLoadingMedia(false); }
  };

  // ============================
  // PERIOD ACTIONS
  // ============================

  const handleGeneratePeriods = async () => {
    if (!projectId || !currentBaby) return;
    setGeneratingPeriods(true);
    try {
      const data = await generatePeriods(parseInt(projectId), currentBaby.birth_date, 7);
      setPeriods(data);
      if (data.length > 0) setCurrentPeriod(data[0]);
    } catch (error) { console.error('生成周期失败:', error); }
    finally { setGeneratingPeriods(false); }
  };

  const handleScanFolder = async () => {
    if (!projectId || !currentPeriod) return;
    const folderPath = await selectFolder();
    if (!folderPath) return;
    setIsScanning(true);
    try {
      const result = await scanPeriodFolder(parseInt(projectId), currentPeriod.id, folderPath);
      await loadPeriodMedia(currentPeriod.id);
      const stats = await getPeriodStats(parseInt(projectId));
      setPeriodStats(stats);

      // 汇总扫描结果，给用户明确反馈
      const {
        total_photos,
        total_videos,
        recognized_photos,
        recognized_videos,
        skipped_no_date_photos,
        skipped_no_period_photos,
        skipped_duplicate_photos,
        skipped_copy_failed_photos,
      } = result;
      const skippedPhotos =
        skipped_no_date_photos +
        skipped_no_period_photos +
        skipped_duplicate_photos +
        skipped_copy_failed_photos;

      if (recognized_photos > 0 || recognized_videos > 0) {
        showToast(
          'success',
          '扫描完成',
          `识别到 ${recognized_photos} 张照片、${recognized_videos} 个视频`
        );
      } else if (total_photos === 0 && total_videos === 0) {
        showToast('info', '扫描完成', '文件夹中没有找到照片或视频文件');
      } else if (skippedPhotos > 0) {
        const reasons: string[] = [];
        if (skipped_no_date_photos > 0) reasons.push(`${skipped_no_date_photos} 张无法识别日期`);
        if (skipped_no_period_photos > 0) reasons.push(`${skipped_no_period_photos} 张不在当前周期内`);
        if (skipped_duplicate_photos > 0) reasons.push(`${skipped_duplicate_photos} 张重复`);
        if (skipped_copy_failed_photos > 0) reasons.push(`${skipped_copy_failed_photos} 张复制失败`);
        showToast(
          'warning',
          '未识别到照片',
          `跳过 ${skippedPhotos} 张照片：${reasons.join('，')}。可在「历史记录」查看详情`
        );
      } else {
        showToast('info', '扫描完成', '当前周期内没有匹配的照片或视频');
      }
    } catch (error) {
      console.error('扫描失败:', error);
      showToast('error', '扫描失败', '扫描文件夹失败，请重试');
    } finally { setIsScanning(false); }
  };

  const handleAddPeriod = async () => {
    if (!projectId || !newPeriodName || !newPeriodDate) return;
    setAddingPeriod(true);
    try {
      const period = await createPeriod({
        project_id: parseInt(projectId), name: newPeriodName,
        start_date: newPeriodDate, end_date: newPeriodDate,
        period_type: 'custom', sort_order: periods.length,
      });
      setPeriods([...periods, period].sort((a, b) => a.start_date.localeCompare(b.start_date)));
      setShowAddPeriod(false);
      setNewPeriodName('');
      setNewPeriodDate('');
    } catch (error) { console.error('添加周期失败:', error); }
    finally { setAddingPeriod(false); }
  };

  // ============================
  // PHOTO ACTIONS (now using thumbnails)
  // ============================

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
      if (mode === 'count') {
        await generateVideoFrames(currentVideoForFrames!.id, value);
      } else {
        await generateVideoFramesByInterval(currentVideoForFrames!.id, value);
      }
      await loadTempFrames(currentVideoForFrames!.id);
      setCurrentPlayingVideo(currentVideoForFrames);
      setShowVideoPlayer(true);
      setShowInlinePlayer(true);
    } catch (error) { showToast('error', '抽帧失败', '请重试'); }
    finally { setIsExtractingFrames(false); }
  };

  // ============================
  // PREVIEW
  // ============================

  const handleClosePreview = () => {
    pendingPreviewRequestIdRef.current += 1;
    setShowPreview(false);
    setPreviewingPendingItem(null);
    setPendingPreviewUrl(null);
    setPendingPreviewLoading(false);
  };
  const handlePrevPhoto = () => {
    if (previewingPendingItem || thumbnails.length === 0) return;
    setPreviewIndex(prev => (prev - 1 + thumbnails.length) % thumbnails.length);
  };
  const handleNextPhoto = () => {
    if (previewingPendingItem || thumbnails.length === 0) return;
    setPreviewIndex(prev => (prev + 1) % thumbnails.length);
  };

  // ============================
  // PENDING / COLLAGE ACTIONS
  // ============================

  const handlePendingPreview = async (thumb: Thumbnail) => {
    const requestId = pendingPreviewRequestIdRef.current + 1;
    pendingPreviewRequestIdRef.current = requestId;
    setPreviewingPendingItem(thumb);
    setPendingPreviewUrl(null);
    setPendingPreviewLoading(true);
    setShowPreview(true);

    try {
      const originalUrl = await getOriginalFile(thumb.id);
      if (pendingPreviewRequestIdRef.current !== requestId) return;
      setPendingPreviewUrl(originalUrl);
    } catch (error) {
      if (pendingPreviewRequestIdRef.current !== requestId) return;
      console.error('Failed to load pending original:', error);
      setPendingPreviewUrl(thumb.base64_data);
    } finally {
      if (pendingPreviewRequestIdRef.current !== requestId) return;
      setPendingPreviewLoading(false);
    }
  };

  // ============================
  // THUMBNAIL HANDLERS
  // ============================

  // 处理缩略图预览
  const handleThumbPreview = (thumb: Thumbnail) => {
    setPreviewThumb(thumb);
    setThumbShowPreview(true);
  };

  // 处理加入候选区
  const handleAddThumbToPending = (thumb: Thumbnail) => {
    addThumbToPending(thumb.id);
  };

  // 处理设为最终
  const handleSetThumbFinal = (thumb: Thumbnail) => {
    setThumbAsFinal(thumb.id);
  };

  // 处理取消最终
  const handleCancelThumbFinal = () => {
    cancelThumbFinal();
  };

  const handleEnterCollage = (selectedThumbs: Thumbnail[] = []) => {
    const thumbs = selectedThumbs.length > 0 ? selectedThumbs : pendingThumbnails;
    setCollagePhotoCount(thumbs.length);
    setCollagePhotoOrder(thumbs.map((_, i) => i));
    resetRegionTransforms();
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
    projectIdParam: number,
    periodIdParam: number,
  ) => {
    const selectedThumbs = pendingThumbnails;
    const photoPaths = order.map(idx => {
      const thumb = selectedThumbs[idx];
      if (!thumb) {
        showToast('error', '拼图生成失败', '照片索引错误');
        return '';
      }
      return thumb.original_path;
    });

    if (photoPaths.some(p => p === '')) {
      return;
    }

    const template = getTemplateById(templateId);
    if (!template) {
      showToast('error', '模板错误', '未找到模板，请重试');
      return;
    }

    const collagePayload = {
      template_id: templateId,
      period_id: periodIdParam,
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

    setGeneratingCollage(true);
    try {
      const result = await generateCollage(collagePayload, projectIdParam);

      if (!result.output_path) {
        showToast('error', '拼图生成失败', '返回的输出路径为空');
        return;
      }

      await loadThumbnails(periodIdParam);

      showToast(
        'success',
        '拼图生成成功',
        `已生成 ${outputSize}×${outputSize} 拼图，已放入待选区`
      );
    } catch (error) {
      console.error('拼图生成失败:', error);
      const errorMsg = error instanceof Error 
        ? error.message 
        : String(error);
      showToast('error', '拼图生成失败', errorMsg);
    } finally {
      setGeneratingCollage(false);
      setCollageMode(false);
    }
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
    const selectedThumbs = pendingThumbnails;
    return (
      <div className="flex h-full flex-col">
        <CollageWorkspace
          selectedItems={selectedThumbs}
          loadedImages={loadedImages}
          pendingItems={pendingThumbnails}
          onBack={handleExitCollage}
          onGenerate={handleGenerateCollage}
          generating={generatingCollage}
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
        />
      </div>
    );
  }

  // ============================
  // RENDER: MAIN PAGE
  // ============================

  const completedCount = periods.filter(p => p.selected_photo_id).length;

  const handleExport = async () => {
    if (!projectId || isExporting) return;

    const completedPeriods = periods.filter(p => p.selected_photo_id);
    if (completedPeriods.length === 0) {
      showToast('warning', '无法导出', '没有可导出的照片，请先在周期中确认最终照片');
      return;
    }

    const formatDateShort = (dateStr: string) => {
      const d = new Date(dateStr);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}${m}${day}`;
    };

    const earliest = formatDateShort(completedPeriods[0].start_date);
    const latest = formatDateShort(completedPeriods[completedPeriods.length - 1].end_date);
    const defaultName = `${currentProject?.name || '导出'}-${earliest}-${latest}.zip`;

    const savePath = await saveFile(defaultName);
    if (!savePath) return;

    setIsExporting(true);
    try {
      const result = await exportProjectPhotos(parseInt(projectId), savePath);
      const sizeMB = (result.total_size / 1024 / 1024).toFixed(1);
      showToast(
        'success',
        '导出成功',
        `${result.photo_count} 张照片 · ${sizeMB} MB`
      );
    } catch (error: any) {
      if (error?.toString?.().includes('没有可导出的照片')) {
        showToast('warning', '无法导出', error.toString());
      } else {
        showToast('error', '导出失败', error?.toString?.() || '导出过程中发生错误');
      }
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex h-full flex-col min-h-0">
      {/* ---- Top Toolbar ---- */}
      <div className="h-[52px] flex items-center justify-between px-5 border-b border-stone-200 bg-white flex-shrink-0">
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
            <button
              onClick={handleGeneratePeriods}
              disabled={generatingPeriods}
              className="btn btn-outline btn-sm flex items-center gap-2"
            >
              <Calendar className={`w-3.5 h-3.5 ${generatingPeriods ? 'animate-spin' : ''}`} />
              {generatingPeriods ? '生成中...' : '自动生成周期'}
            </button>
          )}

            <button
            onClick={() => setShowAddPeriod(true)}
            disabled={addingPeriod}
            className="btn btn-ghost btn-sm text-stone-600 flex items-center gap-2"
          >
            <Plus className="w-3.5 h-3.5" />
            {addingPeriod ? '添加中...' : '添加周期'}
          </button>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExport}
            disabled={isExporting || periods.filter(p => p.selected_photo_id).length === 0}
            className="btn btn-primary btn-sm flex items-center gap-2"
            title="导出所有周期的最终确认照片为 ZIP"
          >
            <Download className="w-3.5 h-3.5" />
            {isExporting ? '正在导出...' : '导出照片'}
          </button>
          {currentPeriod && (
            <span className="text-xs text-stone-400">
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
          <div className="p-4 border-b border-stone-200 bg-stone-50">
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
              <button
                onClick={handleAddPeriod}
                disabled={addingPeriod}
                className="btn btn-primary btn-sm h-[38px] flex items-center gap-2"
              >
                {addingPeriod && <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {addingPeriod ? '添加中...' : '确认添加'}
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
          className="flex-shrink-0 border-r border-stone-200 bg-white flex flex-col"
          style={{ width: pendingPanelWidth }}
        >
          <PendingSelectionPanel
            onGenerateCollage={handleEnterCollage}
            onPreview={handlePendingPreview}
          />
        </div>
        
        {/* 拖拽分割条 */}
        <div 
          className={`w-1 cursor-col-resize bg-stone-200 hover:bg-stone-300 transition-colors flex-shrink-0 flex items-center justify-center ${isDragging ? 'bg-stash-600' : ''}`}
          onMouseDown={handleMouseDown}
        >
          <div className="w-3 h-8 bg-stone-300 rounded-full" />
        </div>
        
        {/* 右侧内容区 */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {loadingPeriods ? (
            <div className="empty-state-v2 flex-1">
              <div className="w-8 h-8 border-2 border-stone-200 border-t-warmth-400 rounded-full animate-spin mb-4" />
              <h4>加载周期中...</h4>
              <p>请稍候，正在加载项目周期信息</p>
            </div>
          ) : !currentPeriod ? (
            <div className="empty-state-v2 flex-1">
              <Calendar className="w-16 h-16 text-stone-300 mb-4" />
              <h4>选择一个周期开始</h4>
              <p>在上方周期进度条中选择一个周期，或通过「扫描文件夹」导入照片</p>
            </div>
          ) : loadingMedia ? (
            <div className="empty-state-v2 flex-1">
              <div className="w-8 h-8 border-2 border-stone-200 border-t-warmth-400 rounded-full animate-spin mb-4" />
              <h4>加载媒体中...</h4>
              <p>请稍候，正在加载照片和视频</p>
            </div>
          ) : (
            <>
              {/* 标签页 */}
              <div className="tab-bar-v2">
                <button
                  onClick={() => { setSelectedTab('photos'); }}
                  className={`tab-item-v2 ${selectedTab === 'photos' ? 'active' : ''}`}
                >
                  <Image className="w-4 h-4" />
                  全部照片
                  <span className="tab-count-v2">{thumbnails.length}</span>
                </button>
                <button
                  onClick={() => { setSelectedTab('videos'); }}
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
                    {thumbnails.length > 0 ? (
                      <ThumbnailGrid
                        thumbnails={thumbnails}
                        onPreview={handleThumbPreview}
                        onAddToPending={handleAddThumbToPending}
                        onSetFinal={handleSetThumbFinal}
                        onCancelFinal={handleCancelThumbFinal}
                      />
                    ) : (
                      <div className="empty-state-v2 flex-1 h-full flex flex-col items-center justify-center">
                        <div className="empty-icon">📷</div>
                        <h4>暂无照片</h4>
                        <p>扫描文件夹或从视频中截取帧来添加照片</p>
                      </div>
                    )}
                  </div>
                )}
                {selectedTab === 'videos' && (
                  <div className="h-full overflow-y-auto p-5">
                    {currentVideos.length === 0 ? (
                      <div className="empty-state-v2">
                        <VideoIcon className="w-16 h-16 text-stone-300 mb-4" />
                        <h4>暂无视频</h4>
                        <p>点击「扫描文件夹」导入视频，然后从中截取画面</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-3">
                        {currentVideos.map((video) => (
                          <div
                            key={video.id}
                            className="cursor-pointer rounded-xl overflow-hidden bg-white border border-stone-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
                          >
                            {/* Thumbnail */}
                            <div
                              className="aspect-video bg-warmth-950 relative overflow-hidden"
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
                              <p className="text-xs font-medium text-stone-900 truncate">{video.file_name}</p>
                              <p className="text-[10px] text-stone-400 mt-0.5">
                                {video.width}×{video.height}
                              </p>
                              <div className="flex gap-1.5 mt-2">
                                <button
                                  onClick={() => handleExtractFrames(video)}
                                  className="btn btn-primary btn-sm flex-1 text-[11px]"
                                  disabled={isExtractingFrames}
                                >
                                  {isExtractingFrames ? '抽帧中...' : videoFrameCounts[video.id] > 0 ? `查看(${videoFrameCounts[video.id]})` : '截取画面'}
                                </button>
                                <button
                                  onClick={() => handleOpenInlinePlayer(video)}
                                  className="btn btn-secondary btn-sm flex-1 text-[11px]"
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
          <div className="flex-shrink-0 border-t border-stone-200 bg-white px-5 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded-full bg-stash-600 flex items-center justify-center">
                  <Plus className="w-2.5 h-2.5 text-white" />
                </div>
                <span className="text-xs text-stone-600">待选区 <strong className="text-stash-600">{pendingThumbnails.length}</strong></span>
              </div>
              <div className="flex items-center gap-1.5">
                <Image className="w-4 h-4 text-warmth-500" />
                <span className="text-xs text-stone-600">照片 <strong className="text-stone-900">{thumbnails.length}</strong></span>
              </div>
              <div className="flex items-center gap-1.5">
                <VideoIcon className="w-4 h-4 text-success" />
                <span className="text-xs text-stone-600">视频 <strong className="text-stone-900">{currentVideos.length}</strong></span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ===== IMAGE PREVIEW MODAL ===== */}
      {showPreview && (previewingPendingItem || thumbnails[previewIndex]) && (
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

          {!previewingPendingItem && (
            <>
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
            </>
          )}

          <div className="max-w-[90vw] max-h-[85vh] flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
            {previewingPendingItem && pendingPreviewLoading ? (
              <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin" />
            ) : (
              <img
                src={previewingPendingItem ? pendingPreviewUrl || '' : loadedImages[thumbnails[previewIndex]?.id] || ''}
                alt={previewingPendingItem ? previewingPendingItem.original_file_name : thumbnails[previewIndex]?.original_file_name || ''}
                className="max-w-full max-h-[85vh] object-contain"
              />
            )}
          </div>

          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/80 text-sm">
            <span className="font-medium">
              {previewingPendingItem
                ? previewingPendingItem.original_file_name
                : thumbnails[previewIndex]?.original_file_name || ''}
            </span>
            {!previewingPendingItem && (
              <>
                <span className="mx-2">·</span>
                <span>{previewIndex + 1} / {thumbnails.length}</span>
              </>
            )}
          </div>
        </div>
      )}


      {/* ===== GLOBAL MODALS ===== */}      {/* ===== TEMPLATE SELECTOR MODAL ===== */}
      {showTemplateSelector && (
        <TemplateSelector
          photoCount={collagePhotoCount}
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

      {/* ===== THUMBNAIL PREVIEW MODAL ===== */}
      <ThumbnailPreviewModal
        visible={thumbShowPreview}
        thumbnail={previewThumb}
        thumbnails={thumbnails}
        onClose={() => setThumbShowPreview(false)}
        onNavigate={(thumb) => setPreviewThumb(thumb)}
      />
    </div>
  );
}
