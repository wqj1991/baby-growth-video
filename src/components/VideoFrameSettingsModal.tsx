import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { Video } from '../types';

interface VideoFrameSettingsModalProps {
  visible: boolean;
  video: Video | null;
  onClose: () => void;
  onGenerate: (mode: 'count' | 'interval', value: number) => void;
}

const MAX_FRAMES = 100;
const DEFAULT_FRAMES = 20;

export default function VideoFrameSettingsModal({
  visible,
  video,
  onClose,
  onGenerate,
}: VideoFrameSettingsModalProps) {
  const [mode, setMode] = useState<'count' | 'interval'>('count');
  const [frameCount, setFrameCount] = useState(DEFAULT_FRAMES);
  const [intervalSeconds, setIntervalSeconds] = useState(1);
  const [calculatedFrames, setCalculatedFrames] = useState(0);

  useEffect(() => {
    if (!visible || !video) return;
    
    setMode('count');
    setFrameCount(DEFAULT_FRAMES);
    setIntervalSeconds(1);
    setCalculatedFrames(0);
  }, [visible, video]);

  useEffect(() => {
    if (mode === 'interval' && video) {
      const frames = Math.floor(video.duration / intervalSeconds);
      setCalculatedFrames(Math.min(frames, MAX_FRAMES));
    }
  }, [mode, intervalSeconds, video]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (visible) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [visible, onClose]);

  const handleGenerate = () => {
    if (mode === 'count') {
      const count = Math.min(Math.max(1, frameCount), MAX_FRAMES);
      onGenerate('count', count);
    } else {
      onGenerate('interval', intervalSeconds);
    }
  };

  const handleModeChange = (newMode: 'count' | 'interval') => {
    setMode(newMode);
    if (newMode === 'count' && video) {
      const count = Math.min(calculatedFrames, MAX_FRAMES);
      setFrameCount(count > 0 ? count : DEFAULT_FRAMES);
    }
  };

  if (!visible || !video) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-4 border-b border-stone-200">
          <h3 className="text-lg font-semibold">视频抽帧设置</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-stone-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-stone-500" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">
              视频信息
            </label>
            <div className="text-sm text-stone-500">
              <p>{video.file_name}</p>
              <p>时长：{Math.floor(video.duration / 60)}分{(video.duration % 60).toFixed(1)}秒</p>
              <p>分辨率：{video.width}x{video.height}</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">
              抽帧模式
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => handleModeChange('count')}
                className={`flex-1 py-2 px-4 rounded-lg border-2 transition-colors ${
                  mode === 'count'
                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                    : 'border-stone-200 hover:border-stone-300 text-stone-700'
                }`}
              >
                按数量抽帧
              </button>
              <button
                onClick={() => handleModeChange('interval')}
                className={`flex-1 py-2 px-4 rounded-lg border-2 transition-colors ${
                  mode === 'interval'
                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                    : 'border-stone-200 hover:border-stone-300 text-stone-700'
                }`}
              >
                按间隔抽帧
              </button>
            </div>
          </div>

          {mode === 'count' ? (
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">
                抽帧数量
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="1"
                  max={MAX_FRAMES}
                  value={frameCount}
                  onChange={(e) => {
                    const value = parseInt(e.target.value) || 1;
                    setFrameCount(Math.min(Math.max(1, value), MAX_FRAMES));
                  }}
                  className="flex-1 form-input"
                />
                <span className="text-sm text-stone-500">帧</span>
              </div>
              <p className="text-xs text-stone-500 mt-1">
                范围：1 - {MAX_FRAMES} 帧，默认 {DEFAULT_FRAMES} 帧
              </p>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">
                抽帧间隔
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={intervalSeconds}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value) || 0.1;
                    setIntervalSeconds(Math.max(0.1, value));
                  }}
                  className="flex-1 form-input"
                />
                <span className="text-sm text-stone-500">秒</span>
              </div>
              <p className="text-xs text-stone-500 mt-1">
                预计抽取 {calculatedFrames} 帧（最多 {MAX_FRAMES} 帧）
              </p>
            </div>
          )}

          <div className="pt-4 border-t border-stone-200 flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-2 px-4 rounded-lg border border-stone-300 text-stone-700 hover:bg-stone-50 transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleGenerate}
              className="flex-1 py-2 px-4 rounded-lg bg-primary-500 text-white hover:bg-primary-600 transition-colors"
            >
              开始抽帧
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}