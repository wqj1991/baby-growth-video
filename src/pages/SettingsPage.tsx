import { useState } from 'react';
import { ArrowLeft, Sparkles, Volume2, Camera, Settings, Brain, Eye, Key, Globe, Cpu } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store';
import { showToast } from '../store/toastStore';

type TabId = 'basic' | 'ai';

export default function SettingsPage() {
  const navigate = useNavigate();
  const { aiSettings, setAiSettings } = useAppStore();

  const [activeTab, setActiveTab] = useState<TabId>('basic');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [photoQuality, setPhotoQuality] = useState<'high' | 'medium'>('high');

  // Local form state for AI settings (not synced until save)
  const [localAi, setLocalAi] = useState({ ...aiSettings });

  const handleAiSave = () => {
    setAiSettings(localAi);
    showToast('success', 'AI 设置已保存');
  };

  const tabs: { id: TabId; icon: typeof Settings; label: string }[] = [
    { id: 'basic', icon: Settings, label: '基础设置' },
    { id: 'ai', icon: Brain, label: 'AI 设置' },
  ];

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="max-w-3xl mx-auto">
        {/* 顶部导航 */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-stone-200">
          <button
            onClick={() => navigate('/')}
            className="p-2 hover:bg-stone-200 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-stone-700" />
          </button>
          <h1 className="text-lg font-bold text-stone-900">设置</h1>
        </div>

        {/* Tab 切换 */}
        <div className="px-5 pt-5 pb-3">
          <div className="flex gap-1 bg-stone-100 rounded-xl p-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  activeTab === tab.id
                    ? 'bg-white text-warmth-600 shadow-sm'
                    : 'text-stone-500 hover:text-stone-700'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-5 space-y-4">
          {activeTab === 'basic' ? (
            <>
              {/* 背景音乐 */}
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-success-bg rounded-lg">
                    <Volume2 className="w-5 h-5 text-[#2d9d5f]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-semibold text-stone-900">背景音乐</h3>
                    <p className="text-sm mt-1 text-stone-400">
                      生成视频时添加默认背景音乐
                    </p>
                  </div>
                  <button
                    onClick={() => setSoundEnabled(!soundEnabled)}
                    className={`toggle-switch ${soundEnabled ? 'active' : ''} flex-shrink-0`}
                    role="switch"
                    aria-checked={soundEnabled}
                  >
                    <span className="toggle-thumb" />
                  </button>
                </div>
              </div>

              {/* 照片质量 */}
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-warmth-50 rounded-lg">
                    <Camera className="w-5 h-5 text-warmth-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-semibold text-stone-900">照片质量</h3>
                    <p className="text-sm mt-1 text-stone-400">
                      视频中照片的分辨率和压缩质量
                    </p>
                  </div>
                  <select
                    value={photoQuality}
                    onChange={(e) => setPhotoQuality(e.target.value as 'high' | 'medium')}
                    className="text-sm font-medium px-3 py-2 rounded-xl border border-stone-200 bg-white text-stone-700 focus:outline-none focus:ring-2 focus:ring-warmth-300 focus:border-warmth-400"
                    aria-label="照片质量"
                  >
                    <option value="high">高质量</option>
                    <option value="medium">中质量</option>
                  </select>
                </div>
              </div>

              {/* AI 过渡启用快速开关 */}
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-purple-100 rounded-lg">
                    <Sparkles className="w-5 h-5 text-[#7c5cbf]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-semibold text-stone-900">
                      启用 AI 智能过渡
                    </h3>
                    <p className="text-sm mt-1 leading-relaxed text-stone-400">
                      在视频生成时使用 AI 创建照片之间的装饰性过渡帧
                    </p>
                  </div>
                  <button
                    onClick={() => setAiSettings({ enabled: !aiSettings.enabled })}
                    className={`toggle-switch ${aiSettings.enabled ? 'active' : ''} flex-shrink-0`}
                    role="switch"
                    aria-checked={aiSettings.enabled}
                  >
                    <span className="toggle-thumb" />
                  </button>
                </div>
              </div>
            </>
          ) : (
            /* AI 设置 Tab */
            <div className="space-y-4">
              {/* Provider */}
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2.5 bg-indigo-100 rounded-lg">
                    <Cpu className="w-5 h-5 text-[#5b66c0]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-semibold text-stone-900">AI 模型</h3>
                    <p className="text-sm mt-0.5 text-stone-400">选择 AI 提供商和模型</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-stone-500 mb-1">Provider</label>
                    <select
                      value={localAi.provider}
                      onChange={(e) => setLocalAi({ ...localAi, provider: e.target.value })}
                      className="w-full text-sm px-3 py-2 rounded-xl border border-stone-200 bg-stone-50 text-stone-700 focus:outline-none focus:ring-2 focus:ring-warmth-300 focus:border-warmth-400"
                    >
                      <option value="siliconflow">SiliconFlow</option>
                      <option value="openai">OpenAI</option>
                      <option value="custom">自定义</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-500 mb-1">Model</label>
                    <input
                      type="text"
                      value={localAi.model}
                      onChange={(e) => setLocalAi({ ...localAi, model: e.target.value })}
                      className="w-full text-sm px-3 py-2 rounded-xl border border-stone-200 bg-stone-50 text-stone-700 focus:outline-none focus:ring-2 focus:ring-warmth-300 focus:border-warmth-400"
                      placeholder="black-forest-labs/FLUX.1-schnell"
                    />
                  </div>
                </div>
              </div>

              {/* API 连接 */}
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2.5 bg-amber-100 rounded-lg">
                    <Globe className="w-5 h-5 text-[#f5c000]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-semibold text-stone-900">API 连接</h3>
                    <p className="text-sm mt-0.5 text-stone-400">配置 API 接口地址和密钥</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-stone-500 mb-1">API Endpoint</label>
                    <input
                      type="text"
                      value={localAi.api_endpoint}
                      onChange={(e) => setLocalAi({ ...localAi, api_endpoint: e.target.value })}
                      className="w-full text-sm px-3 py-2 rounded-xl border border-stone-200 bg-stone-50 text-stone-700 focus:outline-none focus:ring-2 focus:ring-warmth-300 focus:border-warmth-400"
                      placeholder="https://api.siliconflow.cn/v1/images/generations"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-500 mb-1">API Key</label>
                    <div className="relative">
                      <input
                        type="password"
                        value={localAi.api_key}
                        onChange={(e) => setLocalAi({ ...localAi, api_key: e.target.value })}
                        className="w-full text-sm px-3 py-2 rounded-xl border border-stone-200 bg-stone-50 text-stone-700 focus:outline-none focus:ring-2 focus:ring-warmth-300 focus:border-warmth-400 pr-10"
                        placeholder="sk-..."
                      />
                      <Key className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                    </div>
                  </div>
                </div>
              </div>

              {/* 生成风格 */}
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2.5 bg-rose-100 rounded-lg">
                    <Eye className="w-5 h-5 text-[#d44d68]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-semibold text-stone-900">生成风格</h3>
                    <p className="text-sm mt-0.5 text-stone-400">调整过渡帧的生成参数</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-stone-500 mb-1">Style Preset</label>
                    <select
                      value={localAi.style_preset}
                      onChange={(e) => setLocalAi({ ...localAi, style_preset: e.target.value })}
                      className="w-full text-sm px-3 py-2 rounded-xl border border-stone-200 bg-stone-50 text-stone-700 focus:outline-none focus:ring-2 focus:ring-warmth-300 focus:border-warmth-400"
                    >
                      <option value="warm_glow">温暖光晕</option>
                      <option value="soft_dream">柔和梦境</option>
                      <option value="natural">自然写实</option>
                      <option value="vivid">鲜艳生动</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-500 mb-1">显示时长 (秒)</label>
                    <input
                      type="number"
                      step={0.5}
                      min={0.5}
                      max={5}
                      value={localAi.frame_duration}
                      onChange={(e) => setLocalAi({ ...localAi, frame_duration: parseFloat(e.target.value) || 1.5 })}
                      className="w-full text-sm px-3 py-2 rounded-xl border border-stone-200 bg-stone-50 text-stone-700 focus:outline-none focus:ring-2 focus:ring-warmth-300 focus:border-warmth-400"
                    />
                  </div>
                </div>
                <div className="mt-3">
                  <label className="block text-xs font-medium text-stone-500 mb-1">自定义 Prompt</label>
                  <textarea
                    value={localAi.custom_prompt}
                    onChange={(e) => setLocalAi({ ...localAi, custom_prompt: e.target.value })}
                    rows={2}
                    className="w-full text-sm px-3 py-2 rounded-xl border border-stone-200 bg-stone-50 text-stone-700 focus:outline-none focus:ring-2 focus:ring-warmth-300 focus:border-warmth-400 resize-none"
                    placeholder="可选的额外指令，如：'使用婴儿主题的柔和色彩'"
                  />
                </div>
              </div>

              {/* 保存按钮 */}
              <button
                onClick={handleAiSave}
                className="w-full py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-warmth-400 to-warmth-500 shadow-lg shadow-warmth-400/25 hover:shadow-xl hover:shadow-warmth-400/35 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
              >
                保存 AI 设置
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
