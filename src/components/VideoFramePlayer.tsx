import { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Camera, Play, Pause, SkipBack, SkipForward } from 'lucide-react';
import type { Video, VideoFrame } from '../types';

interface VideoFramePlayerProps {
  video: Video;
  onBack: () => void;
  onCapture: (frame: VideoFrame) => void;
  onAddToStash: (frame: VideoFrame) => void;
  capturedFrames: VideoFrame[];
  loadedImages: Record<number, string>;
}

/**
 * 内嵌视频截帧播放器
 * 支持播放/暂停、逐帧控制、倍速、截帧操作
 */
export default function VideoFramePlayer({
  video,
  onBack,
  onCapture,
  onAddToStash: _onAddToStash,
  capturedFrames,
  loadedImages,
}: VideoFramePlayerProps) {
  const [progress, setProgress] = useState(38);
  const [speed, setSpeed] = useState(1);
  const currentTime = '0:52';
  const playerRef = useRef<HTMLDivElement>(null);

  const totalDuration = formatDuration(video.duration);
  const availableSpeeds = [0.25, 0.5, 1, 2];

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case ' ':
          e.preventDefault();
          break;
        case 'ArrowLeft':
          setProgress((p) => Math.max(0, p - 1));
          break;
        case 'ArrowRight':
          setProgress((p) => Math.min(100, p + 1));
          break;
        case 'Escape':
          onBack();
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onBack]);

  function formatDuration(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  const handleCapture = () => {
    // Simulate frame capture — real implementation would use FFmpeg
    const mockFrame: VideoFrame = {
      id: Date.now(),
      video_id: video.id,
      period_id: video.period_id,
      file_path: '',
      time_seconds: (video.duration * progress) / 100,
      is_selected: false,
      is_multi_selected: false,
      is_final: false,
      created_at: new Date().toISOString(),
    };
    onCapture(mockFrame);
  };

  // Nearby frame previews (simulated)
  const nearbyFrames = Array.from({ length: 8 }, (_, i) => ({
    id: i,
    offset: -4 + i,
    isActive: i === 3,
    isBlur: i === 5,
  }));

  return (
    <div className="flex flex-col h-full">
      {/* Top Bar */}
      <div className="h-[52px] flex items-center gap-3 px-5 border-b border-[#e8e6de] bg-white flex-shrink-0">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-[#706c63] hover:text-[#33312d] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          返回照片库
        </button>
        <span className="text-[#e8e6de]">|</span>
        <span className="text-sm font-medium text-[#706c63] truncate max-w-[300px]">
          {video.file_name}
        </span>
        <div className="ml-auto">
          <span className="info-pill-v2">💡 ←→ 逐帧 · 空格暂停</span>
        </div>
      </div>

      <div className="video-inline-player flex-1">
        {/* Player Stage */}
        <div className="video-player-stage flex-1" ref={playerRef}>
          <button className="big-play-btn">
            <Play className="w-5 h-5 text-white ml-0.5" fill="white" />
          </button>

          {/* Controls */}
          <div className="video-player-controls">
            <div className="video-progress-track"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const pct = ((e.clientX - rect.left) / rect.width) * 100;
                setProgress(Math.max(0, Math.min(100, pct)));
              }}
            >
              <div className="video-progress-fill" style={{ width: `${progress}%` }} />
              <div className="video-progress-thumb" style={{ left: `${progress}%` }} />
            </div>

            <div className="video-ctrl-row">
              <button className="video-ctrl-btn" onClick={() => setProgress(0)}>
                <SkipBack className="w-3 h-3" />
              </button>
              <button className="video-ctrl-btn">
                <Pause className="w-3 h-3" />
              </button>
              <button className="video-ctrl-btn">
                <SkipForward className="w-3 h-3" />
              </button>
              <span className="video-timecode">{currentTime} / {totalDuration}</span>

              {availableSpeeds.map((s) => (
                <button
                  key={s}
                  className={`speed-btn ${speed === s ? 'active' : ''}`}
                  onClick={() => setSpeed(s)}
                >
                  {s}×
                </button>
              ))}

              <button className="capture-frame-btn" onClick={handleCapture}>
                <Camera className="w-3.5 h-3.5" />
                截取此帧
              </button>
            </div>
          </div>
        </div>

        {/* Nearby Frame Strip */}
        <div className="frame-strip">
          <div className="frame-strip-label">附近帧预览（点击跳转）</div>
          <div className="frames-row">
            {nearbyFrames.map((f) => (
              <div
                key={f.id}
                className={`frame-thumb ${f.isActive ? 'active' : ''} ${f.isBlur ? 'blur-warn' : ''}`}
                onClick={() => setProgress(Math.max(0, Math.min(100, progress + f.offset)))}
              >
                {f.isBlur && (
                  <div className="absolute top-0.5 right-0.5 bg-[#f0a020] text-white text-[8px] px-1 py-px rounded">
                    ⚠️
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Capture Result Actions */}
        <div className="capture-result-bar">
          <div className="cr-thumb" style={{
            background: 'linear-gradient(135deg, #3d2414 0%, #1c0d06 100%)',
          }} />
          <div className="cr-info">
            <div className="cr-title">截帧预览 · {currentTime}</div>
            <div className="cr-warn">⚠️ 检测到轻微运动模糊，建议前后各试 1–2 帧</div>
          </div>
          <div className="cr-actions">
            <button className="btn btn-secondary btn-sm">加入待选区</button>
            <button className="btn btn-primary btn-sm">直接选定</button>
          </div>
        </div>

        {/* Already Captured Frames */}
        {capturedFrames.length > 0 && (
          <div className="p-3 px-4 bg-[#fafaf8] border-t border-[#e8e6de]">
            <div className="text-[11px] text-[#b0aca0] mb-2">已截取 ({capturedFrames.length})</div>
            <div className="flex gap-2 overflow-x-auto">
              {capturedFrames.map((frame) => (
                <div key={frame.id} className="relative flex-shrink-0">
                  <div
                    className="w-14 h-9 rounded border-2 border-[#2d9d5f]"
                    style={{
                      backgroundImage: loadedImages[frame.id] ? `url(${loadedImages[frame.id]})` : undefined,
                      background: loadedImages[frame.id]
                        ? 'center/cover'
                        : 'linear-gradient(135deg, #3d2414, #1c0d06)',
                    }}
                  />
                  <span className="absolute -top-1 -right-1 bg-[#7c5cbf] text-white text-[8px] px-1 py-0.5 rounded">
                    待选区
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
