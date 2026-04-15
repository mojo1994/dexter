import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import grapesjs, { Editor as GrapesEditor } from 'grapesjs';
import 'grapesjs/dist/css/grapes.min.css';
import gjsPresetWebpage from 'grapesjs-preset-webpage';
import gjsStyleBg from 'grapesjs-style-bg';
import { pageApi, assetApi } from '../services/api';
import { useEditorStore } from '../store/editorStore';
import { useTranslation } from 'react-i18next';
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
  Image,
} from 'lucide-react';

/**
 * Register custom GrapesJS button component with href trait
 * This creates an <a> tag styled as a button, with editable href in the traits panel
 */
function registerCustomButtonComponent(editor: GrapesEditor) {
  // Register custom component type: button-link (an <a> styled as button with href trait)
  editor.Components.addType('button-link', {
    isComponent: (el: HTMLElement) => el.tagName === 'A' && el.classList.contains('btn-cta'),
    model: {
      defaults: {
        tagName: 'a',
        droppable: false,
        attributes: {
          class: 'btn-cta',
          href: '#',
          target: '_blank',
        },
        content: 'Click Here',
        traits: [
          {
            type: 'text',
            name: 'href',
            label: 'Link (URL)',
            placeholder: 'https://...',
          },
          {
            type: 'text',
            name: 'text',
            label: 'Button Text',
            changeProp: true,
          },
          {
            type: 'select',
            name: 'target',
            label: 'Open In',
            options: [
              { id: '_blank', label: 'New Tab' },
              { id: '_self', label: 'Same Tab' },
            ],
          },
        ],
        styles: `
          .btn-cta {
            display: inline-block;
            padding: 14px 32px;
            background: #2563EB;
            color: #fff;
            border-radius: 8px;
            text-decoration: none;
            font-weight: 600;
            font-size: 16px;
            text-align: center;
            cursor: pointer;
            transition: background 0.2s;
          }
          .btn-cta:hover {
            background: #1D4ED8;
          }
        `,
      },
      init() {
        // Sync 'text' trait with component content
        this.on('change:attributes:text', this.handleTextChange);
        const content = this.get('content');
        if (content) {
          this.set('text', content);
        }
      },
      handleTextChange() {
        const text = this.get('attributes')?.text || this.get('text');
        if (text) {
          this.components(text);
        }
      },
    },
  });
}

