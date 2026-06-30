import { useEffect, useState } from 'react';
import { Video, Clock, Download, Trash2, Play, Calendar } from 'lucide-react';
import { useAppStore } from '../store';
import { getExportRecords } from '../utils/tauriCommands';
import type { ExportRecord } from '../types';

export default function HistoryPage() {
  const { currentProject } = useAppStore();
  const [records, setRecords] = useState<ExportRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentProject) {
      loadRecords(currentProject.id);
    }
  }, [currentProject]);

  const loadRecords = async (projectId: number) => {
    setLoading(true);
    try {
      const data = await getExportRecords(projectId);
      setRecords(data);
    } catch (error) {
      console.error('加载导出记录失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusBadge = (status: ExportRecord['status']) => {
    switch (status) {
      case 'success':
        return <span className="badge badge-success">成功</span>;
      case 'failed':
        return <span className="badge badge-danger">失败</span>;
      case 'processing':
        return <span className="badge badge-primary">处理中</span>;
    }
  };

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-stone-900">历史记录</h1>
        <p className="text-stone-500 mt-1">查看所有已生成的视频记录</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-stone-500">加载中...</div>
        </div>
      ) : records.length === 0 ? (
        <div className="card">
          <div className="card-body text-center py-16">
            <Video className="w-16 h-16 mx-auto mb-4 text-stone-300" />
            <h3 className="text-lg font-medium text-stone-900 mb-2">暂无历史记录</h3>
            <p className="text-stone-500 mb-6">还没有生成过视频，去生成第一个成长视频吧！</p>
            <button className="btn btn-primary">
              <Play className="w-4 h-4" />
              去生成视频
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {records.map((record) => (
            <div key={record.id} className="card overflow-hidden">
              <div className="flex">
                {/* 视频缩略图 */}
                <div className="w-48 aspect-video bg-stone-900 flex items-center justify-center flex-shrink-0">
                  <Video className="w-12 h-12 text-stone-600" />
                </div>

                {/* 信息 */}
                <div className="flex-1 p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-stone-900">{record.file_name}</h3>
                      <div className="flex items-center gap-4 mt-2 text-sm text-stone-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {record.created_at}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {formatDuration(record.duration)}
                        </span>
                        <span>{record.resolution}</span>
                        <span>{formatFileSize(record.file_size)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(record.status)}
                    </div>
                  </div>

                  {record.error_message && (
                    <div className="mt-3 p-3 bg-error-bg rounded-lg">
                      <p className="text-sm text-error-text">
                        错误信息：{record.error_message}
                      </p>
                    </div>
                  )}

                  <div className="flex items-center gap-2 mt-4">
                    {record.status === 'success' && (
                      <>
                        <button className="btn btn-primary btn-sm">
                          <Play className="w-4 h-4" />
                          播放
                        </button>
                        <button className="btn btn-outline btn-sm">
                          <Download className="w-4 h-4" />
                          下载
                        </button>
                      </>
                    )}
                    <button className="btn btn-outline btn-sm text-error-text hover:bg-error-bg">
                      <Trash2 className="w-4 h-4" />
                      删除
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
