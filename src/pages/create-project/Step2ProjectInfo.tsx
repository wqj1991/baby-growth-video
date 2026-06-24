import { useEffect, useState } from 'react';
import { useCreateProjectStore } from '../../store/createProjectStore';

const periodPresets = [
  { label: '每月', days: 30 },
  { label: '每季度', days: 90 },
  { label: '每半年', days: 180 },
  { label: '每年', days: 365 },
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

  useEffect(() => {
    // 如果项目名称为空且有选中的宝宝，设置默认名称
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
    <div className="p-8 max-w-2xl">
      <h2 className="text-xl font-bold mb-2">项目信息</h2>
      <p className="text-gray-500 mb-6">设置视频项目的基本信息</p>

      <div className="space-y-6">
        {/* 项目名称 */}
        <div className="form-group">
          <label className="form-label">
            项目名称 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={localName}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="请输入项目名称"
            className="input"
            maxLength={50}
          />
          <p className="text-xs text-gray-400 mt-1">{localName.length}/50</p>
        </div>

        {/* 项目描述 */}
        <div className="form-group">
          <label className="form-label">项目描述</label>
          <textarea
            value={localDesc}
            onChange={(e) => handleDescChange(e.target.value)}
            placeholder="简单介绍一下这个视频..."
            className="input min-h-[100px] resize-none"
            maxLength={200}
          />
          <p className="text-xs text-gray-400 mt-1">{localDesc.length}/200</p>
        </div>

        {/* 周期天数 */}
        <div className="form-group">
          <label className="form-label">
            周期天数 <span className="text-red-500">*</span>
          </label>
          <div className="flex gap-2 mb-3">
            {periodPresets.map((preset) => (
              <button
                key={preset.days}
                onClick={() => handlePeriodDaysChange(preset.days)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  localPeriodDays === preset.days
                    ? 'bg-primary-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={localPeriodDays}
              onChange={(e) => handlePeriodDaysChange(parseInt(e.target.value) || 1)}
              className="input w-24"
              min={1}
              max={365}
            />
            <span className="text-gray-500">天</span>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            每隔多少天生成一个成长周期，范围 1-365 天
          </p>
        </div>

        {/* 包含特殊日期 */}
        <div className="form-group">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={localIncludeSpecial}
              onChange={(e) => handleSpecialChange(e.target.checked)}
              className="w-5 h-5 rounded text-primary-500"
            />
            <div>
              <span className="font-medium text-gray-900">包含特殊日期</span>
              <p className="text-sm text-gray-500">
                自动添加满月、百天、半岁、周岁等特殊周期标记
              </p>
            </div>
          </label>
        </div>
      </div>
    </div>
  );
}