function registerCustomBlocks(editor: GrapesEditor) {
  const bm = editor.BlockManager;

  // CTA Button using custom button-link component type
  bm.add('cta-button', {
    label: 'CTA Button',
    category: 'Basic',
    content: { type: 'button-link', content: 'Buy Now' },
    attributes: { class: 'fa fa-link' },
  });

  bm.add('video-embed', {
    label: 'Video Embed',
    category: 'Media',
    content: `<div style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;max-width:100%;border-radius:8px;">
      <iframe style="position:absolute;top:0;left:0;width:100%;height:100%;border:none;" src="https://www.youtube.com/embed/dQw4w9WgXcQ" allowfullscreen></iframe>
    </div>`,
    attributes: { class: 'fa fa-youtube-play' },
  });

  bm.add('countdown-timer', {
    label: 'Countdown',
    category: 'Advanced',
    content: `<div data-gjs-type="default" style="display:flex;gap:16px;justify-content:center;padding:24px;background:#1F2937;border-radius:12px;">
      <div style="text-align:center;"><div style="font-size:36px;font-weight:700;color:#fff;">00</div><div style="font-size:12px;color:#9CA3AF;text-transform:uppercase;">Days</div></div>
      <div style="font-size:36px;font-weight:700;color:#fff;">:</div>
      <div style="text-align:center;"><div style="font-size:36px;font-weight:700;color:#fff;">00</div><div style="font-size:12px;color:#9CA3AF;text-transform:uppercase;">Hours</div></div>
      <div style="font-size:36px;font-weight:700;color:#fff;">:</div>
      <div style="text-align:center;"><div style="font-size:36px;font-weight:700;color:#fff;">00</div><div style="font-size:12px;color:#9CA3AF;text-transform:uppercase;">Min</div></div>
      <div style="font-size:36px;font-weight:700;color:#fff;">:</div>
      <div style="text-align:center;"><div style="font-size:36px;font-weight:700;color:#fff;">00</div><div style="font-size:12px;color:#9CA3AF;text-transform:uppercase;">Sec</div></div>
    </div>`,
    attributes: { class: 'fa fa-clock-o' },
  });

  bm.add('testimonial-card', {
    label: 'Testimonial',
    category: 'Advanced',
    content: `<div style="padding:24px;background:#fff;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,0.1);max-width:400px;margin:0 auto;">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
        <div style="width:48px;height:48px;border-radius:50%;background:#E5E7EB;"></div>
        <div><div style="font-weight:600;color:#1F2937;">John Doe</div><div style="font-size:14px;color:#6B7280;">Verified Buyer</div></div>
      </div>
      <p style="color:#374151;line-height:1.6;">"This product changed my life. I highly recommend it to anyone looking for results."</p>
      <div style="color:#F59E0B;margin-top:12px;">&#9733;&#9733;&#9733;&#9733;&#9733;</div>
    </div>`,
    attributes: { class: 'fa fa-quote-right' },
  });

  bm.add('pricing-card', {
    label: 'Pricing Card',
    category: 'Advanced',
    content: `<div style="padding:32px;background:#fff;border:2px solid #E5E7EB;border-radius:16px;text-align:center;max-width:320px;margin:0 auto;">
      <h3 style="font-size:20px;font-weight:600;color:#1F2937;margin-bottom:8px;">Pro Plan</h3>
      <div style="margin-bottom:24px;"><span style="font-size:48px;font-weight:700;color:#1F2937;">$49</span><span style="color:#6B7280;">/month</span></div>
      <ul style="list-style:none;padding:0;margin:0 0 24px;text-align:left;">
        <li style="padding:8px 0;border-bottom:1px solid #F3F4F6;color:#374151;">&#10003; Unlimited projects</li>
        <li style="padding:8px 0;border-bottom:1px solid #F3F4F6;color:#374151;">&#10003; Priority support</li>
        <li style="padding:8px 0;border-bottom:1px solid #F3F4F6;color:#374151;">&#10003; Custom domains</li>
        <li style="padding:8px 0;color:#374151;">&#10003; Analytics dashboard</li>
      </ul>
      <a href="#" style="display:block;padding:14px;background:#2563EB;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">Get Started</a>
    </div>`,
    attributes: { class: 'fa fa-tag' },
  });

  bm.add('hero-section', {
    label: 'Hero Section',
    category: 'Layout',
    content: `<section style="padding:80px 24px;text-align:center;background:linear-gradient(135deg,#1E3A5F,#2563EB);color:#fff;">
      <h1 style="font-size:48px;font-weight:700;margin-bottom:16px;">Transform Your Business</h1>
      <p style="font-size:20px;opacity:0.9;max-width:600px;margin:0 auto 32px;">Discover the tools and strategies that will take your sales to the next level.</p>
      <a href="#" style="display:inline-block;padding:16px 40px;background:#10B981;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;font-size:18px;">Start Free Trial</a>
    </section>`,
    attributes: { class: 'fa fa-header' },
  });

  bm.add('faq-section', {
    label: 'FAQ',
    category: 'Advanced',
    content: `<div style="max-width:640px;margin:0 auto;padding:40px 24px;">
      <h2 style="font-size:32px;font-weight:700;text-align:center;margin-bottom:32px;color:#1F2937;">Frequently Asked Questions</h2>
      <div style="border-bottom:1px solid #E5E7EB;padding:16px 0;">
        <h4 style="font-weight:600;color:#1F2937;margin-bottom:8px;">How does it work?</h4>
        <p style="color:#6B7280;line-height:1.6;">Simply sign up, choose your plan, and start building.</p>
      </div>
      <div style="border-bottom:1px solid #E5E7EB;padding:16px 0;">
        <h4 style="font-weight:600;color:#1F2937;margin-bottom:8px;">Can I cancel anytime?</h4>
        <p style="color:#6B7280;line-height:1.6;">Yes, you can cancel your subscription at any time.</p>
      </div>
      <div style="padding:16px 0;">
        <h4 style="font-weight:600;color:#1F2937;margin-bottom:8px;">Do you offer support?</h4>
        <p style="color:#6B7280;line-height:1.6;">We offer 24/7 support via chat and email.</p>
      </div>
    </div>`,
    attributes: { class: 'fa fa-question-circle' },
  });

  bm.add('social-proof', {
    label: 'Social Proof',
    category: 'Advanced',
    content: `<div style="display:flex;justify-content:center;align-items:center;gap:40px;padding:24px;background:#F9FAFB;border-top:1px solid #E5E7EB;border-bottom:1px solid #E5E7EB;">
      <div style="text-align:center;"><div style="font-size:28px;font-weight:700;color:#1F2937;">10K+</div><div style="font-size:14px;color:#6B7280;">Customers</div></div>
      <div style="text-align:center;"><div style="font-size:28px;font-weight:700;color:#1F2937;">4.9/5</div><div style="font-size:14px;color:#6B7280;">Rating</div></div>
      <div style="text-align:center;"><div style="font-size:28px;font-weight:700;color:#1F2937;">98%</div><div style="font-size:14px;color:#6B7280;">Satisfaction</div></div>
    </div>`,
    attributes: { class: 'fa fa-users' },
  });

  bm.add('contact-form', {
    label: 'Contact Form',
    category: 'Forms',
    content: `<form style="max-width:480px;margin:0 auto;padding:32px;background:#fff;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
      <h3 style="font-size:20px;font-weight:600;margin-bottom:24px;color:#1F2937;">Get in Touch</h3>
      <div style="margin-bottom:16px;"><label style="display:block;font-size:14px;font-weight:500;color:#374151;margin-bottom:4px;">Name</label><input type="text" placeholder="Your name" style="width:100%;padding:10px 14px;border:1px solid #D1D5DB;border-radius:8px;font-size:14px;box-sizing:border-box;" /></div>
      <div style="margin-bottom:16px;"><label style="display:block;font-size:14px;font-weight:500;color:#374151;margin-bottom:4px;">Email</label><input type="email" placeholder="your@email.com" style="width:100%;padding:10px 14px;border:1px solid #D1D5DB;border-radius:8px;font-size:14px;box-sizing:border-box;" /></div>
      <div style="margin-bottom:16px;"><label style="display:block;font-size:14px;font-weight:500;color:#374151;margin-bottom:4px;">Message</label><textarea placeholder="Your message" rows="4" style="width:100%;padding:10px 14px;border:1px solid #D1D5DB;border-radius:8px;font-size:14px;box-sizing:border-box;resize:vertical;"></textarea></div>
      <button type="submit" style="width:100%;padding:12px;background:#2563EB;color:#fff;border:none;border-radius:8px;font-weight:600;font-size:14px;cursor:pointer;">Send Message</button>
    </form>`,
    attributes: { class: 'fa fa-envelope' },
  });

  bm.add('divider', {
    label: 'Divider',
    category: 'Basic',
    content: '<hr style="border:none;border-top:1px solid #E5E7EB;margin:24px 0;" />',
    attributes: { class: 'fa fa-minus' },
  });

  bm.add('spacer', {
    label: 'Spacer',
    category: 'Basic',
    content: '<div style="height:48px;"></div>',
    attributes: { class: 'fa fa-arrows-v' },
  });
}

