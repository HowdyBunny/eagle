import { useState, useEffect } from 'react';
import type { Project } from '../lib/types';
import { sendMessage } from '../lib/messaging';

interface ProjectSelectorProps {
  selectedId: string | null;
  onSelect: (project: Project | null) => void;
}

export function ProjectSelector({ selectedId, onSelect }: ProjectSelectorProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = async () => {
    setLoading(true);
    setError(null);
    const res = await sendMessage<Project[]>({ type: 'FETCH_PROJECTS' });
    if (res.success) {
      // Only show active projects
      setProjects(res.data.filter((p) => p.status === 'active'));
    } else {
      setError(res.error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    const project = projects.find((p) => p.id === id) ?? null;
    onSelect(project);
  };

  if (loading) {
    return (
      <div className="text-xs text-eagle-ink/50 py-1">加载项目中...</div>
    );
  }

  if (error) {
    return (
      <div className="space-y-1">
        <p className="text-xs text-red-600">{error}</p>
        <button
          onClick={fetchProjects}
          className="text-xs text-eagle-gold hover:underline"
        >
          重试
        </button>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="text-xs text-eagle-ink/50 py-1">
        暂无活跃项目。请先在系统中创建项目。
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-eagle-gold tracking-wide">关联项目</label>
        <button
          onClick={fetchProjects}
          className="text-xs text-eagle-gold/50 hover:text-eagle-gold transition-colors"
          title="刷新项目列表"
        >
          ↻
        </button>
      </div>
      <select
        value={selectedId ?? ''}
        onChange={handleChange}
        className="w-full rounded-lg border border-eagle-gold/40 bg-white px-2 py-1.5 text-xs text-eagle-ink font-medium focus:border-eagle-gold focus:outline-none focus:ring-1 focus:ring-eagle-gold cursor-pointer"
      >
        <option value="">— 不关联项目 —</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            [{p.client_name}] {p.project_name}
          </option>
        ))}
      </select>
    </div>
  );
}
