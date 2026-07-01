import { useEffect, useRef } from 'react';
import { Folder, Image, Film, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { useCreateProjectStore } from '../../store/createProjectStore';
import { scanMediaFolder, selectFolder, onScanLog, onScanResultsBatch, getScanLog } from '../../utils/tauriCommands';
import { downloadJson } from '../../utils/download';
import type { ScanResult, ScanLog, ScanResultsBatch } from '../../types';
import ScanLogPanel from '../../components/ScanLogPanel';
import { showToast } from '../../store/toastStore';

export default function Step4SelectFolder() {
  const {
    folderPath,
    scanResult,
    isScanning,
    scanProgress,
    projectId,
    scanLogs,
    autoScrollLog,
    setFolderPath,
    setScanResult,
    setIsScanning,
    setScanProgress,
    addScanLog,
    addScanLogs,
    clearScanLogs,
    toggleAutoScrollLog,
    addScanResultBatch,
  } = useCreateProjectStore();

  const unlistenScanLogRef = useRef<(() => void) | null>(null);
  const unlistenScanResultsRef = useRef<(() => void) | null>(null);
  const pendingLogsRef = useRef<Array<Parameters<typeof addScanLog>[0]>>([]);
  const flushTimerRef = useRef<number | null>(null);

  const flushLogs = () => {
    if (pendingLogsRef.current.length > 0) {
      const logs = pendingLogsRef.current;
      pendingLogsRef.current = [];
      addScanLogs(logs);
    }
    flushTimerRef.current = null;
  };

  const enqueueLog = (log: Parameters<typeof addScanLog>[0]) => {
    pendingLogsRef.current.push(log);
    if (flushTimerRef.current === null) {
      flushTimerRef.current = window.setTimeout(flushLogs, 100);
    }
  };

  const handleSelectFolder = async () => {
    try {
      const path = await selectFolder();
      if (path) {
        setFolderPath(path);
        setScanResult(null);
      }
    } catch (error) {
      console.error('选择文件夹失败:', error);
    }
  };

  const handleScan = async () => {
    if (!folderPath) return;
    setIsScanning(true);
    clearScanLogs();
    setScanResult(null);
    try {
      const unlistenLog = await onScanLog((log) => {
        const progressMatch = log.message.match(/已处理\s*(\d+)\/(\d+)/);
        if (progressMatch) {
          const processed = parseInt(progressMatch[1], 10);
          const total = parseInt(progressMatch[2], 10);
          setScanProgress({ processed, total });
        }
        enqueueLog(log);
      });
      unlistenScanLogRef.current = unlistenLog;

      const unlistenResults = await onScanResultsBatch((batch: ScanResultsBatch) => {
        addScanResultBatch(batch);
        if (batch.processed_files > 0 && batch.total_files > 0) {
          setScanProgress({ processed: batch.processed_files, total: batch.total_files });
        }
      });
      unlistenScanResultsRef.current = unlistenResults;

      const result: ScanResult = await scanMediaFolder(projectId || 0, folderPath);
      setScanResult(result);
      setScanProgress(null);
    } catch (error) {
      console.error('扫描失败:', error);
      showToast('error', '扫描失败', '扫描文件夹失败，请重试');
    } finally {
      setIsScanning(false);
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
        flushLogs();
      }
      if (unlistenScanLogRef.current) {
        unlistenScanLogRef.current();
        unlistenScanLogRef.current = null;
      }
      if (unlistenScanResultsRef.current) {
        unlistenScanResultsRef.current();
        unlistenScanResultsRef.current = null;
      }
    }
  };

  const handleRescan = () => {
    setScanResult(null);
    handleScan();
  };

  const handleDownloadLog = () => {
    if (scanLogs.length === 0) return;
    const logData = {
      project_id: projectId,
      scanned_at: new Date().toISOString(),
      folder_path: folderPath,
      total_files: scanResult ? scanResult.total_photos + scanResult.total_videos : 0,
      logs: scanLogs.map(({ id, ...rest }) => rest),
    };
    const fileName = `scan-log-${projectId}-${Date.now()}.json`;
    downloadJson(logData, fileName);
  };

  useEffect(() => {
    if (!projectId) return;
    const loadHistoryLog = async () => {
      try {
        const logFile = await getScanLog(projectId);
        if (logFile && logFile.logs && logFile.logs.length > 0) {
          const logsWithId: ScanLog[] = logFile.logs.map((log, index) => ({
            ...log,
            id: `${log.timestamp}-${index}`,
          }));
          addScanLogs(logsWithId);
        }
      } catch (error) {
        console.error('加载历史日志失败:', error);
      }
    };
    loadHistoryLog();
  }, [projectId]);

  useEffect(() => {
    return () => {
      if (unlistenScanLogRef.current) {
        unlistenScanLogRef.current();
      }
      if (unlistenScanResultsRef.current) {
        unlistenScanResultsRef.current();
      }
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
      }
    };
  }, []);

  return (
    <div className="p-10 max-w-6xl mx-auto animate-fade-in-up">
      {/* 页面标题区 */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-warmth-400/12 to-warmth-500/8 flex items-center justify-center">
            <Folder className="w-5 h-5 text-warmth-500" strokeWidth={1.8} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-stone-800 tracking-tight">选择照片文件夹</h2>
            <p className="text-sm text-stone-500 mt-0.5">系统会自动扫描并按日期分类照片</p>
          </div>
        </div>
      </div>

      {/* 选择文件夹 */}
      <div className="card p-6 mb-6">
        <label className="text-sm font-semibold text-stone-700 mb-3 block">照片文件夹</label>
        <div className="flex gap-3">
          <div className="flex-1 flex items-center gap-3 px-4 py-3 rounded-xl bg-stone-50 border-2 border-stone-200 transition-all duration-200 hover:border-stone-300">
            <Folder className="w-5 h-5 text-stone-400 flex-shrink-0" />
            <span className={`truncate text-sm ${folderPath ? 'text-stone-700 font-medium' : 'text-stone-400'}`}>
              {folderPath || '未选择文件夹'}
            </span>
          </div>
          <button onClick={handleSelectFolder} className="btn btn-secondary px-5">
            浏览...
          </button>
        </div>
      </div>

      {/* 扫描按钮 */}
      {folderPath && !scanResult && (
        <div className="mb-6">
          <button
            onClick={handleScan}
            disabled={isScanning}
            className="btn btn-primary btn-lg w-full justify-center text-base"
          >
            {isScanning ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                正在扫描...
              </>
            ) : (
              <>
                开始扫描
              </>
            )}
          </button>
        </div>
      )}

      {/* 状态和日志双栏布局 */}
      {folderPath && (isScanning || scanLogs.length > 0 || scanResult) && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 左侧：扫描状态和统计 */}
          <div className="card p-6 flex flex-col">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isScanning ? 'bg-warmth-100' : 'bg-success-bg'}`}>
                  {isScanning ? (
                    <RefreshCw className="w-5 h-5 text-warmth-500 animate-spin" />
                  ) : (
                    <CheckCircle className="w-5 h-5 text-success" />
                  )}
                </div>
                <h3 className="font-bold text-stone-800">{isScanning ? '扫描中' : '扫描完成'}</h3>
              </div>
              {!isScanning && scanResult && (
                <button
                  onClick={handleRescan}
                  className="text-sm text-warmth-500 hover:text-warmth-600 font-medium flex items-center gap-1.5 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  重新扫描
                </button>
              )}
            </div>

            {/* 实时统计 */}
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <StatCard icon={Image} label="照片总数" value={scanResult?.total_photos || 0} color="stone" />
                <StatCard icon={Film} label="视频总数" value={scanResult?.total_videos || 0} color="stone" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <StatCard icon={Image} label="已识别照片" value={scanResult?.recognized_photos || 0} color="success" />
                <StatCard icon={Film} label="已识别视频" value={scanResult?.recognized_videos || 0} color="success" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <StatCard icon={AlertCircle} label="重复跳过" value={(scanResult?.skipped_duplicate_photos || 0) + (scanResult?.skipped_duplicate_videos || 0)} color="warning" />
                <StatCard icon={AlertCircle} label="日期不匹配" value={(scanResult?.skipped_no_period_photos || 0) + (scanResult?.skipped_no_period_videos || 0)} color="brand" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <StatCard icon={AlertCircle} label="未识别日期" value={(scanResult?.skipped_no_date_photos || 0) + (scanResult?.skipped_no_date_videos || 0)} color="error" />
                <StatCard icon={AlertCircle} label="复制失败" value={(scanResult?.skipped_copy_failed_photos || 0) + (scanResult?.skipped_copy_failed_videos || 0)} color="error" />
              </div>
            </div>

            {!isScanning && scanResult && scanResult.total_photos === 0 && (
              <div className="mt-4 p-4 rounded-xl bg-warning-bg border border-warning-border/60 text-sm text-warning-text flex items-center gap-2">
                <span className="text-lg">⚠️</span>
                未找到任何照片，你可以继续创建项目，后续再添加照片
              </div>
            )}

            {/* 填充高度 */}
            <div className="flex-1" />

            {/* 进度条（扫描中显示） */}
            {isScanning && scanProgress && (
              <div className="mt-4">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-stone-600">扫描进度</span>
                  <span className="text-stone-700 font-medium">
                    {scanProgress.processed} / {scanProgress.total}
                  </span>
                </div>
                <div className="w-full h-2 bg-stone-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-warmth-400 to-warmth-500 transition-all duration-300"
                    style={{ width: `${(scanProgress.processed / scanProgress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* 右侧：日志面板 */}
          <div className="lg:col-span-2">
            <ScanLogPanel
              logs={scanLogs}
              isExpanded={true}
              autoScroll={autoScrollLog}
              onToggleAutoScroll={toggleAutoScrollLog}
              onDownload={handleDownloadLog}
              progress={scanProgress}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  color: 'stone' | 'success' | 'warning' | 'brand' | 'error';
}) {
  const colorMap = {
    stone: { bg: 'bg-stone-100', text: 'text-stone-600', value: 'text-stone-800' },
    success: { bg: 'bg-success-bg', text: 'text-success-text', value: 'text-success-text' },
    warning: { bg: 'bg-warning-bg', text: 'text-warning-text', value: 'text-warning-text' },
    brand: { bg: 'bg-warmth-100', text: 'text-warmth-700', value: 'text-warmth-700' },
    error: { bg: 'bg-error-bg', text: 'text-error-text', value: 'text-error-text' },
  };
  const c = colorMap[color];
  return (
    <div className="bg-stone-50/60 rounded-xl p-4 transition-all duration-200 hover:bg-white hover:shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-7 h-7 rounded-lg ${c.bg} flex items-center justify-center`}>
          <Icon className={`w-3.5 h-3.5 ${c.text}`} />
        </div>
        <span className="text-xs text-stone-500">{label}</span>
      </div>
      <p className={`text-xl font-bold ${c.value}`}>{value}</p>
    </div>
  );
}
