import { useState, useEffect } from 'react';
import { getApiUrl, getApiKey, setApiUrl, setApiKey } from '../../lib/storage';

type ConnectionStatus = 'unknown' | 'testing' | 'ok' | 'error';

export default function App() {
  const [apiUrl, setApiUrlState] = useState('http://localhost:8000');
  const [apiKey, setApiKeyState] = useState('');
  const [connStatus, setConnStatus] = useState<ConnectionStatus>('unknown');
  const [connError, setConnError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getApiUrl().then(setApiUrlState);
    getApiKey().then(setApiKeyState);
  }, []);

  const handleSave = async () => {
    await setApiUrl(apiUrl.trim());
    await setApiKey(apiKey.trim());
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
      <div className="bg-blue-600 px-4 py-3 flex items-center gap-2">
        <svg width={22} height={22} viewBox="0 0 24 24" fill="none">
          <path d="M12 2L3 7v10l9 5 9-5V7L12 2z" fill="white" fillOpacity="0.9" />
          <path d="M12 6l-5 2.8v5.4l5 2.8 5-2.8V8.8L12 6z" fill="#2563eb" />
        </svg>
        <span className="text-white font-bold text-base tracking-wide">Eagle</span>
        <span className="text-blue-200 text-sm">设置</span>
      </div>

      {/* Body */}
      <div className="p-4 space-y-4">
        {/* API URL */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-gray-700">
            后端 API 地址
          </label>
          <input
            type="url"
            value={apiUrl}
            onChange={(e) => setApiUrlState(e.target.value)}
            placeholder="http://localhost:8000"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-800 placeholder-gray-400
              focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-400">Eagle 后端服务地址，默认 localhost:8000</p>
        </div>

        {/* API Key */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-gray-700">
            API Key
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKeyState(e.target.value)}
            placeholder="在 .env 中配置的 API_KEY"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-800 placeholder-gray-400
              focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-400">对应后端 .env 中的 API_KEY 变量</p>
        </div>

        {/* Connection test */}
        <div className="space-y-2">
          <button
            onClick={handleTestConnection}
            disabled={connStatus === 'testing'}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700
              hover:bg-gray-50 active:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {connStatus === 'testing' ? '测试中...' : '测试连接'}
          </button>

          {connStatus === 'ok' && (
            <div className="flex items-center gap-2 rounded-md bg-green-50 border border-green-200 px-3 py-2">
              <span className="h-2 w-2 rounded-full bg-green-500" />
              <span className="text-xs text-green-700 font-medium">连接成功 ✓</span>
            </div>
          )}
          {connStatus === 'error' && (
            <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 space-y-0.5">
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
          className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white
            hover:bg-blue-700 active:bg-blue-800 transition-colors"
        >
          {saved ? '已保存 ✓' : '保存设置'}
        </button>

        {/* Info */}
        <div className="rounded-md bg-gray-50 border border-gray-200 px-3 py-2 space-y-1">
          <p className="text-xs font-medium text-gray-600">如何使用</p>
          <ul className="text-xs text-gray-500 space-y-0.5 list-disc list-inside">
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
