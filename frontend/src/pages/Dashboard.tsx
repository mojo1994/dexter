import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { projectApi, cloneApi } from '../services/api';
import { Plus, Globe, Trash2, ExternalLink, Download, LogOut, FolderOpen } from 'lucide-react';
import toast from 'react-hot-toast';

interface Project {
  id: string;
  name: string;
  url_original: string | null;
  status: string;
  thumbnail: string | null;
  created_at: string;
  updated_at: string;
}

export default function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCloneModal, setShowCloneModal] = useState(false);
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [cloneUrl, setCloneUrl] = useState('');
  const [cloneName, setCloneName] = useState('');
  const [newProjectName, setNewProjectName] = useState('');
  const [cloning, setCloning] = useState(false);
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      const { data } = await projectApi.getAll();
      setProjects(data.projects);
    } catch (err) {
      toast.error('Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  const handleClone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cloneUrl) return;

    setCloning(true);
    try {
      const { data } = await cloneApi.clone({ url: cloneUrl, name: cloneName || undefined });
      toast.success('Cloning started! This may take a moment...');
      setShowCloneModal(false);
      setCloneUrl('');
      setCloneName('');

      // Poll for completion
      const pollInterval = setInterval(async () => {
        try {
          const { data: status } = await cloneApi.getStatus(data.project.id);
          if (status.ready && status.pages.length > 0) {
            clearInterval(pollInterval);
            toast.success('Page cloned successfully!');
            navigate(`/editor/${status.pages[0].id}?project=${data.project.id}`);
          } else if (status.project.status === 'failed') {
            clearInterval(pollInterval);
            toast.error('Cloning failed. Please try again.');
            loadProjects();
          }
        } catch {
          clearInterval(pollInterval);
        }
      }, 2000);

      // Timeout after 60s
      setTimeout(() => {
        clearInterval(pollInterval);
        loadProjects();
      }, 60000);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      toast.error(error.response?.data?.error || 'Clone failed');
    } finally {
      setCloning(false);
    }
  };

  const handleNewProject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data } = await projectApi.create({ name: newProjectName || 'Untitled Project' });
      toast.success('Project created!');
      setShowNewProjectModal(false);
      setNewProjectName('');
      navigate(`/editor/${data.page.id}?project=${data.project.id}`);
    } catch {
      toast.error('Failed to create project');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this project?')) return;
    try {
      await projectApi.delete(id);
      toast.success('Project deleted');
      setProjects(projects.filter((p) => p.id !== id));
    } catch {
      toast.error('Failed to delete project');
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
      toast.success('Export downloaded!');
    } catch {
      toast.error('Export failed');
    }
  };

  const openProject = async (projectId: string) => {
    try {
      const { data } = await projectApi.getById(projectId);
      if (data.pages && data.pages.length > 0) {
        navigate(`/editor/${data.pages[0].id}?project=${projectId}`);
      } else {
        toast.error('No pages found in this project');
      }
    } catch {
      toast.error('Failed to open project');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <h1 className="text-xl font-bold text-gray-900">
              <span className="text-blue-600">DEX</span>TER
            </h1>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-500">{user?.email}</span>
              <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full font-medium uppercase">
                {user?.plan}
              </span>
              <button
                onClick={logout}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                title="Sign out"
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
            <h2 className="text-2xl font-semibold text-gray-900">My Projects</h2>
            <p className="text-gray-500 mt-1">{projects.length} project{projects.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowNewProjectModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium text-sm"
            >
              <Plus size={16} />
              New Project
            </button>
            <button
              onClick={() => setShowCloneModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
            >
              <Globe size={16} />
              Clone Page
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
            <h3 className="text-lg font-medium text-gray-900 mb-2">No projects yet</h3>
            <p className="text-gray-500 mb-6">Clone a page or create a new project to get started</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setShowNewProjectModal(true)}
                className="px-4 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium text-sm"
              >
                New Project
              </button>
              <button
                onClick={() => setShowCloneModal(true)}
                className="px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
              >
                Clone a Page
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
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ml-2 ${
                        project.status === 'cloned'
                          ? 'bg-green-100 text-green-700'
                          : project.status === 'cloning'
                          ? 'bg-yellow-100 text-yellow-700'
                          : project.status === 'failed'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {project.status}
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
                      Edit
                    </button>
                    <button
                      onClick={() => handleExport(project.id, project.name)}
                      className="flex items-center justify-center p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Export"
                    >
                      <Download size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(project.id)}
                      className="flex items-center justify-center p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete"
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

      {/* Clone Modal */}
      {showCloneModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Clone a Page</h3>
            <form onSubmit={handleClone} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Page URL</label>
                <input
                  type="url"
                  value={cloneUrl}
                  onChange={(e) => setCloneUrl(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="https://example.com/sales-page"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Project Name <span className="text-gray-400">(optional)</span>
                </label>
                <input
                  type="text"
                  value={cloneName}
                  onChange={(e) => setCloneName(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="My Sales Page"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCloneModal(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={cloning}
                  className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm disabled:opacity-50"
                >
                  {cloning ? 'Cloning...' : 'Start Cloning'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Project Modal */}
      {showNewProjectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">New Project</h3>
            <form onSubmit={handleNewProject} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Project Name</label>
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
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
