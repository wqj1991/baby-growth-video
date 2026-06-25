import { useEffect, useRef, useState } from 'react';
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  Info,
  ChevronDown,
  ChevronUp,
  Copy,
  Filter,
} from 'lucide-react';
import type { ScanLog } from '../types';

interface ScanLogPanelProps {
  logs: ScanLog[];
  isExpanded: boolean;
  onToggleExpand: () => void;
  autoScroll: boolean;
  onToggleAutoScroll: () => void;
}

const levelConfig = {
  success: {
    icon: CheckCircle,
    color: 'text-green-500',
    bgColor: 'bg-green-50',
  },
  warn: {
    icon: AlertTriangle,
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-50',
  },
  error: {
    icon: XCircle,
    color: 'text-red-500',
    bgColor: 'bg-red-50',
  },
  info: {
    icon: Info,
    color: 'text-blue-500',
    bgColor: 'bg-blue-50',
  },
};

type LogLevel = keyof typeof levelConfig;

export default function ScanLogPanel({
  logs,
  isExpanded,
  onToggleExpand,
  autoScroll,
  onToggleAutoScroll,
}: ScanLogPanelProps) {
  const logContainerRef = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState<LogLevel | 'all'>('all');

  // 过滤日志
  const filteredLogs = filter === 'all'
    ? logs
    : logs.filter((log) => log.level === filter);

  // 自动滚动
  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [filteredLogs, autoScroll]);

  // 复制全部日志
  const handleCopyAll = async () => {
    const text = filteredLogs
      .map((log) => `[${log.level.toUpperCase()}] ${log.message}`)
      .join('\n');
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      console.error('复制失败:', e);
    }
  };

  // 格式化时间
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
      {/* 工具栏 - 展开时显示 */}
      {isExpanded && (
        <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as LogLevel | 'all')}
              className="text-sm border border-gray-300 rounded px-2 py-1 bg-white"
            >
              <option value="all">全部</option>
              <option value="success">成功</option>
              <option value="warn">警告</option>
              <option value="error">错误</option>
              <option value="info">信息</option>
            </select>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1 text-sm text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={onToggleAutoScroll}
                className="rounded"
              />
              自动滚动
            </label>
            <button
              onClick={handleCopyAll}
              className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
              title="复制全部日志"
            >
              <Copy className="w-4 h-4" />
              复制
            </button>
          </div>
        </div>
      )}

      {/* 日志列表 */}
      <div
        ref={logContainerRef}
        className={`overflow-y-auto font-mono text-sm ${
          isExpanded ? 'max-h-[60vh]' : 'max-h-[120px]'
        }`}
      >
        {filteredLogs.length === 0 ? (
          <div className="p-4 text-center text-gray-400">
            暂无日志
          </div>
        ) : (
          filteredLogs.map((log) => {
            const config = levelConfig[log.level];
            const Icon = config.icon;
            return (
              <div
                key={log.id}
                className={`flex items-start gap-2 px-4 py-1.5 hover:bg-gray-50 ${config.bgColor}`}
                title={log.fileName}
              >
                <Icon className={`w-4 h-4 flex-shrink-0 mt-0.5 ${config.color}`} />
                <span className="flex-1 text-gray-700 break-all">
                  {log.message}
                </span>
                <span className="text-gray-400 text-xs flex-shrink-0">
                  {formatTime(log.timestamp)}
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* 底部展开/收起按钮 */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-t border-gray-200">
        <span className="text-xs text-gray-500">
          共 {logs.length} 条日志
          {filter !== 'all' && ` (显示 ${filteredLogs.length} 条)`}
        </span>
        <button
          onClick={onToggleExpand}
          className="flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700"
        >
          {isExpanded ? (
            <>
              收起
              <ChevronUp className="w-4 h-4" />
            </>
          ) : (
            <>
              展开查看全部日志
              <ChevronDown className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
