import { useEffect, useRef } from 'react';
import { Folder, Image, Film, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { useCreateProjectStore } from '../../store/createProjectStore';
import { scanMediaFolder, selectFolder, onScanLog, getScanLog } from '../../utils/tauriCommands';
import { downloadJson } from '../../utils/download';
import type { ScanResult, ScanLog } from '../../types';
import ScanLogPanel from '../../components/ScanLogPanel';

export default function Step3SelectFolder() {
  const {
    folderPath,
    scanResult,
    isScanning,
    scanProgress,
    projectId,
    scanLogs,
    isLogExpanded,
    autoScrollLog,
    setFolderPath,
    setScanResult,
    setIsScanning,
    setScanProgress,
    addScanLog,
    addScanLogs,
    clearScanLogs,
    toggleLogExpanded,
    toggleAutoScrollLog,
  } = useCreateProjectStore();

  const unlistenScanLogRef = useRef<(() => void) | null>(null);
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
    try {
      const unlisten = await onScanLog((log) => {
        // 解析进度日志: "已处理 X/Y"
        const progressMatch = log.message.match(/已处理\s*(\d+)\/(\d+)/);
        if (progressMatch) {
          const processed = parseInt(progressMatch[1], 10);
          const total = parseInt(progressMatch[2], 10);
          setScanProgress({ processed, total });
        }
        enqueueLog(log);
      });
      unlistenScanLogRef.current = unlisten;
      const result: ScanResult = await scanMediaFolder(projectId || 0, folderPath);
      setScanResult(result);
      setScanProgress(null);  // 扫描完成,清除进度
    } catch (error) {
      console.error('扫描失败:', error);
      alert('扫描文件夹失败，请重试');
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
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
      }
    };
  }, []);

  return (
    <div className="p-10 max-w-3xl mx-auto animate-fade-in-up">
      {/* 页面标题区 */}
      <div className="mb-10">
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

      {/* 日志面板 */}
      {folderPath && (isScanning || scanLogs.length > 0) && (
        <div className="mb-6">
          <ScanLogPanel
            logs={scanLogs}
            isExpanded={isLogExpanded}
            onToggleExpand={toggleLogExpanded}
            autoScroll={autoScrollLog}
            onToggleAutoScroll={toggleAutoScrollLog}
            onDownload={handleDownloadLog}
            progress={scanProgress}
          />
        </div>
      )}

      {/* 扫描结果 */}
      {scanResult && (
        <div className="card p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-emerald-500" />
              </div>
              <h3 className="font-bold text-stone-800">扫描完成</h3>
            </div>
            <button
              onClick={handleRescan}
              className="text-sm text-warmth-500 hover:text-warmth-600 font-medium flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              重新扫描
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <StatCard icon={Image} label="照片总数" value={scanResult.total_photos} color="stone" />
            <StatCard icon={Film} label="视频总数" value={scanResult.total_videos} color="stone" />
            <StatCard icon={CheckCircle} label="已识别总数" value={(scanResult.recognized_photos || 0) + (scanResult.recognized_videos || 0)} color="emerald" />
            <StatCard icon={Image} label="已识别照片" value={scanResult.recognized_photos || 0} color="emerald" />
            <StatCard icon={Film} label="已识别视频" value={scanResult.recognized_videos || 0} color="emerald" />
            <StatCard icon={AlertCircle} label="重复照片" value={scanResult.skipped_duplicate_photos || 0} color="amber" />
            <StatCard icon={AlertCircle} label="重复视频" value={scanResult.skipped_duplicate_videos || 0} color="amber" />
            <StatCard icon={AlertCircle} label="日期不匹配照片" value={scanResult.skipped_no_period_photos || 0} color="orange" />
            <StatCard icon={AlertCircle} label="日期不匹配视频" value={scanResult.skipped_no_period_videos || 0} color="orange" />
            <StatCard icon={AlertCircle} label="未识别日期照片" value={scanResult.skipped_no_date_photos || 0} color="rose" />
            <StatCard icon={AlertCircle} label="未识别日期视频" value={scanResult.skipped_no_date_videos || 0} color="rose" />
          </div>

          {scanResult.total_photos === 0 && (
            <div className="mt-4 p-4 rounded-xl bg-amber-50 border border-amber-200/60 text-sm text-amber-700 flex items-center gap-2">
              <span className="text-lg">⚠️</span>
              未找到任何照片，你可以继续创建项目，后续再添加照片
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  color: 'stone' | 'emerald' | 'amber' | 'orange' | 'rose';
}) {
  const colorMap = {
    stone: { bg: 'bg-stone-100', text: 'text-stone-600', value: 'text-stone-800' },
    emerald: { bg: 'bg-emerald-100', text: 'text-emerald-600', value: 'text-emerald-700' },
    amber: { bg: 'bg-amber-100', text: 'text-amber-600', value: 'text-amber-700' },
    orange: { bg: 'bg-orange-100', text: 'text-orange-600', value: 'text-orange-700' },
    rose: { bg: 'bg-rose-100', text: 'text-rose-600', value: 'text-rose-700' },
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