export default function EditorPage() {
  const { pageId } = useParams<{ pageId: string }>();
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('project') || '';
  const navigate = useNavigate();
  const { t, i18n } = useTranslation(['editor', 'common']);
  const editorRef = useRef<GrapesEditor | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [pageName, setPageName] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [showMediaManager, setShowMediaManager] = useState(false);
  const [mediaFiles, setMediaFiles] = useState<Array<{ url: string; name: string }>>([]);
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
        if (page.gjsData && Object.keys(page.gjsData).length > 0) {
          editor.loadProjectData(page.gjsData);
        } else {
          editor.setComponents(page.html || '');
          editor.setStyle(page.css || '');
        }
        setDirty(false);
      }
    } catch (err) {
      toast.error(t('common:error'));
      console.error(err);
    }
  }, [pageId, projectId, setCurrentPage, setDirty, t]);

  useEffect(() => {
    if (!containerRef.current || editorRef.current) return;

    const editor = grapesjs.init({
      container: containerRef.current,
      height: '100%',
      width: 'auto',
      fromElement: false,
      storageManager: false,
      plugins: [gjsPresetWebpage, gjsStyleBg],
      pluginsOpts: {
        [gjsPresetWebpage as unknown as string]: {
          blocksBasicOpts: { flexGrid: true },
          navbarOpts: false,
          countdownOpts: false,
        },
        [gjsStyleBg as unknown as string]: {},
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
      blockManager: { appendTo: '#blocks-panel' },
      layerManager: { appendTo: '#layers-panel' },
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
          { name: 'Dimension', open: false, buildProps: ['width', 'height', 'max-width', 'min-height', 'margin', 'padding'] },
          { name: 'Typography', open: false, buildProps: ['font-family', 'font-size', 'font-weight', 'letter-spacing', 'color', 'line-height', 'text-align', 'text-decoration', 'text-shadow'] },
          { name: 'Decorations', open: false, buildProps: ['opacity', 'border-radius', 'border', 'box-shadow', 'background', 'background-color'] },
          { name: 'Extra', open: false, buildProps: ['transition', 'perspective', 'transform'] },
        ],
      },
      traitManager: { appendTo: '#traits-panel' },
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

    registerCustomButtonComponent(editor);
    registerCustomBlocks(editor);

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

  useEffect(() => {
    if (editorRef.current && pageId) {
      loadPage();
    }
  }, [pageId, loadPage]);

  // GrapesJS i18n sync: update editor UI labels when dashboard language changes
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const langMap: Record<string, string> = {
      'pt-BR': 'pt',
      'en-US': 'en',
      'es': 'es',
      'fr': 'fr',
      'de': 'de',
    };

    const handleLanguageChanged = (lng: string) => {
      const gjsLang = langMap[lng] || 'en';
      try {
        editor.I18n.setLocale(gjsLang);
      } catch {
        // GrapesJS may not have translations for this locale, which is fine
      }
    };

    i18n.on('languageChanged', handleLanguageChanged);
    // Set initial locale
    handleLanguageChanged(i18n.language);

    return () => {
      i18n.off('languageChanged', handleLanguageChanged);
    };
  }, [i18n]);

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
      toast.success(t('editor:saved'));
    } catch {
      toast.error(t('editor:saveFailed'));
    } finally {
      setSaving(false);
    }
  }, [pageId, pageName, setDirty, setSaving, t]);

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
      toast.success(t('editor:saved'));
    } catch {
      toast.error(t('editor:saveFailed'));
    }
  };

  const handleLoadVersions = async () => {
    if (!pageId) return;
    try {
      const { data } = await pageApi.getVersions(pageId);
      setVersions(data.versions);
      setShowVersions(true);
    } catch {
      toast.error(t('common:error'));
    }
  };

  const handleRestoreVersion = async (versionId: string) => {
    if (!pageId) return;
    try {
      await pageApi.restoreVersion(pageId, versionId);
      toast.success(t('common:success'));
      setShowVersions(false);
      loadPage();
    } catch {
      toast.error(t('common:error'));
    }
  };

  const handleOpenMediaManager = async () => {
    if (!projectId) return;
    try {
      const { data } = await assetApi.getAll(projectId);
      const apiBase = import.meta.env.VITE_API_URL?.replace('/api', '') || '';
      setMediaFiles((data.assets || []).map((a: { url: string; original_name: string }) => ({
        url: `${apiBase}${a.url}`,
        name: a.original_name,
      })));
      setShowMediaManager(true);
    } catch {
      setShowMediaManager(true);
    }
  };

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !projectId) return;
    try {
      const { data } = await assetApi.upload(projectId, file);
      const apiBase = import.meta.env.VITE_API_URL?.replace('/api', '') || '';
      const newAsset = { url: `${apiBase}${data.asset.url}`, name: data.asset.original_name };
      setMediaFiles(prev => [newAsset, ...prev]);
      if (editorRef.current) {
        editorRef.current.AssetManager.add({ src: newAsset.url });
      }
      toast.success(t('common:success'));
    } catch {
      toast.error(t('common:error'));
    }
  };

  const insertMediaToCanvas = (url: string) => {
    if (!editorRef.current) return;
    editorRef.current.addComponents(`<img src="${url}" style="max-width:100%;height:auto;" />`);
    setShowMediaManager(false);
  };

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
          <button onClick={() => navigate('/dashboard')} className="text-gray-400 hover:text-white transition-colors" title={t('editor:backToDashboard')}>
            <ArrowLeft size={18} />
          </button>
          <div className="h-5 w-px bg-gray-700" />
          <input
            type="text"
            value={pageName}
            onChange={(e) => { setPageName(e.target.value); setDirty(true); }}
            className="bg-transparent text-white text-sm font-medium border-none outline-none focus:ring-0 w-48"
            placeholder={t('editor:pageName')}
          />
          {isDirty && <span className="text-xs text-yellow-400">{t('common:unsavedChanges')}</span>}
        </div>

        <div className="flex items-center gap-1">
          <button onClick={handleUndo} className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors" title={t('editor:undo')}>
            <Undo2 size={16} />
          </button>
          <button onClick={handleRedo} className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors" title={t('editor:redo')}>
            <Redo2 size={16} />
          </button>
          <div className="h-5 w-px bg-gray-700 mx-1" />
          <button onClick={() => handleDeviceChange('desktop')} className={`p-2 rounded transition-colors ${device === 'desktop' ? 'text-blue-400 bg-gray-700' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`} title={t('editor:desktop')}>
            <Monitor size={16} />
          </button>
          <button onClick={() => handleDeviceChange('tablet')} className={`p-2 rounded transition-colors ${device === 'tablet' ? 'text-blue-400 bg-gray-700' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`} title={t('editor:tablet')}>
            <Tablet size={16} />
          </button>
          <button onClick={() => handleDeviceChange('mobile')} className={`p-2 rounded transition-colors ${device === 'mobile' ? 'text-blue-400 bg-gray-700' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`} title={t('editor:mobile')}>
            <Smartphone size={16} />
          </button>
          <div className="h-5 w-px bg-gray-700 mx-1" />
          <button onClick={handleToggleCode} className={`p-2 rounded transition-colors ${showCode ? 'text-blue-400 bg-gray-700' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`} title={t('editor:codeEditor')}>
            <Code size={16} />
          </button>
          <button onClick={handlePreview} className={`p-2 rounded transition-colors ${showPreview ? 'text-blue-400 bg-gray-700' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`} title={t('editor:preview')}>
            <Eye size={16} />
          </button>
          <button onClick={handleOpenMediaManager} className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors" title={t('editor:media')}>
            <Image size={16} />
          </button>
          <button onClick={handleLoadVersions} className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors" title={t('editor:versionHistory')}>
            <History size={16} />
          </button>
          <button onClick={handleSaveVersion} className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors" title={t('editor:saveVersion')}>
            <Layers size={16} />
          </button>
          <div className="h-5 w-px bg-gray-700 mx-1" />
          <button
            onClick={() => {
              const pid = searchParams.get('project');
              if (pid) {
                const url = `${import.meta.env.VITE_API_URL?.replace('/api', '')}/api/projects/${pid}/export`;
                window.open(url, '_blank');
              }
            }}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
            title={t('editor:exportZip')}
          >
            <Download size={16} />
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="ml-2 flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50"
          >
            <Save size={14} />
            {isSaving ? t('editor:saving') : t('editor:save')}
          </button>
        </div>
      </div>

      {/* Editor Body */}
      <div className="flex-1 flex overflow-hidden">
        <div className="w-60 bg-gray-800 border-r border-gray-700 overflow-y-auto shrink-0">
          <div className="p-3 border-b border-gray-700">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{t('editor:components')}</h3>
          </div>
          <div id="blocks-panel" className="p-2" />
        </div>
        <div className="flex-1 overflow-hidden">
          <div ref={containerRef} className="h-full" />
        </div>
        <div className="w-72 bg-gray-800 border-l border-gray-700 overflow-y-auto shrink-0">
          <div className="border-b border-gray-700">
            <div className="p-3"><h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{t('editor:styles')}</h3></div>
            <div id="styles-panel" className="px-2 pb-2" />
          </div>
          <div className="border-b border-gray-700">
            <div className="p-3"><h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{t('editor:traits')}</h3></div>
            <div id="traits-panel" className="px-2 pb-2" />
          </div>
          <div>
            <div className="p-3"><h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{t('editor:layers')}</h3></div>
            <div id="layers-panel" className="px-2 pb-2" />
          </div>
        </div>
      </div>

      {/* Versions Modal */}
      {showVersions && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('editor:versionHistory')}</h3>
            {versions.length === 0 ? (
              <p className="text-gray-500 text-sm">{t('common:noResults')}</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {versions.map((v) => (
                  <div key={v.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <span className="text-sm font-medium text-gray-900">Version {v.version}</span>
                      <p className="text-xs text-gray-400">{new Date(v.created_at).toLocaleString()}</p>
                    </div>
                    <button onClick={() => handleRestoreVersion(v.id)} className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                      {t('editor:restoreVersion')}
                    </button>
                  </div>
                ))}
              </div>
            )}
            <button onClick={() => setShowVersions(false)} className="mt-4 w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium">
              {t('common:close')}
            </button>
          </div>
        </div>
      )}

      {/* Media Manager Modal */}
      {showMediaManager && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">{t('editor:media')}</h3>
              <button onClick={() => setShowMediaManager(false)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>
            <div className="mb-4">
              <label className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 transition-colors">
                <Image size={20} className="text-gray-400" />
                <span className="text-sm text-gray-600">{t('common:upload')}</span>
                <input type="file" accept="image/*,video/*" onChange={handleMediaUpload} className="hidden" />
              </label>
            </div>
            {mediaFiles.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-8">{t('common:noResults')}</p>
            ) : (
              <div className="grid grid-cols-4 gap-3 max-h-80 overflow-y-auto">
                {mediaFiles.map((media, idx) => (
                  <button key={idx} onClick={() => insertMediaToCanvas(media.url)} className="group relative aspect-square bg-gray-100 rounded-lg overflow-hidden hover:ring-2 hover:ring-blue-500 transition-all">
                    <img src={media.url} alt={media.name} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                      <span className="text-white text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity">Insert</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
            <button onClick={() => setShowMediaManager(false)} className="mt-4 w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium">
              {t('common:close')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
