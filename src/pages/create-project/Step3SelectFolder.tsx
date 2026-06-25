import { useState } from 'react';
import { Folder, Image, Film, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { useCreateProjectStore } from '../../store/createProjectStore';
import { scanMediaFolder, selectFolder } from '../../utils/tauriCommands';
import type { ScanResult } from '../../types';

export default function Step3SelectFolder() {
  const {
    folderPath,
    scanResult,
    isScanning,
    projectId,
    setFolderPath,
    setScanResult,
    setIsScanning,
  } = useCreateProjectStore();

  const [scanProgress, setScanProgress] = useState(0);

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
    setScanProgress(0);

    try {
      // 模拟进度（实际扫描进度可以通过事件获取，这里先简化）
      const progressInterval = setInterval(() => {
        setScanProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + 10;
        });
      }, 200);

      const result: ScanResult = await scanMediaFolder(projectId || 0, folderPath);

      clearInterval(progressInterval);
      setScanProgress(100);
      setScanResult(result);
    } catch (error) {
      console.error('扫描失败:', error);
      alert('扫描文件夹失败，请重试');
    } finally {
      setIsScanning(false);
    }
  };

  const handleRescan = () => {
    setScanResult(null);
    setScanProgress(0);
    handleScan();
  };

  

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

          {isScanning && (
            <div className="mt-3">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-primary-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${scanProgress}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1 text-center">
                正在扫描照片... {scanProgress}%
              </p>
            </div>
          )}
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
