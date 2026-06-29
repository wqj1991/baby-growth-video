import { Check, Image, Video as VideoIcon, Plus } from 'lucide-react';
import type { Period, PeriodStats } from '../types';

interface PeriodTimelineProps {
  periods: Period[];
  currentPeriod: Period | null;
  onSelectPeriod: (period: Period) => void;
  periodStats: Record<number, PeriodStats>;
}

/**
 * 水平步骤式周期进度条（V2）
 * 显示完整统计信息：待选数/照片数/视频数 + 最终标识
 */
export default function PeriodTimeline({
  periods,
  currentPeriod,
  onSelectPeriod,
  periodStats,
}: PeriodTimelineProps) {
  if (periods.length === 0) return null;

  const getStatus = (period: Period): 'done' | 'current' | 'pending' => {
    if (period.id === currentPeriod?.id) return 'current';
    if (period.selected_photo_id) return 'done';
    return 'pending';
  };

  const getStatusText = (period: Period) => {
    const status = getStatus(period);
    if (period.selected_photo_id) return '已确认';
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
          const stats = periodStats[period.id];
          const pendingCount = stats?.pending_count || 0;
          const photoCount = stats?.photo_count || 0;
          const videoCount = stats?.video_count || 0;
          const hasFinal = period.selected_photo_id !== undefined;

          return (
            <div key={period.id} className="period-step-item" onClick={() => onSelectPeriod(period)}>
              <div className={`period-step-dot ${status} ${hasFinal ? 'final' : ''}`}>
                {hasFinal ? (
                  <Check className="w-3.5 h-3.5" />
                ) : pendingCount > 0 ? (
                  <span className="pending-badge">{pendingCount}/{photoCount + videoCount}</span>
                ) : (
                  idx + 1
                )}
              </div>
              <div className="period-step-info">
                <div className="ps-name">{period.name}</div>
                <div className={`ps-status ${status} ${hasFinal ? 'final' : ''}`}>
                  {getStatusText(period)}
                  <span style={{ marginLeft: 4, opacity: 0.6 }}>
                    {formatDate(period.start_date)}
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
                <div className={`period-step-connector ${status === 'done' ? 'done' : ''}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
