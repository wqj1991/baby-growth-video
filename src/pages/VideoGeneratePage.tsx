import { useState, useRef, useEffect } from 'react';
import { Video, Play, Settings, Download, Music, Image, Sparkles, AlertCircle, ExternalLink, AlertTriangle, CheckCircle2, Loader2, Film, Type, Wand2, Clock, ChevronRight, Volume2, X } from 'lucide-react';
import { useAppStore, isAiConfigured } from '../store';
import { saveFile, generateGrowthVideo, cancelGeneration, getImageBase64, selectFile, getPeriodThumbnails, fileToMediaUrl } from '../utils/tauriCommands';
import { showToast } from '../store/toastStore';
import { listen } from '@tauri-apps/api/event';
import { useNavigate } from 'react-router-dom';
import type { VideoConfig, PhotoText, Thumbnail } from '../types';

export default function VideoGeneratePage() {
  const navigate = useNavigate();
  const { periods, currentProject, isGenerating, setIsGenerating, generationProgress, setGenerationProgress,
    generationStage, setGenerationStage, generationMessage, setGenerationMessage,
    generationFallback, setGenerationFallback, fallbackReason, setFallbackReason } = useAppStore();
  const unlistenRef = useRef<(() => void) | null>(null);

  const [config, setConfig] = useState<VideoConfig>({
    resolution: '1080p',
    fps: 30,
    photo_duration: 3,
    transition: 'fade',
    transition_duration: 0.5,
    background_music: undefined,
    output_format: 'mp4',
    ai_enabled: false,
    video_mode: 'standard',
  });

  const [videoMode, setVideoMode] = useState<'standard' | 'agnes'>('standard');
  const [overallPrompt, setOverallPrompt] = useState('');
  const [photoTexts, setPhotoTexts] = useState<PhotoText[]>([]);
  const [editingTextFor, setEditingTextFor] = useState<number | null>(null);

  const [aiEnabled, setAiEnabled] = useState(() => {
    const s = useAppStore.getState().aiSettings;
    return s.enabled && !!s.api_key;
  });

  const [generationError, setGenerationError] = useState<string | null>(null);
  const [completedVideoPath, setCompletedVideoPath] = useState<string | null>(null);
  const [taskId, setTaskId] = useState<string>('');

  const [photoThumbnails, setPhotoThumbnails] = useState<Record<number, string>>({});
  const [loadingThumbnails, setLoadingThumbnails] = useState<Set<number>>(new Set());

  useEffect(() => {
    return () => {
      if (unlistenRef.current) {
        unlistenRef.current();
        unlistenRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const loadThumbnails = async () => {
      const completed = periods.filter(p => p.selected_photo_id != null);
      for (const period of completed) {
        const photoId = period.selected_photo_id;
        if (photoId != null && !photoThumbnails[period.id]) {
          setLoadingThumbnails(prev => new Set([...prev, photoId]));
          try {
            const thumbs: Thumbnail[] = await getPeriodThumbnails(period.id);
            const thumb = thumbs.find((t: Thumbnail) => t.id === photoId);
            if (thumb) {
              const base64 = await getImageBase64(thumb.original_path);
              setPhotoThumbnails(prev => ({ ...prev, [period.id]: base64 }));
            }
          } catch (e) {
            console.error('Failed to load thumbnail:', e);
          } finally {
            setLoadingThumbnails(prev => {
              const next = new Set(prev);
              next.delete(photoId);
              return next;
            });
          }
        }
      }
    };
    loadThumbnails();
  }, [periods, photoThumbnails]);

  const handleAiToggle = () => {
    const next = !aiEnabled;
    setAiEnabled(next);
  };

  const handleCancel = async () => {
    if (taskId) {
      await cancelGeneration(taskId);
      setGenerationStage('cancelled');
      setGenerationMessage('生成已取消');
      setIsGenerating(false);
      setGenerationError('用户已取消');
    }
  };

  function getDefaultMessage(stage: string, current: number, total: number): string {
    switch (stage) {
      case 'preparing': return '正在准备照片...';
      case 'preprocessing': return `正在处理照片文字 (${current}/${total})...`;
      case 'ai_generation': return `正在生成 AI 过渡帧 (${current}/${total})...`;
      case 'ai_fallback': return 'AI 生成失败，回退到标准转场...';
      case 'ffmpeg_encoding': return '正在合成视频...';
      case 'agnes_creating': return '正在创建 Agnes 视频任务...';
      case 'agnes_encoding': return 'Agnes AI 正在生成视频...';
      case 'agnes_downloading': return '正在下载生成的视频...';
      case 'agnes_fallback': return 'Agnes 生成失败，回退到标准模式...';
      case 'complete': return '视频生成完成!';
      case 'error': return '生成失败';
      case 'cancelled': return '生成已取消';
      default: return `${stage}...`;
    }
  }

  function getStageLabel(stage: string): string {
    switch (stage) {
      case 'preparing': return '准备照片';
      case 'preprocessing': return '处理文字标注';
      case 'ai_generation': return 'AI 生成过渡帧';
      case 'ai_fallback': return '回退到标准转场';
      case 'ffmpeg_encoding': return 'FFmpeg 编码合成';
      case 'agnes_creating': return '创建 Agnes 任务';
      case 'agnes_encoding': return 'Agnes AI 渲染视频';
      case 'agnes_downloading': return '下载视频文件';
      case 'agnes_fallback': return '降级到标准模式';
      case 'complete': return '完成';
      case 'error': return '出错';
      case 'cancelled': return '已取消';
      default: return stage;
    }
  }

  const aiConfigured = isAiConfigured();
  const aiFrameDuration = useAppStore((s) => s.aiSettings.frame_duration);
  const completedPeriods = periods.filter(p => p.selected_photo_id);

  const handleGenerate = async () => {
    if (completedPeriods.length === 0) {
      showToast('warning', '请先选择照片', '请至少确认一个周期的最终照片');
      return;
    }

    if (!currentProject) {
      showToast('warning', '请先选择项目');
      return;
    }

    const outputPath = await saveFile(`成长视频.${config.output_format}`);
    if (!outputPath) return;

    const newTaskId = `generate_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    setTaskId(newTaskId);

    setIsGenerating(true);
    setGenerationProgress(0);
    setGenerationStage('preparing');
    setGenerationMessage('准备中...');
    setGenerationFallback(false);
    setFallbackReason('');
    setGenerationError(null);
    setCompletedVideoPath(null);

    if (unlistenRef.current) {
      unlistenRef.current();
      unlistenRef.current = null;
    }

    try {
      const unlisten = await listen<{
        stage: string;
        current: number;
        total: number;
        percentage: number;
        message: string;
      }>('generation-progress', (event) => {
        const { stage, current, total, percentage, message } = event.payload;
        setGenerationProgress(percentage);
        setGenerationStage(stage);
        setGenerationMessage(message || getDefaultMessage(stage, current, total));

        if (stage === 'ai_fallback' || stage === 'agnes_fallback') {
          setGenerationFallback(true);
          setFallbackReason(message);
        }
      });

      unlistenRef.current = unlisten;
    } catch (e) {
      console.error('Failed to listen to generation-progress:', e);
    }

    try {
      const result = await generateGrowthVideo(
        currentProject.id,
        { ...config, video_mode: videoMode, ai_enabled: aiEnabled },
        outputPath,
        videoMode === 'agnes' ? overallPrompt : undefined,
        videoMode === 'agnes' ? photoTexts : undefined,
        newTaskId,
      );
      setGenerationProgress(100);
      setGenerationStage('complete');
      setGenerationMessage('视频生成完成!');
      setCompletedVideoPath(result.output_path);
    } catch (error) {
      const errMsg = typeof error === 'string' ? error : '未知错误';
      setGenerationError(errMsg);
      setGenerationProgress(100);
      setGenerationStage('error');
      setGenerationMessage('生成失败');
    } finally {
      setIsGenerating(false);
      setTimeout(() => {
        if (unlistenRef.current) {
          unlistenRef.current();
          unlistenRef.current = null;
        }
      }, 500);
    }
  };

  const handleSelectMusic = async () => {
    const musicPath = await selectFile([
      { name: '音频文件', extensions: ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac'] }
    ]);
    if (musicPath) {
      setConfig({ ...config, background_music: musicPath });
    }
  };

  const handleRemoveMusic = () => {
    setConfig({ ...config, background_music: undefined });
  };

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-5">
          <div className="card">
            <div className="card-header">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Settings className="w-5 h-5" />
                视频配置
              </h2>
            </div>
            <div className="card-body">
              <div className="form-group">
                <label className="form-label">分辨率</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['720p', '1080p', '4k'] as const).map((res) => (
                    <button
                      key={res}
                      onClick={() => setConfig({ ...config, resolution: res })}
                      className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                        config.resolution === res
                          ? 'bg-primary-500 text-white shadow-md'
                          : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                      }`}
                    >
                      {res.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

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

              {videoMode === 'standard' && (
              <div className="form-group">
                <div className="p-4 rounded-xl border-indigo-100" style={{ background: 'linear-gradient(135deg, var(--color-indigo-50, #f4f5fb) 0%, var(--color-stone-50, #f8f6fc) 50%, var(--color-warmth-50, #fffaf5) 100%)' }}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-indigo-500" />
                      <div>
                        <label className="text-sm font-semibold text-indigo-900">AI 智能过渡</label>
                        <p className="text-xs mt-0.5 text-indigo-400">
                          在照片之间生成 AI 装饰性过渡帧
                        </p>
                      </div>
                    </div>
                    {aiConfigured ? (
                      <button
                        onClick={handleAiToggle}
                        className={`toggle-switch ${aiEnabled ? 'active' : ''}`}
                        role="switch"
                        aria-checked={aiEnabled}
                        aria-label="AI 智能过渡"
                      >
                        <span className="toggle-switch-knob" />
                      </button>
                    ) : (
                      <button
                        onClick={() => navigate('/settings')}
                        className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors text-indigo-500 bg-indigo-100"
                      >
                        去配置
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {!aiConfigured && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-warning-bg border border-warning border-opacity-30">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 text-warning" />
                      <p className="text-xs text-warning-text">
                        尚未配置 AI 模型，请在
                        <button
                          onClick={() => navigate('/settings')}
                          className="font-medium underline mx-1"
                        >
                          设置
                        </button>
                        中配置 Provider 和 API Key
                      </p>
                    </div>
                  )}

                  {aiEnabled && aiConfigured && (
                    <div className="mt-3 pt-3 border-t border-stone-200">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg gradient-indigo flex items-center justify-center">
                          <Sparkles className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <p className="text-xs font-medium text-stone-900">AI 过渡帧已启用</p>
                          <p className="text-xs text-stone-500">
                            将在 {completedPeriods.length > 1 ? `${completedPeriods.length - 1} 个转场点` : '转场点'} 生成 AI 帧
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              )}

              <div className="form-group">
                <label className="form-label">背景音乐</label>
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      className="form-input w-full"
                      value={config.background_music ? config.background_music.split('/').pop() || config.background_music.split('\\').pop() || '' : ''}
                      placeholder="未选择"
                      readOnly
                    />
                    {config.background_music && (
                      <button
                        onClick={handleRemoveMusic}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-stone-200 transition-colors"
                      >
                        <X className="w-4 h-4 text-stone-500" />
                      </button>
                    )}
                  </div>
                  <button
                    onClick={handleSelectMusic}
                    className="btn btn-outline"
                  >
                    {config.background_music ? <Volume2 className="w-4 h-4" /> : <Music className="w-4 h-4" />}
                    {config.background_music ? '更换' : '选择'}
                  </button>
                </div>
                {!config.background_music && (
                  <p className="text-xs mt-1.5 text-stone-400">支持 MP3、WAV、M4A、AAC、OGG、FLAC 格式</p>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">输出格式</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['mp4', 'mov', 'avi'] as const).map((format) => (
                    <button
                      key={format}
                      onClick={() => setConfig({ ...config, output_format: format })}
                      className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                        config.output_format === format
                          ? 'bg-primary-500 text-white shadow-md'
                          : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
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

        <div className="col-span-7">
          <div className="card mb-6">
            <div className="card-header">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Video className="w-5 h-5" />
                视频预览
              </h2>
            </div>
            <div className="card-body">
              {completedVideoPath ? (
                <div className="aspect-video bg-stone-900 rounded-lg overflow-hidden">
                  <video
                    src={fileToMediaUrl(completedVideoPath)}
                    controls
                    className="w-full h-full object-contain"
                  >
                    您的浏览器不支持视频播放
                  </video>
                </div>
              ) : completedPeriods.length > 0 ? (
                <div>
                  <p className="text-xs font-medium text-stone-500 mb-3 flex items-center gap-1">
                    <Image className="w-3.5 h-3.5" />
                    已选 {completedPeriods.length} 张照片将按时间线排列
                  </p>
                  <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
                    {completedPeriods.map((period, idx) => (
                      <div key={period.id} className="relative flex-shrink-0">
                        <div className="w-28 rounded-xl overflow-hidden border border-stone-200 bg-stone-50 shadow-sm">
                          <div className="aspect-[4/3] bg-gradient-to-br from-warmth-100 to-warmth-200 flex items-center justify-center relative overflow-hidden">
                            {photoThumbnails[period.id] ? (
                              <img
                                src={photoThumbnails[period.id]}
                                alt={period.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (period.selected_photo_id != null && loadingThumbnails.has(period.selected_photo_id)) ? (
                              <div className="w-full h-full skeleton" />
                            ) : (
                              <Sparkles className="w-5 h-5 text-warmth-400" />
                            )}
                            <span className="absolute top-1.5 left-1.5 w-5 h-5 rounded-full bg-white/90 text-[10px] font-bold text-warmth-500 flex items-center justify-center shadow-sm">
                              {idx + 1}
                            </span>
                            <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-success flex items-center justify-center">
                              <CheckCircle2 className="w-2.5 h-2.5 text-white" />
                            </span>
                          </div>
                          <div className="px-2 py-1.5">
                            <p className="text-[11px] font-semibold text-stone-700 truncate">{period.name}</p>
                            <p className="text-[10px] text-stone-400">{period.start_date}</p>
                          </div>
                        </div>
                        {idx < completedPeriods.length - 1 && (
                          <div className="absolute -right-2 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center">
                            <div className="w-4 h-4 rounded-full bg-indigo-100 flex items-center justify-center">
                              <ChevronRight className="w-3 h-3 text-indigo-500" />
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  {completedPeriods.length > 1 && (
                    <div className="mt-3 flex items-center gap-2 text-xs text-stone-400">
                      <span className="inline-block w-2 h-2 rounded-full bg-indigo-500" />
                      {completedPeriods.length - 1} 个转场点 · 
                      选用 {config.transition === 'fade' ? '淡入淡出' : config.transition === 'slide' ? '滑动' : config.transition === 'zoom' ? '缩放' : '无转场'} 效果
                    </div>
                  )}
                </div>
              ) : (
                <div className="aspect-video bg-stone-100 rounded-lg flex items-center justify-center">
                  <div className="text-center text-stone-400">
                    <Video className="w-12 h-12 mx-auto mb-2 text-stone-300" />
                    <p className="text-sm font-medium">暂无已选照片</p>
                    <p className="text-xs mt-1">在左侧选择周期的最终照片后，此处将显示照片序列</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="card mb-6">
            <div className="card-header">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Image className="w-5 h-5" />
                已选照片 ({completedPeriods.length}/{periods.length})
              </h2>
            </div>
            <div className="card-body">
              {completedPeriods.length === 0 ? (
                <div className="text-center py-6 text-stone-500">
                  <Image className="w-10 h-10 mx-auto mb-2 text-stone-300" />
                  <p className="text-sm">还没有选择照片</p>
                  <p className="text-xs mt-1">请先在"周期选择"中选择照片</p>
                </div>
              ) : (
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {completedPeriods.map((period) => (
                    <div key={period.id} className="flex-shrink-0 w-20">
                      <div className="aspect-square bg-stone-200 rounded-lg mb-1 flex items-center justify-center overflow-hidden">
                        {photoThumbnails[period.id] ? (
                          <img
                            src={photoThumbnails[period.id]}
                            alt={period.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (period.selected_photo_id != null && loadingThumbnails.has(period.selected_photo_id)) ? (
                          <div className="w-full h-full skeleton" />
                        ) : (
                          <Image className="w-6 h-6 text-stone-400" />
                        )}
                      </div>
                      <p className="text-xs text-center text-stone-600 truncate">{period.name}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="card mb-6">
            <div className="card-body">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Wand2 className="w-4 h-4 text-stash" />
                生成模式
              </h3>
              <div className="flex rounded-xl p-1 bg-stone-100">
                <button
                  onClick={() => {
                    setVideoMode('standard');
                  }}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-200 ${
                    videoMode === 'standard'
                      ? 'bg-white shadow-sm text-stone-900'
                      : 'text-stone-500 hover:text-stone-700'
                  }`}
                >
                  <Film className="w-4 h-4" />
                  标准 (FFmpeg)
                </button>
                <button
                  onClick={() => {
                    if (!aiConfigured) {
                      navigate('/settings');
                      return;
                    }
                    setVideoMode('agnes');
                    setConfig(prev => ({ ...prev, video_mode: 'agnes' }));
                  }}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-200 ${
                    videoMode === 'agnes'
                      ? 'bg-white shadow-sm text-purple-700'
                      : aiConfigured ? 'text-stone-500 hover:text-stone-700' : 'text-stone-400 cursor-not-allowed'
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                  Agnes AI 视频
                  {!aiConfigured && <ExternalLink className="w-3 h-3" />}
                </button>
              </div>
              {videoMode === 'agnes' && !aiConfigured && (
                <p className="text-xs mt-2 text-warning">
                  需要先在设置中配置 AI Provider 和 API Key
                </p>
              )}
              {videoMode === 'agnes' && aiConfigured && (
                <div className="mt-3 flex items-center gap-2 p-2.5 rounded-lg bg-stash-bg/50 border border-stash/10">
                  <Clock className="w-4 h-4 flex-shrink-0 text-stash" />
                  <p className="text-xs text-stash">
                    Agnes AI 将照片生成一段完整的动态视频，约需 2-5 分钟
                  </p>
                </div>
              )}
            </div>
          </div>

          {videoMode === 'agnes' && (
            <div className="card mb-6">
              <div className="card-body space-y-4">
                <div className="form-group">
                  <label className="form-label flex items-center gap-2">
                    <Type className="w-4 h-4 text-purple-500" />
                    视频整体描述
                  </label>
                  <textarea
                    className="form-input min-h-[80px] resize-y"
                    value={overallPrompt}
                    onChange={(e) => setOverallPrompt(e.target.value)}
                    placeholder="描述你想要的效果，例如：温馨的家庭成长记录，柔和的暖色调，自然过渡..."
                  />
                  <p className="text-xs mt-1 text-stone-400">
                    留空将使用默认风格描述
                  </p>
                </div>

                <div className="form-group">
                  <label className="form-label flex items-center gap-2">
                    <Type className="w-4 h-4 text-purple-500" />
                    照片标注
                    <span className="text-xs font-normal text-stone-400">（可选，在照片底部添加文字）</span>
                  </label>
                  {completedPeriods.length === 0 ? (
                    <p className="text-xs text-stone-400">暂无已选照片</p>
                  ) : (
                    <div className="space-y-2 max-h-[200px] overflow-y-auto">
                      {completedPeriods.map((period) => {
                        const existingText = photoTexts.find(pt => pt.period_id === period.id)?.text || '';
                        const isEditing = editingTextFor === period.id;
                        return (
                          <div key={period.id} className="flex items-center gap-2">
                            <span className="text-xs font-medium w-20 truncate text-stone-600">{period.name}</span>
                            {isEditing ? (
                              <input
                                className="form-input flex-1 text-xs py-1.5"
                                value={existingText}
                                onChange={(e) => {
                                  setPhotoTexts(prev => {
                                    const filtered = prev.filter(pt => pt.period_id !== period.id);
                                    if (e.target.value) {
                                      return [...filtered, { period_id: period.id, text: e.target.value }];
                                    }
                                    return filtered;
                                  });
                                }}
                                onBlur={() => setEditingTextFor(null)}
                                onKeyDown={(e) => { if (e.key === 'Enter') setEditingTextFor(null); }}
                                placeholder="输入文字..."
                                autoFocus
                              />
                            ) : (
                              <button
                                onClick={() => setEditingTextFor(period.id)}
                                className={`flex-1 text-left text-xs py-1.5 px-2.5 rounded-lg border transition-colors ${
                                  existingText
                                    ? 'border-stash/20 bg-stash-bg/30 text-stash'
                                    : 'border-stone-200 text-stone-400 hover:border-stone-300 hover:text-stone-600'
                                }`}
                              >
                                {existingText || '点击添加文字...'}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="card">
            <div className="card-body">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold">生成视频</h3>
                  <p className="text-sm text-stone-500 mt-1">
                    预计时长：约 {(() => {
                      if (videoMode === 'agnes') return '动态生成';
                      const baseDuration = completedPeriods.length * config.photo_duration + (completedPeriods.length - 1) * config.transition_duration;
                      const aiTransitionTime = aiEnabled && aiConfigured
                        ? (completedPeriods.length - 1) * aiFrameDuration
                        : 0;
                      return (baseDuration + aiTransitionTime).toFixed(1);
                    })()}{videoMode === 'agnes' ? '' : ' 秒'}
                    {aiEnabled && aiConfigured && videoMode !== 'agnes' && (
                      <span className="text-xs ml-2 text-indigo-500">
                        (含 AI 过渡帧)
                      </span>
                    )}
                    {videoMode === 'agnes' && (
                      <span className="text-xs ml-2 text-stash">
                        (Agnes AI 生成)
                      </span>
                    )}
                  </p>
                </div>
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating || completedPeriods.length === 0}
                  className="btn btn-primary btn-lg"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
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
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <StageIcon stage={generationStage} />
                      <span className="text-sm font-medium text-stone-700">
                        {getStageLabel(generationStage)}
                      </span>
                    </div>
                    <button
                      onClick={handleCancel}
                      className="text-sm text-error hover:text-error/80 font-medium"
                    >
                      取消生成
                    </button>
                  </div>

                  {generationFallback && (
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-warning-bg border border-warning border-opacity-30">
                      <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-warning-text">AI 过渡帧生成失败，已回退到标准转场</p>
                        {fallbackReason && (
                          <p className="text-xs text-warning-text mt-0.5">{fallbackReason}</p>
                        )}
                      </div>
                    </div>
                  )}

                  <div>
                    <div className="progress-bar">
                      <div
                        className="progress-bar-fill"
                        style={{ width: `${generationProgress}%` }}
                      />
                    </div>
                    <p className="text-sm text-stone-500 mt-2 text-center">
                      {generationProgress}% - {generationMessage}
                    </p>
                  </div>
                </div>
              )}

              {generationStage === 'complete' && !isGenerating && completedVideoPath && (
                <div className="mt-4 p-4 bg-success-bg rounded-lg flex items-center justify-between border border-success-border">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center">
                      <CheckCircle2 className="w-5 h-5 text-success" />
                    </div>
                    <div>
                      <p className="font-medium text-success-text">视频生成完成！</p>
                      <p className="text-xs text-success-text/70 truncate max-w-[280px]">{completedVideoPath}</p>
                    </div>
                  </div>
                  <button
                    className="btn btn-success"
                    onClick={() => {
                      showToast('success', '视频已生成', `保存路径: ${completedVideoPath}`, 6000);
                    }}
                  >
                    <Download className="w-4 h-4" />
                    查看
                  </button>
                </div>
              )}

              {generationStage === 'error' && !isGenerating && generationError && (
                <div className="mt-4 p-4 bg-error-bg rounded-lg border border-error-border">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-error flex-shrink-0" />
                    <div>
                      <p className="font-medium text-error-text">生成失败</p>
                      <p className="text-sm text-error mt-1">{generationError}</p>
                    </div>
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

function StageIcon({ stage }: { stage: string }) {
  const baseClass = 'w-5 h-5';
  switch (stage) {
    case 'preparing':
    case 'preprocessing':
      return <Image className={`${baseClass} text-info`} />;
    case 'ai_generation':
      return <Sparkles className={`${baseClass} text-indigo-500 animate-pulse`} />;
    case 'ai_fallback':
    case 'agnes_fallback':
      return <AlertTriangle className={`${baseClass} text-warning`} />;
    case 'ffmpeg_encoding':
      return <Film className={`${baseClass} text-success animate-pulse`} />;
    case 'agnes_creating':
      return <Wand2 className={`${baseClass} text-stash animate-pulse`} />;
    case 'agnes_encoding':
      return <Sparkles className={`${baseClass} text-stash animate-pulse`} />;
    case 'agnes_downloading':
      return <Download className={`${baseClass} text-stash animate-pulse`} />;
    case 'complete':
      return <CheckCircle2 className={`${baseClass} text-success`} />;
    case 'error':
      return <AlertCircle className={`${baseClass} text-error`} />;
    case 'cancelled':
      return <X className={`${baseClass} text-stone-500`} />;
    default:
      return <Loader2 className={`${baseClass} text-stone-400 animate-spin`} />;
  }
}