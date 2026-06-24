import { useState, useRef } from 'react';
import { Video, Play, Settings, Download, Music, Image } from 'lucide-react';
import { useAppStore } from '../store';
import { saveFile } from '../utils/tauriCommands';
// import { generateGrowthVideo } from '../utils/tauriCommands';
import type { VideoConfig } from '../types';

export default function VideoGeneratePage() {
  const { periods, isGenerating, setIsGenerating, generationProgress, setGenerationProgress } = useAppStore();
  const progressRef = useRef(0);

  const [config, setConfig] = useState<VideoConfig>({
    resolution: '1080p',
    fps: 30,
    photo_duration: 3,
    transition: 'fade',
    transition_duration: 0.5,
    background_music: undefined,
    output_format: 'mp4',
  });

  const completedPeriods = periods.filter(p => p.selected_photo_id);

  const handleGenerate = async () => {
    if (completedPeriods.length === 0) {
      alert('请先选择照片');
      return;
    }

    const outputPath = await saveFile(`成长视频.${config.output_format}`);
    if (!outputPath) return;

    setIsGenerating(true);
    setGenerationProgress(0);
    progressRef.current = 0;

    try {
      // 模拟进度更新
      const progressInterval = setInterval(() => {
        if (progressRef.current >= 90) {
          clearInterval(progressInterval);
          return;
        }
        progressRef.current += 5;
        setGenerationProgress(progressRef.current);
      }, 500);

      // 实际生成视频
      // const result = await generateGrowthVideo(projectId, config, outputPath);
      
      // 模拟完成
      setTimeout(() => {
        clearInterval(progressInterval);
        setGenerationProgress(100);
        setIsGenerating(false);
        alert('视频生成完成！');
      }, 3000);
    } catch (error) {
      console.error('生成视频失败:', error);
      alert('生成视频失败');
      setIsGenerating(false);
    }
  };

  const handleSelectMusic = async () => {
    // 选择背景音乐
    // const musicPath = await selectFile([{ name: '音频文件', extensions: ['mp3', 'wav', 'm4a'] }]);
    // if (musicPath) {
    //   setConfig({ ...config, background_music: musicPath });
    // }
  };

  return (
    <div className="p-6">
      <div className="grid grid-cols-12 gap-6">
        {/* 左侧 - 配置 */}
        <div className="col-span-5">
          <div className="card">
            <div className="card-header">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Settings className="w-5 h-5" />
                视频配置
              </h2>
            </div>
            <div className="card-body">
              {/* 分辨率 */}
              <div className="form-group">
                <label className="form-label">分辨率</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['720p', '1080p', '4k'] as const).map((res) => (
                    <button
                      key={res}
                      onClick={() => setConfig({ ...config, resolution: res })}
                      className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                        config.resolution === res
                          ? 'bg-primary-500 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {res.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* 帧率 */}
              <div className="form-group">
                <label className="form-label">帧率 (fps)</label>
                <select
                  className="form-select"
                  value={config.fps}
                  onChange={(e) => setConfig({ ...config, fps: parseInt(e.target.value) })}
                >
                  <option value={24}>24 fps</option>
                  <option value={30}>30 fps</option>
                  <option value={60}>60 fps</option>
                </select>
              </div>

              {/* 照片时长 */}
              <div className="form-group">
                <label className="form-label">每张照片显示时长（秒）</label>
                <input
                  type="number"
                  className="form-input"
                  value={config.photo_duration}
                  onChange={(e) => setConfig({ ...config, photo_duration: parseFloat(e.target.value) })}
                  min={1}
                  max={10}
                  step={0.5}
                />
              </div>

              {/* 转场效果 */}
              <div className="form-group">
                <label className="form-label">转场效果</label>
                <select
                  className="form-select"
                  value={config.transition}
                  onChange={(e) => setConfig({ ...config, transition: e.target.value as VideoConfig['transition'] })}
                >
                  <option value="none">无转场</option>
                  <option value="fade">淡入淡出</option>
                  <option value="slide">滑动</option>
                  <option value="zoom">缩放</option>
                </select>
              </div>

              {/* 转场时长 */}
              {config.transition !== 'none' && (
                <div className="form-group">
                  <label className="form-label">转场时长（秒）</label>
                  <input
                    type="number"
                    className="form-input"
                    value={config.transition_duration}
                    onChange={(e) => setConfig({ ...config, transition_duration: parseFloat(e.target.value) })}
                    min={0.1}
                    max={2}
                    step={0.1}
                  />
                </div>
              )}

              {/* 背景音乐 */}
              <div className="form-group">
                <label className="form-label">背景音乐</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="form-input flex-1"
                    value={config.background_music || ''}
                    placeholder="未选择"
                    readOnly
                  />
                  <button
                    onClick={handleSelectMusic}
                    className="btn btn-outline"
                  >
                    <Music className="w-4 h-4" />
                    选择
                  </button>
                </div>
              </div>

              {/* 输出格式 */}
              <div className="form-group">
                <label className="form-label">输出格式</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['mp4', 'mov', 'avi'] as const).map((format) => (
                    <button
                      key={format}
                      onClick={() => setConfig({ ...config, output_format: format })}
                      className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                        config.output_format === format
                          ? 'bg-primary-500 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {format.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 右侧 - 预览和生成 */}
        <div className="col-span-7">
          {/* 预览 */}
          <div className="card mb-6">
            <div className="card-header">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Video className="w-5 h-5" />
                视频预览
              </h2>
            </div>
            <div className="card-body">
              <div className="aspect-video bg-gray-900 rounded-lg flex items-center justify-center">
                <div className="text-center text-gray-500">
                  <Video className="w-16 h-16 mx-auto mb-3 text-gray-600" />
                  <p>视频预览</p>
                  <p className="text-sm mt-1">生成后可在此播放</p>
                </div>
              </div>
            </div>
          </div>

          {/* 照片概览 */}
          <div className="card mb-6">
            <div className="card-header">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Image className="w-5 h-5" />
                已选照片 ({completedPeriods.length}/{periods.length})
              </h2>
            </div>
            <div className="card-body">
              {completedPeriods.length === 0 ? (
                <div className="text-center py-6 text-gray-500">
                  <Image className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">还没有选择照片</p>
                  <p className="text-xs mt-1">请先在"周期选择"中选择照片</p>
                </div>
              ) : (
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {completedPeriods.map((period) => (
                    <div
                      key={period.id}
                      className="flex-shrink-0 w-20"
                    >
                      <div className="aspect-square bg-gray-200 rounded-lg mb-1 flex items-center justify-center">
                        <Image className="w-6 h-6 text-gray-400" />
                      </div>
                      <p className="text-xs text-center text-gray-600 truncate">
                        {period.name}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 生成按钮和进度 */}
          <div className="card">
            <div className="card-body">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold">生成视频</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    预计时长：约 {Math.max(0, completedPeriods.length * config.photo_duration + (completedPeriods.length - 1) * config.transition_duration).toFixed(1)} 秒
                  </p>
                </div>
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating || completedPeriods.length === 0}
                  className="btn btn-primary btn-lg"
                >
                  {isGenerating ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      生成中...
                    </>
                  ) : (
                    <>
                      <Play className="w-5 h-5" />
                      开始生成
                    </>
                  )}
                </button>
              </div>

              {isGenerating && (
                <div>
                  <div className="progress-bar">
                    <div
                      className="progress-bar-fill"
                      style={{ width: `${generationProgress}%` }}
                    />
                  </div>
                  <p className="text-sm text-gray-500 mt-2 text-center">
                    {generationProgress}% - 正在生成视频...
                  </p>
                </div>
              )}

              {generationProgress === 100 && !isGenerating && (
                <div className="mt-4 p-4 bg-green-50 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                      <Video className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium text-green-800">视频生成完成！</p>
                      <p className="text-sm text-green-600">点击右侧按钮下载</p>
                    </div>
                  </div>
                  <button className="btn btn-success">
                    <Download className="w-4 h-4" />
                    下载
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
