import { useState, useEffect } from 'react';
import eagleIcon from '/wxt.svg';
import { getApiUrl, setApiUrl } from '../../lib/storage';

type ConnectionStatus = 'unknown' | 'testing' | 'ok' | 'error';

export default function App() {
  const [apiUrl, setApiUrlState] = useState('http://localhost:8000');
  const [connStatus, setConnStatus] = useState<ConnectionStatus>('unknown');
  const [connError, setConnError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getApiUrl().then(setApiUrlState);
  }, []);

  const handleSave = async () => {
    await setApiUrl(apiUrl.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleTestConnection = async () => {
    setConnStatus('testing');
    setConnError('');
    try {
      const url = apiUrl.trim().replace(/\/$/, '');
      const res = await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        setConnStatus('ok');
      } else {
        setConnStatus('error');
        setConnError(`HTTP ${res.status}`);
      }
    } catch (e) {
      setConnStatus('error');
      setConnError(e instanceof Error ? e.message : '连接失败');
    }
  };

  return (
    <div className="w-80 bg-white font-sans">
      {/* Header */}
      <div className="border-b border-eagle-border/60 px-4 py-3 flex items-center gap-2 bg-white">
        <img src={eagleIcon} alt="Eagle" className="w-6 h-6 object-contain" />
        <span className="font-display font-bold text-base text-eagle-primary tracking-tight">Eagle</span>
        <span className="text-eagle-gold text-sm font-medium">设置</span>
      </div>

      {/* Body */}
      <div className="p-4 space-y-4">
        {/* API URL */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-eagle-primary">
            后端 API 地址
          </label>
          <input
            type="url"
            value={apiUrl}
            onChange={(e) => setApiUrlState(e.target.value)}
            placeholder="http://localhost:8000"
            className="w-full rounded-lg border border-eagle-border px-3 py-2 text-sm text-eagle-ink placeholder-eagle-ink/30
              focus:border-eagle-gold focus:outline-none focus:ring-1 focus:ring-eagle-gold"
          />
          <p className="text-xs text-eagle-ink/40">Eagle 后端服务地址，默认 localhost:8000</p>
        </div>

        {/* Connection test */}
        <div className="space-y-2">
          <button
            onClick={handleTestConnection}
            disabled={connStatus === 'testing'}
            className="w-full rounded-lg border border-eagle-gold/40 px-3 py-2 text-sm font-medium text-eagle-gold
              hover:bg-eagle-card-end active:bg-eagle-card-end disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {connStatus === 'testing' ? '测试中...' : '测试连接'}
          </button>

          {connStatus === 'ok' && (
            <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-3 py-2">
              <span className="h-2 w-2 rounded-full bg-green-500" />
              <span className="text-xs text-green-700 font-medium">连接成功 ✓</span>
            </div>
          )}
          {connStatus === 'error' && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-red-500" />
                <span className="text-xs text-red-700 font-medium">连接失败</span>
              </div>
              {connError && <p className="text-xs text-red-600 pl-4">{connError}</p>}
            </div>
          )}
        </div>

        {/* Save button */}
        <button
          onClick={handleSave}
          className="w-full rounded-lg bg-gradient-to-br from-[#d4b344] to-[#b8921c] px-4 py-2 text-sm font-semibold text-white
            hover:from-[#c5a028] hover:to-[#a38014] active:scale-[0.98] transition-all shadow-sm"
        >
          {saved ? '已保存 ✓' : '保存设置'}
        </button>

        {/* Info */}
        <div className="rounded-xl bg-gradient-to-br from-eagle-card-start to-eagle-card-end border border-eagle-border px-3 py-2 space-y-1">
          <p className="text-xs font-bold text-eagle-gold">如何使用</p>
          <ul className="text-xs text-eagle-ink/60 space-y-0.5 list-disc list-inside">
            <li>打开 LinkedIn 或猎聘候选人主页</li>
            <li>页面右侧会出现 Eagle 浮窗</li>
            <li>选择项目，点击「采集候选人」</li>
            <li>可选择触发 AI 自动评估</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
