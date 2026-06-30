import { useEffect, useState } from 'react';
import { useCreateProjectStore } from '../../store/createProjectStore';
import { FileText, Clock, Star } from 'lucide-react';

const periodPresets = [
  { label: '每月', days: 30, emoji: '📅' },
  { label: '每季度', days: 90, emoji: '🌿' },
  { label: '每半年', days: 180, emoji: '🌻' },
  { label: '每年', days: 365, emoji: '🎂' },
];

export default function Step2ProjectInfo() {
  const {
    selectedBaby,
    projectName,
    projectDescription,
    periodDays,
    includeSpecialDates,
    setProjectInfo,
  } = useCreateProjectStore();

  const [localName, setLocalName] = useState(projectName);
  const [localDesc, setLocalDesc] = useState(projectDescription);
  const [localPeriodDays, setLocalPeriodDays] = useState(periodDays);
  const [localIncludeSpecial, setLocalIncludeSpecial] = useState(includeSpecialDates);
  const [isFocused, setIsFocused] = useState<'name' | 'desc' | null>(null);

  useEffect(() => {
    if (!localName && selectedBaby) {
      const defaultName = `${selectedBaby.name}成长视频`;
      setLocalName(defaultName);
      updateStore(defaultName, localDesc, localPeriodDays, localIncludeSpecial);
    }
  }, [selectedBaby]);

  const updateStore = (name: string, desc: string, days: number, special: boolean) => {
    setProjectInfo({
      name,
      description: desc,
      periodDays: days,
      includeSpecialDates: special,
    });
  };

  const handleNameChange = (value: string) => {
    setLocalName(value);
    updateStore(value, localDesc, localPeriodDays, localIncludeSpecial);
  };

  const handleDescChange = (value: string) => {
    setLocalDesc(value);
    updateStore(localName, value, localPeriodDays, localIncludeSpecial);
  };

  const handlePeriodDaysChange = (value: number) => {
    const safeValue = Math.max(1, Math.min(365, value || 1));
    setLocalPeriodDays(safeValue);
    updateStore(localName, localDesc, safeValue, localIncludeSpecial);
  };

  const handleSpecialChange = (checked: boolean) => {
    setLocalIncludeSpecial(checked);
    updateStore(localName, localDesc, localPeriodDays, checked);
  };

  return (
    <div className="p-10 max-w-3xl mx-auto animate-fade-in-up">
      {/* 页面标题区 */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-warmth-400/12 to-warmth-500/8 flex items-center justify-center">
            <FileText className="w-5 h-5 text-warmth-500" strokeWidth={1.8} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-stone-800 tracking-tight">项目信息</h2>
            <p className="text-sm text-stone-500 mt-0.5">设置视频项目的基本参数</p>
          </div>
        </div>
        {/* 当前宝宝提示 */}
        {selectedBaby && (
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-warmth-50 border border-warmth-200/60 text-sm">
            <span className="w-6 h-6 rounded-full bg-gradient-to-br from-warmth-400 to-rose-400 flex items-center justify-center text-white text-xs font-bold shadow-sm shadow-warmth-300/30">
              {selectedBaby.name.charAt(0)}
            </span>
            <span className="text-stone-600">为</span>
            <span className="font-semibold text-warmth-600">{selectedBaby.name}</span>
            <span className="text-stone-600">创建视频</span>
          </div>
        )}
      </div>

      <div className="space-y-7">
        {/* ============ 项目名称 ============ */}
        <div
          className={`card p-6 transition-all duration-300 ${
            isFocused === 'name'
              ? 'shadow-lg border-warmth-300/40 ring-1 ring-warmth-200/30'
              : 'hover:shadow-md'
          }`}
        >
          <label className="flex items-center gap-2 text-sm font-semibold text-stone-700 mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-error" />
            项目名称
          </label>
          <div className="relative">
            <input
              type="text"
              value={localName}
              onChange={(e) => handleNameChange(e.target.value)}
              onFocus={() => setIsFocused('name')}
              onBlur={() => setIsFocused(null)}
              placeholder="给你的视频项目起个名字..."
              className="w-full px-0 py-2 text-lg font-medium text-stone-800 placeholder:text-stone-300 bg-transparent border-0 border-b-2 border-stone-200 focus:border-warmth-400 focus:outline-none transition-colors duration-300"
              maxLength={50}
            />
            <div className="absolute right-0 bottom-3">
              <span
                className={`text-xs font-mono transition-colors duration-300 ${
                  localName.length >= 45 ? 'text-error' : 'text-stone-300'
                }`}
              >
                {localName.length}/50
              </span>
            </div>
          </div>
        </div>

        {/* ============ 项目描述 ============ */}
        <div
          className={`card p-6 transition-all duration-300 ${
            isFocused === 'desc'
              ? 'shadow-lg border-warmth-300/40 ring-1 ring-warmth-200/30'
              : 'hover:shadow-md'
          }`}
        >
          <label className="flex items-center gap-2 text-sm font-semibold text-stone-700 mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
            项目描述
            <span className="text-stone-400 font-normal text-xs ml-auto">{localDesc.length}/200</span>
          </label>
          <textarea
            value={localDesc}
            onChange={(e) => handleDescChange(e.target.value)}
            onFocus={() => setIsFocused('desc')}
            onBlur={() => setIsFocused(null)}
            placeholder="简单介绍一下这个视频项目，比如包含哪些精彩瞬间..."
            className="w-full px-4 py-3 text-sm text-stone-700 placeholder:text-stone-300 bg-stone-50/60 rounded-xl border-2 border-transparent focus:border-indigo-300/50 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-100/40 transition-all duration-300 min-h-[110px] resize-none"
            maxLength={200}
          />
        </div>

        {/* ============ 周期天数 ============ */}
        <div className="card p-6 hover:shadow-md transition-all duration-300">
          <label className="flex items-center gap-2 text-sm font-semibold text-stone-700 mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-warning" />
            周期天数
          </label>

          {/* 预设按钮组 */}
          <div className="grid grid-cols-4 gap-3 mb-5">
            {periodPresets.map((preset) => {
              const isActive = localPeriodDays === preset.days;
              return (
                <button
                  key={preset.days}
                  onClick={() => handlePeriodDaysChange(preset.days)}
                  className={`group relative flex flex-col items-center gap-1.5 py-4 px-3 rounded-2xl transition-all duration-300 ${
                    isActive
                      ? 'bg-gradient-to-br from-warmth-400 to-warmth-500 text-white shadow-lg shadow-warmth-400/25 scale-[1.02]'
                      : 'bg-stone-50 text-stone-500 hover:bg-warmth-50 hover:text-warmth-600 hover:shadow-sm'
                  }`}
                >
                  <span className="text-xl transition-transform duration-300 group-hover:scale-110">
                    {preset.emoji}
                  </span>
                  <span className="text-xs font-semibold">{preset.label}</span>
                  <span
                    className={`text-[10px] transition-opacity duration-300 ${
                      isActive ? 'text-white/80' : 'text-stone-400'
                    }`}
                  >
                    {preset.days}天
                  </span>
                  {isActive && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-white flex items-center justify-center shadow-sm">
                      <div className="w-2.5 h-2.5 rounded-full bg-warmth-400" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* 自定义天数输入 */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-[180px]">
              <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                <Clock className="w-4 h-4 text-stone-400" />
              </div>
              <input
                type="number"
                value={localPeriodDays}
                onChange={(e) => handlePeriodDaysChange(parseInt(e.target.value) || 1)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-stone-50 border-2 border-stone-200 text-stone-700 font-mono text-sm focus:border-warning/60 focus:bg-white focus:outline-none focus:ring-4 focus:ring-warning/30 transition-all duration-300"
                min={1}
                max={365}
              />
            </div>
            <span className="text-sm font-medium text-stone-500">天</span>
            <span className="text-xs text-stone-400 flex-1">每天数日为一个成长节点</span>
          </div>
        </div>

        {/* ============ 包含特殊日期 ============ */}
        <div className="card p-6 hover:shadow-md transition-all duration-300">
          <label className="flex items-start gap-4 cursor-pointer group">
            <div className="relative flex-shrink-0 mt-0.5">
              <input
                type="checkbox"
                checked={localIncludeSpecial}
                onChange={(e) => handleSpecialChange(e.target.checked)}
                className="sr-only peer"
              />
              <div
                className={`w-12 h-7 rounded-full transition-all duration-300 ${
                  localIncludeSpecial
                    ? 'bg-gradient-to-r from-warmth-400 to-rose-400 shadow-md shadow-rose-300/25'
                    : 'bg-stone-200'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white shadow-sm transition-all duration-300 mt-1 ${
                    localIncludeSpecial ? 'ml-6' : 'ml-1'
                  }`}
                />
              </div>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Star
                  className={`w-4 h-4 transition-colors duration-300 ${
                    localIncludeSpecial ? 'text-warning fill-warning' : 'text-stone-300'
                  }`}
                />
                <span
                  className={`text-sm font-semibold transition-colors duration-300 ${
                    localIncludeSpecial ? 'text-stone-800' : 'text-stone-600'
                  }`}
                >
                  包含特殊日期
                </span>
              </div>
              <p className="text-xs text-stone-400 leading-relaxed max-w-md">
                满月 · 百天 · 半岁 · 周岁 — 这些值得纪念的日子会自动添加到周期列表中
              </p>
            </div>
          </label>
        </div>
      </div>
    </div>
  );
}
