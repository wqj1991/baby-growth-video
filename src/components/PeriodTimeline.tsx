import { Check, Circle, Image, Video as VideoIcon, Plus } from 'lucide-react';
import type { Period, PeriodStats } from '../types';

interface PeriodTimelineProps {
  periods: Period[];
  currentPeriod: Period | null;
  onSelectPeriod: (period: Period) => void;
  periodStats: Record<number, PeriodStats>;
}

/**
 * 水平步骤式周期进度条
 * 周期状态统一为两种：未开始 / 完成
 */
export default function PeriodTimeline({
  periods,
  currentPeriod,
  onSelectPeriod,
  periodStats,
}: PeriodTimelineProps) {
  if (periods.length === 0) return null;

  type PeriodStatus = 'not_started' | 'confirmed';

  const getStatusText = (status: PeriodStatus) => {
    switch (status) {
      case 'not_started':
        return '未开始';
      case 'confirmed':
        return '完成';
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="border-b border-[#e8e6de] bg-white">
      <div className="period-timeline-h">
        {periods.map((period, idx) => {
          const isLast = idx === periods.length - 1;
          const stats = periodStats[period.id];
          const pendingCount = stats?.pending_count || 0;
          const photoCount = stats?.photo_count || 0;
          const videoCount = stats?.video_count || 0;
          const hasFinal = period.selected_photo_id !== undefined;
          const isCurrent = period.id === currentPeriod?.id;
          const status: PeriodStatus = hasFinal ? 'confirmed' : 'not_started';

          return (
            <div key={period.id} className="period-step-item" onClick={() => onSelectPeriod(period)}>
              <div className={`period-step-dot ${status} ${isCurrent ? 'selected' : ''}`}>
                {hasFinal ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <Circle className="w-3.5 h-3.5" />
                )}
              </div>
              <div className="period-step-info">
                <div className="ps-name">{period.name}</div>
                <div className={`ps-status ${status}`}>
                  {getStatusText(status)}
                  <span className="ps-date">
                    {formatDate(period.start_date)} ~ {formatDate(period.end_date)}
                  </span>
                </div>
                {(photoCount > 0 || videoCount > 0) && (
                  <div className="ps-stats">
                    <span className="stat-item photo">
                      <Image className="w-3 h-3" />
                      <span>{photoCount}</span>
                    </span>
                    <span className="stat-item video">
                      <VideoIcon className="w-3 h-3" />
                      <span>{videoCount}</span>
                    </span>
                    {pendingCount > 0 && (
                      <span className="stat-item pending">
                        <Plus className="w-3 h-3" />
                        <span>{pendingCount}</span>
                      </span>
                    )}
                  </div>
                )}
              </div>
              {!isLast && (
                <div className={`period-step-connector ${status === 'confirmed' ? 'done' : ''}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
