import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import grapesjs, { Editor as GrapesEditor } from 'grapesjs';
import 'grapesjs/dist/css/grapes.min.css';
import gjsPresetWebpage from 'grapesjs-preset-webpage';
import { pageApi, assetApi } from '../services/api';
import { useEditorStore } from '../store/editorStore';
import toast from 'react-hot-toast';
import {
  Save,
  Undo2,
  Redo2,
  Monitor,
  Tablet,
  Smartphone,
  Code,
  Eye,
  ArrowLeft,
  Download,
  Layers,
  History,
} from 'lucide-react';

export default function EditorPage() {
  const { pageId } = useParams<{ pageId: string }>();
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('project') || '';
  const navigate = useNavigate();
  const editorRef = useRef<GrapesEditor | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [pageName, setPageName] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [versions, setVersions] = useState<Array<{ id: string; version: number; created_at: string }>>([]);
  const { device, setDevice, isDirty, setDirty, isSaving, setSaving, setCurrentPage, showCode, toggleCode } =
    useEditorStore();

  const loadPage = useCallback(async () => {
    if (!pageId) return;

    try {
      const { data } = await pageApi.getById(pageId);
      const page = data.page;
      setPageName(page.name);
      setCurrentPage(pageId, projectId);

      if (editorRef.current) {
        const editor = editorRef.current;

        // Load GrapeJS data if available, otherwise use raw HTML/CSS
        if (page.gjsData && Object.keys(page.gjsData).length > 0) {
          editor.loadProjectData(page.gjsData);
        } else {
          editor.setComponents(page.html || '');
          editor.setStyle(page.css || '');
        }

        setDirty(false);
      }
    } catch (err) {
      toast.error('Failed to load page');
      console.error(err);
    }
  }, [pageId, projectId, setCurrentPage, setDirty]);

  useEffect(() => {
    if (!containerRef.current || editorRef.current) return;

    const editor = grapesjs.init({
      container: containerRef.current,
      height: '100%',
      width: 'auto',
      fromElement: false,
      storageManager: false,
      plugins: [gjsPresetWebpage],
      pluginsOpts: {
        [gjsPresetWebpage as unknown as string]: {
          blocksBasicOpts: { flexGrid: true },
          navbarOpts: false,
          countdownOpts: false,
        },
      },
      canvas: {
        styles: [
          'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap',
        ],
      },
      deviceManager: {
        devices: [
          { name: 'Desktop', width: '' },
          { name: 'Tablet', width: '768px', widthMedia: '992px' },
          { name: 'Mobile', width: '320px', widthMedia: '480px' },
        ],
      },
      panels: { defaults: [] },
      blockManager: {
        appendTo: '#blocks-panel',
      },
      layerManager: {
        appendTo: '#layers-panel',
      },
      styleManager: {
        appendTo: '#styles-panel',
        sectors: [
          {
            name: 'General',
            buildProps: ['float', 'display', 'position', 'top', 'right', 'left', 'bottom'],
            properties: [
              { name: 'Alignment', property: 'float', type: 'radio', defaults: 'none', list: [
                { id: 'float-none', value: 'none', className: 'fa fa-times' },
                { id: 'float-left', value: 'left', className: 'fa fa-align-left' },
                { id: 'float-right', value: 'right', className: 'fa fa-align-right' },
              ]},
            ],
          },
          {
            name: 'Dimension',
            open: false,
            buildProps: ['width', 'height', 'max-width', 'min-height', 'margin', 'padding'],
          },
          {
            name: 'Typography',
            open: false,
            buildProps: ['font-family', 'font-size', 'font-weight', 'letter-spacing', 'color', 'line-height', 'text-align', 'text-decoration', 'text-shadow'],
          },
          {
            name: 'Decorations',
            open: false,
            buildProps: ['opacity', 'border-radius', 'border', 'box-shadow', 'background', 'background-color'],
          },
          {
            name: 'Extra',
            open: false,
            buildProps: ['transition', 'perspective', 'transform'],
          },
        ],
      },
      traitManager: {
        appendTo: '#traits-panel',
      },
      assetManager: {
        upload: false,
        assets: [],
        uploadFile: async (e: Event) => {
          const target = e.target as HTMLInputElement;
          const files = target.files;
          if (!files || !projectId) return;
          try {
            const { data } = await assetApi.upload(projectId, files[0]);
            const apiBase = import.meta.env.VITE_API_URL?.replace('/api', '') || '';
            editor.AssetManager.add({ src: `${apiBase}${data.asset.url}` });
          } catch {
            toast.error('Failed to upload asset');
          }
        },
      },
    });

    // Track changes
    editor.on('change:changesCount', () => {
      setDirty(true);
    });

    editorRef.current = editor;

    return () => {
      if (editorRef.current) {
        editorRef.current.destroy();
        editorRef.current = null;
      }
    };
  }, [projectId, setDirty]);

  // Load page data after editor is ready
  useEffect(() => {
    if (editorRef.current && pageId) {
      loadPage();
    }
  }, [pageId, loadPage]);

  const handleSave = useCallback(async () => {
    if (!editorRef.current || !pageId) return;

    setSaving(true);
    try {
      const editor = editorRef.current;
      const html = editor.getHtml();
      const css = editor.getCss();
      const gjsData = editor.getProjectData();

      await pageApi.update(pageId, { html, css, gjsData, name: pageName });
      setDirty(false);
      toast.success('Saved!');
    } catch {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  }, [pageId, pageName, setDirty, setSaving]);

  const handleSaveRef = useRef(handleSave);
  useEffect(() => {
    handleSaveRef.current = handleSave;
  }, [handleSave]);

  const handleDeviceChange = (newDevice: 'desktop' | 'tablet' | 'mobile') => {
    setDevice(newDevice);
    if (!editorRef.current) return;

    const deviceMap = { desktop: 'Desktop', tablet: 'Tablet', mobile: 'Mobile' };
    editorRef.current.setDevice(deviceMap[newDevice]);
  };

  const handleUndo = () => editorRef.current?.UndoManager.undo();
  const handleRedo = () => editorRef.current?.UndoManager.redo();

  const handleToggleCode = () => {
    toggleCode();
    if (editorRef.current) {
      const openCode = editorRef.current.Commands.isActive('open-code');
      if (openCode) {
        editorRef.current.Commands.stop('open-code');
      } else {
        editorRef.current.Commands.run('open-code');
      }
    }
  };

  const handlePreview = () => {
    setShowPreview(!showPreview);
    if (editorRef.current) {
      if (!showPreview) {
        editorRef.current.Commands.run('preview');
      } else {
        editorRef.current.Commands.stop('preview');
      }
    }
  };

  const handleSaveVersion = async () => {
    if (!pageId) return;
    try {
      await pageApi.saveVersion(pageId);
      toast.success('Version saved!');
    } catch {
      toast.error('Failed to save version');
    }
  };

  const handleLoadVersions = async () => {
    if (!pageId) return;
    try {
      const { data } = await pageApi.getVersions(pageId);
      setVersions(data.versions);
      setShowVersions(true);
    } catch {
      toast.error('Failed to load versions');
    }
  };

  const handleRestoreVersion = async (versionId: string) => {
    if (!pageId) return;
    try {
      await pageApi.restoreVersion(pageId, versionId);
      toast.success('Version restored!');
      setShowVersions(false);
      loadPage();
    } catch {
      toast.error('Failed to restore version');
    }
  };

  // Auto-save every 30 seconds using ref to avoid stale closure
  useEffect(() => {
    const interval = setInterval(() => {
      if (isDirty && !isSaving) {
        handleSaveRef.current();
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [isDirty, isSaving]);

  return (
    <div className="h-screen flex flex-col bg-gray-900">
      {/* Top Toolbar */}
      <div className="h-12 bg-gray-800 border-b border-gray-700 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/dashboard')}
            className="text-gray-400 hover:text-white transition-colors"
            title="Back to Dashboard"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="h-5 w-px bg-gray-700" />
          <input
            type="text"
            value={pageName}
            onChange={(e) => { setPageName(e.target.value); setDirty(true); }}
            className="bg-transparent text-white text-sm font-medium border-none outline-none focus:ring-0 w-48"
            placeholder="Page name"
          />
          {isDirty && <span className="text-xs text-yellow-400">Unsaved</span>}
        </div>

        <div className="flex items-center gap-1">
          <button onClick={handleUndo} className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors" title="Undo">
            <Undo2 size={16} />
          </button>
          <button onClick={handleRedo} className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors" title="Redo">
            <Redo2 size={16} />
          </button>

          <div className="h-5 w-px bg-gray-700 mx-1" />

          <button
            onClick={() => handleDeviceChange('desktop')}
            className={`p-2 rounded transition-colors ${device === 'desktop' ? 'text-blue-400 bg-gray-700' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}
            title="Desktop"
          >
            <Monitor size={16} />
          </button>
          <button
            onClick={() => handleDeviceChange('tablet')}
            className={`p-2 rounded transition-colors ${device === 'tablet' ? 'text-blue-400 bg-gray-700' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}
            title="Tablet"
          >
            <Tablet size={16} />
          </button>
          <button
            onClick={() => handleDeviceChange('mobile')}
            className={`p-2 rounded transition-colors ${device === 'mobile' ? 'text-blue-400 bg-gray-700' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}
            title="Mobile"
          >
            <Smartphone size={16} />
          </button>

          <div className="h-5 w-px bg-gray-700 mx-1" />

          <button onClick={handleToggleCode} className={`p-2 rounded transition-colors ${showCode ? 'text-blue-400 bg-gray-700' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`} title="Code">
            <Code size={16} />
          </button>
          <button onClick={handlePreview} className={`p-2 rounded transition-colors ${showPreview ? 'text-blue-400 bg-gray-700' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`} title="Preview">
            <Eye size={16} />
          </button>
          <button onClick={handleLoadVersions} className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors" title="Versions">
            <History size={16} />
          </button>
          <button onClick={handleSaveVersion} className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors" title="Save Version">
            <Layers size={16} />
          </button>

          <div className="h-5 w-px bg-gray-700 mx-1" />

          <button
            onClick={() => {
              const projectId = searchParams.get('project');
              if (projectId) {
                const url = `${import.meta.env.VITE_API_URL?.replace('/api', '')}/api/projects/${projectId}/export`;
                window.open(url, '_blank');
              }
            }}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
            title="Export ZIP"
          >
            <Download size={16} />
          </button>

          <button
            onClick={handleSave}
            disabled={isSaving}
            className="ml-2 flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50"
          >
            <Save size={14} />
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Editor Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Blocks */}
        <div className="w-60 bg-gray-800 border-r border-gray-700 overflow-y-auto shrink-0">
          <div className="p-3 border-b border-gray-700">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Components</h3>
          </div>
          <div id="blocks-panel" className="p-2" />
        </div>

        {/* Canvas */}
        <div className="flex-1 overflow-hidden">
          <div ref={containerRef} className="h-full" />
        </div>

        {/* Right Sidebar - Properties */}
        <div className="w-72 bg-gray-800 border-l border-gray-700 overflow-y-auto shrink-0">
          <div className="border-b border-gray-700">
            <div className="p-3">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Styles</h3>
            </div>
            <div id="styles-panel" className="px-2 pb-2" />
          </div>
          <div className="border-b border-gray-700">
            <div className="p-3">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Settings</h3>
            </div>
            <div id="traits-panel" className="px-2 pb-2" />
          </div>
          <div>
            <div className="p-3">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Layers</h3>
            </div>
            <div id="layers-panel" className="px-2 pb-2" />
          </div>
        </div>
      </div>

      {/* Versions Modal */}
      {showVersions && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Version History</h3>
            {versions.length === 0 ? (
              <p className="text-gray-500 text-sm">No saved versions yet</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {versions.map((v) => (
                  <div key={v.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <span className="text-sm font-medium text-gray-900">Version {v.version}</span>
                      <p className="text-xs text-gray-400">{new Date(v.created_at).toLocaleString()}</p>
                    </div>
                    <button
                      onClick={() => handleRestoreVersion(v.id)}
                      className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Restore
                    </button>
                  </div>
                ))}
              </div>
            )}
            <button
              onClick={() => setShowVersions(false)}
              className="mt-4 w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
