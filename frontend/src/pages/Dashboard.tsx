import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/authStore';
import { projectApi, cloneApi } from '../services/api';
import { Plus, Globe, Trash2, ExternalLink, Download, LogOut, FolderOpen, Upload, X } from 'lucide-react';
import toast from 'react-hot-toast';
import LanguageSelector from '../components/LanguageSelector';
import LoadPageModal from '../components/LoadPageModal';
import DraggableToast from '../components/DraggableToast';
import { useAgentFixer } from '../hooks/useAgentFixer';

interface Project {
  id: string;
  name: string;
  url_original: string | null;
  status: string;
  thumbnail: string | null;
  created_at: string;
  updated_at: string;
}

interface CloneProgress {
  stage: string;
  percent: number;
  message: string;
  projectId?: string;
  pageId?: string;
  zipPath?: string;
  assetCount?: number;
}

export default function Dashboard() {
  const { t } = useTranslation(['dashboard', 'common', 'clone']);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCloneModal, setShowCloneModal] = useState(false);
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [showLoadPageModal, setShowLoadPageModal] = useState(false);
  const [cloneUrl, setCloneUrl] = useState('');
  const [cloneName, setCloneName] = useState('');
  const [newProjectName, setNewProjectName] = useState('');
  const [cloning, setCloning] = useState(false);
  const [cloneProgress, setCloneProgress] = useState<CloneProgress | null>(null);
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const { toastVisible, toastMessage, dismissToast } = useAgentFixer();

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      const { data } = await projectApi.getAll();
      setProjects(data.projects);
    } catch {
      toast.error(t('common:error'));
    } finally {
      setLoading(false);
    }
  };

  const handleClone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cloneUrl) return;

    setCloning(true);
    setCloneProgress({ stage: 'starting', percent: 0, message: t('clone:cloningStarted') });

    try {
      const response = await cloneApi.cloneStream({ url: cloneUrl, name: cloneName || undefined });

      if (!response.ok) {
        throw new Error('Clone request failed');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                setCloneProgress(data);

                if (data.stage === 'complete' && data.pageId) {
                  toast.success(t('clone:cloneSuccess'));
                  setShowCloneModal(false);
                  setCloneUrl('');
                  setCloneName('');
                  setCloning(false);
                  setCloneProgress(null);
                  navigate(`/editor/${data.pageId}?project=${data.projectId}`);
                  return;
                }

                if (data.stage === 'error') {
                  toast.error(data.message || t('clone:cloneFailed'));
                  setCloning(false);
                  setCloneProgress(null);
                  loadProjects();
                  return;
                }
              } catch { /* ignore malformed SSE data */ }
            }
          }
        }
      }

      // Fallback: if SSE didn't complete properly, try polling
      setCloning(false);
      setCloneProgress(null);
      loadProjects();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } }; message?: string };
      toast.error(error.response?.data?.error || error.message || t('clone:cloneFailed'));
      setCloning(false);
      setCloneProgress(null);
    }
  };

  const handleNewProject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data } = await projectApi.create({ name: newProjectName || 'Untitled Project' });
      toast.success(t('common:success'));
      setShowNewProjectModal(false);
      setNewProjectName('');
      navigate(`/editor/${data.page.id}?project=${data.project.id}`);
    } catch {
      toast.error(t('common:error'));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('dashboard:deleteConfirm'))) return;
    try {
      await projectApi.delete(id);
      toast.success(t('common:success'));
      setProjects(projects.filter((p) => p.id !== id));
    } catch {
      toast.error(t('common:error'));
    }
  };

  const handleExport = async (id: string, name: string) => {
    try {
      const { data } = await projectApi.export(id);
      const url = window.URL.createObjectURL(new Blob([data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `${name.replace(/[^a-zA-Z0-9]/g, '_')}.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success(t('dashboard:exportSuccess'));
    } catch {
      toast.error(t('dashboard:exportFailed'));
    }
  };

  const openProject = async (projectId: string) => {
    try {
      const { data } = await projectApi.getById(projectId);
      if (data.pages && data.pages.length > 0) {
        navigate(`/editor/${data.pages[0].id}?project=${projectId}`);
      } else {
        toast.error(t('common:error'));
      }
    } catch {
      toast.error(t('common:error'));
    }
  };

  const handleLoadPageSuccess = (projectId: string, pageId: string) => {
    toast.success(t('common:success'));
    setShowLoadPageModal(false);
    navigate(`/editor/${pageId}?project=${projectId}`);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'cloned': return 'bg-green-100 text-green-700';
      case 'cloning': return 'bg-yellow-100 text-yellow-700';
      case 'failed': return 'bg-red-100 text-red-700';
      case 'ready': return 'bg-green-100 text-green-700';
      case 'processing': return 'bg-yellow-100 text-yellow-700';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  const getStatusLabel = (status: string) => {
    const key = status as keyof typeof statusMap;
    const statusMap = {
      cloned: t('dashboard:cloned'),
      cloning: t('dashboard:cloning'),
      failed: t('dashboard:failed'),
      draft: t('dashboard:draft'),
      ready: t('dashboard:ready'),
      processing: t('dashboard:processing'),
    };
    return statusMap[key] || status;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Agent Fixer Toast */}
      <DraggableToast visible={toastVisible} message={toastMessage} onDismiss={dismissToast} />

      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <h1 className="text-xl font-bold text-gray-900">
              <span className="text-blue-600">DEX</span>TER
            </h1>
            <div className="flex items-center gap-4">
              <LanguageSelector />
              <span className="text-sm text-gray-500">{user?.email}</span>
              <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full font-medium uppercase">
                {user?.plan}
              </span>
              <button
                onClick={logout}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                title={t('common:logout')}
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Actions */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">{t('dashboard:title')}</h2>
            <p className="text-gray-500 mt-1">{t('dashboard:projectCount', { count: projects.length })}</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowNewProjectModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium text-sm"
            >
              <Plus size={16} />
              {t('dashboard:newProject')}
            </button>
            <button
              onClick={() => setShowLoadPageModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium text-sm"
            >
              <Upload size={16} />
              {t('dashboard:loadPage')}
            </button>
            <button
              onClick={() => setShowCloneModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
            >
              <Globe size={16} />
              {t('dashboard:clonePage')}
            </button>
          </div>
        </div>

        {/* Projects Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-20">
            <FolderOpen size={48} className="mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">{t('dashboard:noProjects')}</h3>
            <p className="text-gray-500 mb-6">{t('dashboard:noProjectsDesc')}</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setShowNewProjectModal(true)}
                className="px-4 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium text-sm"
              >
                {t('dashboard:newProject')}
              </button>
              <button
                onClick={() => setShowLoadPageModal(true)}
                className="px-4 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium text-sm"
              >
                {t('dashboard:loadPage')}
              </button>
              <button
                onClick={() => setShowCloneModal(true)}
                className="px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
              >
                {t('dashboard:clonePage')}
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <div
                key={project.id}
                className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden group"
              >
                <div
                  onClick={() => openProject(project.id)}
                  className="h-40 bg-gradient-to-br from-gray-100 to-gray-50 flex items-center justify-center cursor-pointer"
                >
                  {project.thumbnail ? (
                    <img
                      src={`${import.meta.env.VITE_API_URL?.replace('/api', '')}${project.thumbnail}`}
                      alt={project.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Globe size={32} className="text-gray-300" />
                  )}
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">{project.name}</h3>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(project.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ml-2 ${getStatusColor(project.status)}`}>
                      {getStatusLabel(project.status)}
                    </span>
                  </div>

                  {project.url_original && (
                    <p className="text-xs text-gray-400 mt-2 truncate">{project.url_original}</p>
                  )}

                  <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-100">
                    <button
                      onClick={() => openProject(project.id)}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                    >
                      <ExternalLink size={12} />
                      {t('common:edit')}
                    </button>
                    <button
                      onClick={() => handleExport(project.id, project.name)}
                      className="flex items-center justify-center p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                      title={t('common:export')}
                    >
                      <Download size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(project.id)}
                      className="flex items-center justify-center p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title={t('common:delete')}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Clone Modal with Progress */}
      {showCloneModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">{t('clone:title')}</h3>
              <button onClick={() => { if (!cloning) { setShowCloneModal(false); setCloneProgress(null); } }} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            {cloneProgress && cloning ? (
              <div className="space-y-4">
                {/* Progress Bar */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700 capitalize">{cloneProgress.stage}</span>
                    <span className="text-sm text-gray-500">{cloneProgress.percent}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div
                      className="bg-blue-600 h-2.5 rounded-full transition-all duration-500"
                      style={{ width: `${cloneProgress.percent}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-2">{cloneProgress.message}</p>
                </div>

                {/* Stage indicators */}
                <div className="grid grid-cols-4 gap-2">
                  {['fetching', 'parsing', 'downloading', 'building'].map((stage) => {
                    const stages = ['fetching', 'parsing', 'downloading', 'building'];
                    const currentIdx = stages.indexOf(cloneProgress.stage);
                    const stageIdx = stages.indexOf(stage);
                    const isComplete = stageIdx < currentIdx || cloneProgress.stage === 'complete';
                    const isCurrent = stage === cloneProgress.stage;

                    return (
                      <div key={stage} className="text-center">
                        <div className={`w-8 h-8 rounded-full mx-auto flex items-center justify-center text-xs font-bold ${
                          isComplete ? 'bg-green-500 text-white' :
                          isCurrent ? 'bg-blue-500 text-white animate-pulse' :
                          'bg-gray-200 text-gray-400'
                        }`}>
                          {isComplete ? '\u2713' : stageIdx + 1}
                        </div>
                        <p className="text-xs text-gray-500 mt-1 capitalize">{t(`clone:${stage}`)}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <form onSubmit={handleClone} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('clone:urlLabel')}</label>
                  <input
                    type="url"
                    value={cloneUrl}
                    onChange={(e) => setCloneUrl(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    placeholder={t('clone:urlPlaceholder')}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    {t('clone:nameLabel')} <span className="text-gray-400">({t('clone:optional')})</span>
                  </label>
                  <input
                    type="text"
                    value={cloneName}
                    onChange={(e) => setCloneName(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    placeholder={t('clone:namePlaceholder')}
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCloneModal(false)}
                    className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium text-sm"
                  >
                    {t('common:cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={cloning}
                    className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm disabled:opacity-50"
                  >
                    {t('clone:startCloning')}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* New Project Modal */}
      {showNewProjectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('dashboard:newProject')}</h3>
            <form onSubmit={handleNewProject} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('dashboard:projectName')}</label>
                <input
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="My New Page"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewProjectModal(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium text-sm"
                >
                  {t('common:cancel')}
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
                >
                  {t('common:create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Load Page Modal */}
      {showLoadPageModal && (
        <LoadPageModal
          onClose={() => setShowLoadPageModal(false)}
          onSuccess={handleLoadPageSuccess}
        />
      )}
    </div>
  );
}
