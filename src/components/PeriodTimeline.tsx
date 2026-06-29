import { Check } from 'lucide-react';
import type { Period } from '../types';

interface PeriodTimelineProps {
  periods: Period[];
  currentPeriod: Period | null;
  onSelectPeriod: (period: Period) => void;
}

/**
 * 水平步骤式周期进度条
 * 显示 done / current / pending 三种状态，点击可切换周期
 */
export default function PeriodTimeline({
  periods,
  currentPeriod,
  onSelectPeriod,
}: PeriodTimelineProps) {
  if (periods.length === 0) return null;

  const getStatus = (period: Period): 'done' | 'current' | 'pending' => {
    if (period.id === currentPeriod?.id) return 'current';
    if (period.selected_photo_id) return 'done';
    return 'pending';
  };

  const getStatusText = (status: 'done' | 'current' | 'pending') => {
    switch (status) {
      case 'done': return '已选定';
      case 'current': return '选取中';
      case 'pending': return '未开始';
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return `${d.getMonth() + 1}/${d.getDate()}`;
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="border-b border-[#e8e6de] bg-white">
      <div className="period-timeline-h">
        {periods.map((period, idx) => {
          const status = getStatus(period);
          const isLast = idx === periods.length - 1;

          return (
            <div key={period.id} className="period-step-item" onClick={() => onSelectPeriod(period)}>
              <div className={`period-step-dot ${status}`}>
                {status === 'done' ? <Check className="w-3.5 h-3.5" /> : (idx + 1)}
              </div>
              <div className="period-step-info">
                <div className="ps-name">{period.name}</div>
                <div className={`ps-status ${status}`}>
                  {getStatusText(status)}
                  <span style={{ marginLeft: 4, opacity: 0.6 }}>
                    {formatDate(period.start_date)}
                  </span>
                </div>
              </div>
              {!isLast && (
                <div className={`period-step-connector ${status === 'done' ? 'done' : ''}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
