import { useState } from 'react';
import { X, Download, ExternalLink, Play, Pause, Loader2 } from 'lucide-react';
import { saveMusicFile } from '../utils/tauriCommands';

interface MusicLibraryProps {
  projectId: number;
  onSelect: (musicPath: string) => void;
  onClose: () => void;
}

const freeMusicWebsites = [
  {
    name: 'Free Music Archive',
    url: 'https://freemusicarchive.org/',
    description: '大量无版权音乐，支持直接下载',
    genres: ['电子', '古典', '摇滚', '爵士'],
  },
  {
    name: 'Bensound',
    url: 'https://www.bensound.com/',
    description: '高品质免版权音乐，适合视频背景',
    genres: ['钢琴', '吉他', '氛围', '电影'],
  },
  {
    name: 'Incompetech',
    url: 'https://incompetech.com/music/royalty-free/',
    description: 'Kevin MacLeod制作的免版权音乐',
    genres: ['史诗', '喜剧', '悬疑', '浪漫'],
  },
  {
    name: 'Zapsplat',
    url: 'https://www.zapsplat.com/',
    description: '音效和背景音乐资源库',
    genres: ['音效', '氛围', '电子', '世界'],
  },
];

const builtInMusic = [
  {
    name: '温柔时光',
    description: '温馨的钢琴旋律，适合成长记录',
    duration: '3:45',
  },
  {
    name: '快乐童年',
    description: '轻快活泼的节奏，充满童趣',
    duration: '2:30',
  },
  {
    name: '时光流逝',
    description: '舒缓的背景音乐，适合回忆视频',
    duration: '4:15',
  },
  {
    name: '梦想启航',
    description: '充满希望的旋律，励志向上',
    duration: '3:00',
  },
];

export function MusicLibrary({ projectId, onSelect, onClose }: MusicLibraryProps) {
  const [activeTab, setActiveTab] = useState<'websites' | 'builtin'>('websites');
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  const [downloadingIndex, setDownloadingIndex] = useState<number | null>(null);

  const handlePlayPreview = (index: number) => {
    setPlayingIndex(playingIndex === index ? null : index);
  };

  const handleSelectBuiltIn = async (music: typeof builtInMusic[0], index: number) => {
    setDownloadingIndex(index);
    try {
      const response = await fetch(`https://assets.mchost.guru/baby-growth-video/music/${encodeURIComponent(music.name)}.mp3`);
      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        const localPath = await saveMusicFile(projectId, uint8Array, music.name);
        onSelect(localPath);
        onClose();
      }
    } catch (error) {
      console.error('下载音乐失败:', error);
    } finally {
      setDownloadingIndex(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">音乐库</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-stone-100 transition-colors">
            <X className="w-5 h-5 text-stone-500" />
          </button>
        </div>

        <div className="flex border-b">
          <button
            onClick={() => setActiveTab('websites')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === 'websites' ? 'text-primary-500 border-b-2 border-primary-500' : 'text-stone-500 hover:text-stone-700'
            }`}
          >
            免费音乐网站
          </button>
          <button
            onClick={() => setActiveTab('builtin')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === 'builtin' ? 'text-primary-500 border-b-2 border-primary-500' : 'text-stone-500 hover:text-stone-700'
            }`}
          >
            内置音乐
          </button>
        </div>

        <div className="p-4 overflow-y-auto max-h-[60vh]">
          {activeTab === 'websites' ? (
            <div className="space-y-3">
              {freeMusicWebsites.map((site, index) => (
                <div key={index} className="p-4 bg-stone-50 rounded-lg hover:bg-stone-100 transition-colors">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-stone-800">{site.name}</h3>
                        <a href={site.url} target="_blank" rel="noopener noreferrer" className="text-primary-500 hover:underline">
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
                      <p className="text-sm text-stone-500 mt-1">{site.description}</p>
                      <div className="flex gap-2 mt-2">
                        {site.genres.map((genre) => (
                          <span key={genre} className="px-2 py-0.5 bg-stone-200 text-stone-600 text-xs rounded">
                            {genre}
                          </span>
                        ))}
                      </div>
                    </div>
                    <a href={site.url} target="_blank" rel="noopener noreferrer" className="btn btn-outline text-sm">
                      访问
                    </a>
                  </div>
                </div>
              ))}
              <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-700">
                  💡 提示：在这些网站下载音乐后，点击"选择"按钮上传到本应用
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {builtInMusic.map((music, index) => (
                <div key={index} className="p-4 bg-stone-50 rounded-lg hover:bg-stone-100 transition-colors">
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => handlePlayPreview(index)}
                      className="p-2 bg-primary-100 hover:bg-primary-200 rounded-full transition-colors"
                    >
                      {playingIndex === index ? (
                        <Pause className="w-4 h-4 text-primary-600" />
                      ) : (
                        <Play className="w-4 h-4 text-primary-600" />
                      )}
                    </button>
                    <div className="flex-1">
                      <h3 className="font-medium text-stone-800">{music.name}</h3>
                      <p className="text-sm text-stone-500">{music.description}</p>
                    </div>
                    <div className="text-sm text-stone-400">{music.duration}</div>
                    <button
                      onClick={() => handleSelectBuiltIn(music, index)}
                      disabled={downloadingIndex !== null}
                      className="btn btn-primary text-sm disabled:opacity-50"
                    >
                      {downloadingIndex === index ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                      {downloadingIndex === index ? '下载中' : '使用'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}