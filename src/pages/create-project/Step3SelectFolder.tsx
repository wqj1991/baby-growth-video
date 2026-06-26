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
    projectId,
    scanLogs,
    isLogExpanded,
    autoScrollLog,
    setFolderPath,
    setScanResult,
    setIsScanning,
    addScanLog,
    addScanLogs,
    clearScanLogs,
    toggleLogExpanded,
    toggleAutoScrollLog,
  } = useCreateProjectStore();

  const unlistenScanLogRef = useRef<(() => void) | null>(null);
  const pendingLogsRef = useRef<Array<Parameters<typeof addScanLog>[0]>>([]);
  const flushTimerRef = useRef<number | null>(null);

  // 批量刷新日志
  const flushLogs = () => {
    if (pendingLogsRef.current.length > 0) {
      const logs = pendingLogsRef.current;
      pendingLogsRef.current = [];
      addScanLogs(logs);
    }
    flushTimerRef.current = null;
  };

  // 添加日志到缓冲，定时批量刷新
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
      // 注册日志事件监听
      const unlisten = await onScanLog((log) => {
        enqueueLog(log);
      });
      unlistenScanLogRef.current = unlisten;

      const result: ScanResult = await scanMediaFolder(projectId || 0, folderPath);
      setScanResult(result);
    } catch (error) {
      console.error('扫描失败:', error);
      alert('扫描文件夹失败，请重试');
    } finally {
      setIsScanning(false);
      // 强制刷新剩余日志
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
        flushLogs();
      }
      // 移除事件监听
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

  // 下载日志
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

  // 加载历史日志
  useEffect(() => {
    if (!projectId) return;
    
    const loadHistoryLog = async () => {
      try {
        const logFile = await getScanLog(projectId);
        if (logFile && logFile.logs && logFile.logs.length > 0) {
          // 转换为带 id 的格式
          const logsWithId: ScanLog[] = logFile.logs.map((log, index) => ({
            ...log,
            id: `${log.timestamp}-${index}`,
          }));
          // 批量添加到 store
          addScanLogs(logsWithId);
        }
      } catch (error) {
        console.error('加载历史日志失败:', error);
      }
    };
    
    loadHistoryLog();
  }, [projectId]);

  // 组件卸载时清理事件监听和定时器
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
    <div className="p-8 max-w-2xl">
      <h2 className="text-xl font-bold mb-2">选择照片文件夹</h2>
      <p className="text-gray-500 mb-6">
        选择宝宝照片所在的文件夹，系统会自动扫描并按日期分类
      </p>

      {/* 选择文件夹 */}
      <div className="mb-6">
        <label className="form-label">照片文件夹</label>
        <div className="flex gap-3">
          <div className="flex-1 input flex items-center gap-2 overflow-hidden">
            <Folder className="w-5 h-5 text-gray-400 flex-shrink-0" />
            <span className="truncate text-gray-700">
              {folderPath || '未选择文件夹'}
            </span>
          </div>
          <button onClick={handleSelectFolder} className="btn btn-secondary">
            选择文件夹
          </button>
        </div>
      </div>

      {/* 扫描按钮 */}
      {folderPath && !scanResult && (
        <div className="mb-6">
          <button
            onClick={handleScan}
            disabled={isScanning}
            className={`btn btn-primary w-full ${isScanning ? 'opacity-75' : ''}`}
          >
            {isScanning ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                扫描中...
              </>
            ) : (
              '开始扫描'
            )}
          </button>
        </div>
      )}

      {/* 日志面板 - 扫描中和扫描完成后都显示 */}
      {folderPath && (isScanning || scanLogs.length > 0) && (
        <div className="mb-6">
          <ScanLogPanel
            logs={scanLogs}
            isExpanded={isLogExpanded}
            onToggleExpand={toggleLogExpanded}
            autoScroll={autoScrollLog}
            onToggleAutoScroll={toggleAutoScrollLog}
            onDownload={handleDownloadLog}
          />
        </div>
      )}

      {/* 扫描结果 */}
      {scanResult && (
        <div className="bg-gray-50 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              扫描完成
            </h3>
            <button
              onClick={handleRescan}
              className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
            >
              <RefreshCw className="w-4 h-4" />
              重新扫描
            </button>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-lg p-4">
              <div className="flex items-center gap-2 text-gray-600 mb-1">
                <Image className="w-4 h-4" />
                <span className="text-sm">照片总数</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {scanResult.total_photos}
              </p>
            </div>

            <div className="bg-white rounded-lg p-4">
              <div className="flex items-center gap-2 text-gray-600 mb-1">
                <Film className="w-4 h-4" />
                <span className="text-sm">视频总数</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {scanResult.total_videos}
              </p>
            </div>

            <div className="bg-white rounded-lg p-4">
              <div className="flex items-center gap-2 text-gray-600 mb-1">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="text-sm">已识别总数</span>
              </div>
              <p className="text-2xl font-bold text-green-600">
                {(scanResult.recognized_photos || 0) + (scanResult.recognized_videos || 0)}
              </p>
            </div>

            <div className="bg-white rounded-lg p-4">
              <div className="flex items-center gap-2 text-gray-600 mb-1">
                <Image className="w-4 h-4 text-green-500" />
                <span className="text-sm">已识别照片</span>
              </div>
              <p className="text-2xl font-bold text-green-600">
                {scanResult.recognized_photos || 0}
              </p>
            </div>

            <div className="bg-white rounded-lg p-4">
              <div className="flex items-center gap-2 text-gray-600 mb-1">
                <Film className="w-4 h-4 text-green-500" />
                <span className="text-sm">已识别视频</span>
              </div>
              <p className="text-2xl font-bold text-green-600">
                {scanResult.recognized_videos || 0}
              </p>
            </div>

            <div className="bg-white rounded-lg p-4">
              <div className="flex items-center gap-2 text-gray-600 mb-1">
                <AlertCircle className="w-4 h-4 text-yellow-500" />
                <span className="text-sm">重复照片</span>
              </div>
              <p className="text-2xl font-bold text-yellow-600">
                {scanResult.skipped_duplicate_photos || 0}
              </p>
            </div>

            <div className="bg-white rounded-lg p-4">
              <div className="flex items-center gap-2 text-gray-600 mb-1">
                <AlertCircle className="w-4 h-4 text-yellow-500" />
                <span className="text-sm">重复视频</span>
              </div>
              <p className="text-2xl font-bold text-yellow-600">
                {scanResult.skipped_duplicate_videos || 0}
              </p>
            </div>

            <div className="bg-white rounded-lg p-4">
              <div className="flex items-center gap-2 text-gray-600 mb-1">
                <AlertCircle className="w-4 h-4 text-orange-500" />
                <span className="text-sm">日期不匹配照片</span>
              </div>
              <p className="text-2xl font-bold text-orange-600">
                {scanResult.skipped_no_period_photos || 0}
              </p>
            </div>

            <div className="bg-white rounded-lg p-4">
              <div className="flex items-center gap-2 text-gray-600 mb-1">
                <AlertCircle className="w-4 h-4 text-orange-500" />
                <span className="text-sm">日期不匹配视频</span>
              </div>
              <p className="text-2xl font-bold text-orange-600">
                {scanResult.skipped_no_period_videos || 0}
              </p>
            </div>

            <div className="bg-white rounded-lg p-4">
              <div className="flex items-center gap-2 text-gray-600 mb-1">
                <AlertCircle className="w-4 h-4 text-red-500" />
                <span className="text-sm">未识别日期照片</span>
              </div>
              <p className="text-2xl font-bold text-red-600">
                {scanResult.skipped_no_date_photos || 0}
              </p>
            </div>

            <div className="bg-white rounded-lg p-4">
              <div className="flex items-center gap-2 text-gray-600 mb-1">
                <AlertCircle className="w-4 h-4 text-red-500" />
                <span className="text-sm">未识别日期视频</span>
              </div>
              <p className="text-2xl font-bold text-red-600">
                {scanResult.skipped_no_date_videos || 0}
              </p>
            </div>
          </div>

          {scanResult.total_photos === 0 && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-700">
                ⚠️ 未找到任何照片，你可以继续创建项目，后续再添加照片
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
