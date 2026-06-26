/**
 * 下载 JSON 数据为文件
 * @param data JSON 数据
 * @param filename 文件名
 */
export function downloadJson(data: unknown, filename: string): void {
  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  
  // 清理
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
