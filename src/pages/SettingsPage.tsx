import { useState } from 'react';
import { ArrowLeft, Camera, Sparkles, Volume2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface AiSettings {
  enabled: boolean;
  transitionStyle: 'smooth' | 'zoom' | 'fade';
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const [aiSettings, setAiSettings] = useState<AiSettings>({
    enabled: false,
    transitionStyle: 'smooth',
  });
  const [soundEnabled, setSoundEnabled] = useState(true);

  return (
    <div className="min-h-screen bg-[#faf9f6]">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[#e8e6de]">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-[#f0efe9] rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-[#33312d]" />
          </button>
          <h1 className="text-lg font-bold text-[#33312d]">设置</h1>
        </div>

        <div className="p-5 space-y-4">
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-[#f3f0fb] rounded-lg">
                <Sparkles className="w-5 h-5 text-[#7c5cbf]" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-semibold" style={{ color: '#33312d' }}>
                  启用 AI 智能过渡
                </h3>
                <p className="text-sm mt-1 leading-relaxed" style={{ color: '#b0aca0', maxWidth: '340px' }}>
                  在视频生成时使用 AI 创建照片之间的装饰性过渡帧，让成长回忆更生动
                </p>
              </div>
              <button
                onClick={() => setAiSettings({ ...aiSettings, enabled: !aiSettings.enabled })}
                className={`toggle-switch ${aiSettings.enabled ? 'active' : ''} flex-shrink-0`}
                role="switch"
                aria-checked={aiSettings.enabled}
              >
                <span className="toggle-thumb" />
              </button>
            </div>

            {aiSettings.enabled && (
              <div className="mt-4 pt-4 border-t border-[#f0efe9]">
                <label className="block text-sm font-medium text-[#33312d] mb-2">过渡效果</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['smooth', 'zoom', 'fade'] as const).map((style) => (
                    <button
                      key={style}
                      onClick={() => setAiSettings({ ...aiSettings, transitionStyle: style })}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        aiSettings.transitionStyle === style
                          ? 'bg-[#7c5cbf] text-white'
                          : 'bg-[#f5f4f0] text-[#33312d] hover:bg-[#f0efe9]'
                      }`}
                    >
                      {style === 'smooth' && '平滑'}
                      {style === 'zoom' && '缩放'}
                      {style === 'fade' && '淡入淡出'}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-[#f0f7f4] rounded-lg">
                <Volume2 className="w-5 h-5 text-[#5da48c]" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-semibold" style={{ color: '#33312d' }}>
                  背景音乐
                </h3>
                <p className="text-sm mt-1" style={{ color: '#b0aca0' }}>
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

          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-[#fef6f0] rounded-lg">
                <Camera className="w-5 h-5 text-[#e5966e]" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-semibold" style={{ color: '#33312d' }}>
                  照片质量
                </h3>
                <p className="text-sm mt-1" style={{ color: '#b0aca0' }}>
                  视频中照片的分辨率和压缩质量
                </p>
              </div>
              <span className="text-sm font-medium text-[#7c5cbf]">高</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
