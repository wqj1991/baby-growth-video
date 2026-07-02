import { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Camera, Play, Pause, SkipBack, SkipForward, Loader2, Check } from 'lucide-react';
import { useAppStore } from '../store';
import { fileToMediaUrl, getImageBase64, generateVideoFrameAtTime } from '../utils/tauriCommands';
import { showToast } from '../store/toastStore';
import type { Video } from '../types';

interface VideoFramePlayerProps {
  video: Video;
  onBack: () => void;
}

/**
 * 内嵌视频截帧播放器
 * 支持播放/暂停、逐帧控制、倍速、截帧操作
 * 截帧结果以临时帧形式展示，可持久化到待选区或放弃
 */
export default function VideoFramePlayer({
  video,
  onBack,
}: VideoFramePlayerProps) {
  const [progress, setProgress] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSeconds, setCurrentSeconds] = useState(0);
  const playerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const {
    tempFrames,
    persistVideoFrame,
    discardTempFrames,
    loadTempFrames,
    currentProject,
  } = useAppStore();

  const [isGenerating, setIsGenerating] = useState(false);
  const [persistingIds, setPersistingIds] = useState<Set<number>>(new Set());
  const [discardingIds, setDiscardingIds] = useState<Set<number>>(new Set());
  const [processedIds, setProcessedIds] = useState<Set<number>>(new Set());
  const [loadedImages, setLoadedImages] = useState<Record<number, string>>({});
  const [isClosing, setIsClosing] = useState(false);
  const [showFramePreview, setShowFramePreview] = useState(false);
  const [framePreviewUrl, setFramePreviewUrl] = useState<string | null>(null);
  const [framePreviewLoading, setFramePreviewLoading] = useState(false);
  const handleCloseRef = useRef<() => void>(() => {});

  const totalDuration = formatDuration(video.duration);
  const currentTimeLabel = formatDuration(currentSeconds);
  const availableSpeeds = [0.25, 0.5, 1, 2];
  const projectId = currentProject?.id;

  const visibleFrames = tempFrames.filter((f) => f.video_id === video.id && !processedIds.has(f.id));

  // 进入播放器时默认加载当前视频已有的缓存帧
  useEffect(() => {
    setProcessedIds(new Set());
    setLoadedImages({});
    loadTempFrames(video.id);
  }, [video.id, loadTempFrames]);

  const getOriginalFramePath = (thumbPath: string) => {
    return thumbPath.replace(/_thumb(?=\.[^./\\]+$)/, '_frame');
  };

  const handleCloseFramePreview = () => {
    setShowFramePreview(false);
    setFramePreviewUrl(null);
    setFramePreviewLoading(false);
  };

  const handleOpenFramePreview = async (frameId: number, thumbPath: string) => {
    setShowFramePreview(true);
    setFramePreviewLoading(true);
    setFramePreviewUrl(null);

    try {
      const originalPath = getOriginalFramePath(thumbPath);
      const originalBase64 = await getImageBase64(originalPath);
      setFramePreviewUrl(originalBase64);
    } catch (error) {
      console.error('加载原图失败，回退缩略图预览:', error);
      setFramePreviewUrl(loadedImages[frameId] || null);
    } finally {
      setFramePreviewLoading(false);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const el = videoRef.current;
      switch (e.key) {
        case ' ':
          e.preventDefault();
          if (!el) return;
          if (el.paused) {
            el.play().catch(() => undefined);
          } else {
            el.pause();
          }
          break;
        case 'ArrowLeft':
          if (!el) return;
          el.currentTime = Math.max(0, el.currentTime - 5);
          break;
        case 'ArrowRight':
          if (!el) return;
          el.currentTime = Math.min(video.duration, el.currentTime + 5);
          break;
        case 'Escape':
          if (showFramePreview) {
            handleCloseFramePreview();
          } else {
            handleCloseRef.current();
          }
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onBack, video.id, video.duration, showFramePreview]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
  }, [speed]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    const onTimeUpdate = () => {
      const current = el.currentTime || 0;
      const duration = el.duration || video.duration || 0;
      setCurrentSeconds(current);
      if (duration > 0) {
        setProgress((current / duration) * 100);
      } else {
        setProgress(0);
      }
    };

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);

    el.addEventListener('timeupdate', onTimeUpdate);
    el.addEventListener('play', onPlay);
    el.addEventListener('pause', onPause);

    return () => {
      el.removeEventListener('timeupdate', onTimeUpdate);
      el.removeEventListener('play', onPlay);
      el.removeEventListener('pause', onPause);
    };
  }, [video.duration]);

  // Load temp frame thumbnails
  useEffect(() => {
    const loadImages = async () => {
      const framesToHydrate = visibleFrames.filter((f) => !!f.base64_data && !loadedImages[f.id]);
      if (framesToHydrate.length > 0) {
        const hydratedImages: Record<number, string> = {};
        framesToHydrate.forEach((frame) => {
          if (frame.base64_data) hydratedImages[frame.id] = frame.base64_data;
        });
        setLoadedImages((prev) => ({ ...prev, ...hydratedImages }));
      }

      const framesToLoad = visibleFrames.filter((f) => !f.base64_data && !loadedImages[f.id]);
      if (framesToLoad.length === 0) return;
      const results = await Promise.all(
        framesToLoad.map(async (frame) => {
          try {
            const url = await getImageBase64(frame.temp_thumb_path);
            return { id: frame.id, url };
          } catch (error) {
            console.error('加载临时帧缩略图失败:', error);
            return { id: frame.id, url: '' };
          }
        })
      );
      const newImages: Record<number, string> = {};
      results.forEach(({ id, url }) => {
        if (url) newImages[id] = url;
      });
      setLoadedImages((prev) => ({ ...prev, ...newImages }));
    };
    loadImages();
  }, [visibleFrames]);

  function formatDuration(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  const handleCapture = async () => {
    if (!projectId) {
      showToast('error', '项目未选择', '无法截帧，请确认已选择项目');
      return;
    }
    setIsGenerating(true);
    try {
      const atTime = videoRef.current?.currentTime ?? currentSeconds;
      await generateVideoFrameAtTime(video.id, atTime);
      await loadTempFrames(video.id);
    } catch (error) {
      console.error('截帧失败:', error);
      showToast('error', '截帧失败', '请重试');
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePersist = async (tempId: number) => {
    if (!projectId) {
      showToast('error', '项目未选择', '无法保存截帧');
      return;
    }
    setPersistingIds((prev) => new Set(prev).add(tempId));
    try {
      await persistVideoFrame(tempId, projectId);
      setProcessedIds((prev) => new Set(prev).add(tempId));
      showToast('success', '已加入待选区', '截帧已保存到待选区');
    } catch (error) {
      console.error('保存截帧失败:', error);
      showToast('error', '保存失败', '请重试');
    } finally {
      setPersistingIds((prev) => {
        const next = new Set(prev);
        next.delete(tempId);
        return next;
      });
    }
  };

  const handleDiscard = (tempId: number) => {
    setDiscardingIds((prev) => new Set(prev).add(tempId));
    // 短暂延迟以显示加载状态，然后过滤掉
    setTimeout(() => {
      setProcessedIds((prev) => new Set(prev).add(tempId));
      setDiscardingIds((prev) => {
        const next = new Set(prev);
        next.delete(tempId);
        return next;
      });
    }, 200);
  };

  const handleClose = async () => {
    if (isClosing) return;
    setIsClosing(true);
    try {
      await discardTempFrames(video.id);
    } catch (error) {
      console.error('清理临时帧失败:', error);
    } finally {
      onBack();
      setIsClosing(false);
    }
  };
  handleCloseRef.current = handleClose;

  return (
    <div className="flex flex-col h-full">
      {/* Top Bar */}
      <div className="h-[52px] flex items-center gap-3 px-5 border-b border-stone-200 bg-white flex-shrink-0">
        <button
          onClick={handleClose}
          disabled={isClosing}
          className="flex items-center gap-1.5 text-sm text-stone-600 hover:text-stone-900 transition-colors disabled:opacity-50"
        >
          {isClosing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <ArrowLeft className="w-4 h-4" />
          )}
          返回照片库
        </button>
        <span className="text-stone-200">|</span>
        <span className="text-sm font-medium text-stone-600 truncate max-w-[300px]">
          {video.file_name}
        </span>
        <div className="ml-auto">
          <span className="info-pill-v2">💡 ←→ 跳转5秒 · 空格播放/暂停</span>
        </div>
      </div>

      <div className="video-inline-player flex-1">
        {/* Player Stage */}
        <div className="video-player-stage flex-1" ref={playerRef}>
          <video
            ref={videoRef}
            src={fileToMediaUrl(video.file_path)}
            className="w-full h-full object-contain bg-black"
            preload="metadata"
          />

          <button
            className="big-play-btn"
            onClick={() => {
              const el = videoRef.current;
              if (!el) return;
              if (el.paused) {
                el.play().catch(() => undefined);
              } else {
                el.pause();
              }
            }}
          >
            {isPlaying ? (
              <Pause className="w-5 h-5 text-white" />
            ) : (
              <Play className="w-5 h-5 text-white ml-0.5" fill="white" />
            )}
          </button>

          {/* Controls */}
          <div className="video-player-controls">
            <div className="video-progress-track"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const pct = ((e.clientX - rect.left) / rect.width) * 100;
                const clamped = Math.max(0, Math.min(100, pct));
                setProgress(clamped);
                const el = videoRef.current;
                if (el) {
                  const duration = el.duration || video.duration || 0;
                  el.currentTime = (clamped / 100) * duration;
                }
              }}
            >
              <div className="video-progress-fill" style={{ width: `${progress}%` }} />
              <div className="video-progress-thumb" style={{ left: `${progress}%` }} />
            </div>

            <div className="video-ctrl-row">
              <button className="video-ctrl-btn" onClick={() => {
                if (videoRef.current) {
                  videoRef.current.currentTime = 0;
                }
              }}>
                <SkipBack className="w-3 h-3" />
              </button>
              <button className="video-ctrl-btn" onClick={() => {
                const el = videoRef.current;
                if (!el) return;
                if (el.paused) {
                  el.play().catch(() => undefined);
                } else {
                  el.pause();
                }
              }}>
                {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
              </button>
              <button className="video-ctrl-btn" onClick={() => {
                if (videoRef.current) {
                  const duration = videoRef.current.duration || video.duration;
                  videoRef.current.currentTime = Math.min(duration, videoRef.current.currentTime + 5);
                }
              }}>
                <SkipForward className="w-3 h-3" />
              </button>
              <span className="video-timecode">{currentTimeLabel} / {totalDuration}</span>

              {availableSpeeds.map((s) => (
                <button
                  key={s}
                  className={`speed-btn ${speed === s ? 'active' : ''}`}
                  onClick={() => setSpeed(s)}
                >
                  {s}×
                </button>
              ))}

              <button
                className="capture-frame-btn disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleCapture}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Camera className="w-3.5 h-3.5" />
                )}
                {isGenerating ? '截帧中...' : '截取此帧'}
              </button>
            </div>
          </div>
        </div>

        {/* Temp Frames */}
        {visibleFrames.length > 0 && (
          <div className="temp-frames-panel p-3 px-4 bg-stone-50 border-t border-stone-200">
            <div className="text-[11px] text-stone-400 mb-2">待处理截帧 ({visibleFrames.length})</div>
            <div className="flex gap-3 overflow-x-auto pb-1">
              {visibleFrames.map((frame) => {
                const isPersisting = persistingIds.has(frame.id);
                const isDiscarding = discardingIds.has(frame.id);
                const isProcessing = isPersisting || isDiscarding;
                const previewUrl = frame.base64_data || loadedImages[frame.id];
                return (
                  <div
                    key={frame.id}
                    className="relative flex-shrink-0 w-28 bg-white rounded-lg border border-stone-200 overflow-hidden"
                  >
                    {previewUrl ? (
                      <img
                        src={previewUrl}
                        alt={`temp-frame-${frame.id}`}
                        className="w-full h-16 object-cover cursor-zoom-in"
                        loading="lazy"
                        onDoubleClick={() => handleOpenFramePreview(frame.id, frame.temp_thumb_path)}
                      />
                    ) : (
                      <div
                        className="w-full h-16 cursor-zoom-in"
                        style={{ background: 'var(--color-warmth-950)' }}
                        onDoubleClick={() => handleOpenFramePreview(frame.id, frame.temp_thumb_path)}
                      />
                    )}
                    <div className="p-1.5">
                      <div className="text-[9px] text-stone-500 mb-1">
                        {formatDuration(frame.time_seconds)}
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => handlePersist(frame.id)}
                          disabled={isProcessing}
                          className="flex-1 flex items-center justify-center gap-0.5 px-1.5 py-1 text-[9px] bg-success text-white rounded hover:bg-success-dark disabled:opacity-50"
                        >
                          {isPersisting ? (
                            <Loader2 className="w-2.5 h-2.5 animate-spin" />
                          ) : (
                            <Check className="w-2.5 h-2.5" />
                          )}
                          加入待选区
                        </button>
                        <button
                          onClick={() => handleDiscard(frame.id)}
                          disabled={isProcessing}
                          className="flex-1 px-1.5 py-1 text-[9px] bg-stone-200 text-stone-600 rounded hover:bg-stone-300 disabled:opacity-50"
                        >
                          {isDiscarding ? (
                            <Loader2 className="w-2.5 h-2.5 animate-spin inline" />
                          ) : null}
                          放弃
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {showFramePreview && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
            onClick={handleCloseFramePreview}
          >
            <button
              className="absolute top-4 right-4 px-3 py-1.5 text-sm text-white/90 hover:text-white"
              onClick={handleCloseFramePreview}
            >
              关闭
            </button>

            <div className="max-w-[95vw] max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
              {framePreviewLoading ? (
                <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin" />
              ) : framePreviewUrl ? (
                <img
                  src={framePreviewUrl}
                  alt="video-frame-original"
                  className="max-w-full max-h-[90vh] object-contain"
                />
              ) : (
                <div className="px-4 py-3 text-sm text-white/80 bg-white/10 rounded">原图加载失败</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
