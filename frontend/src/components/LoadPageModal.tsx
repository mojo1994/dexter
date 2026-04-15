import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Upload, X, FileArchive, AlertCircle, CheckCircle } from 'lucide-react';
import { uploadApi } from '../services/api';

interface LoadPageModalProps {
  onClose: () => void;
  onSuccess: (projectId: string, pageId: string) => void;
}

export default function LoadPageModal({ onClose, onSuccess }: LoadPageModalProps) {
  const { t } = useTranslation(['dashboard', 'common']);
  const [file, setFile] = useState<File | null>(null);
  const [projectName, setProjectName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) validateAndSetFile(droppedFile);
  };

  const validateAndSetFile = (f: File) => {
    setError('');
    if (!f.name.endsWith('.zip')) {
      setError('Only ZIP files are accepted. Please compress your project folder into a ZIP.');
      return;
    }
    if (f.size > 100 * 1024 * 1024) {
      setError('File too large. Maximum size is 100MB.');
      return;
    }
    setFile(f);
    if (!projectName) {
      setProjectName(f.name.replace('.zip', ''));
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError('');

    try {
      const { data } = await uploadApi.uploadProject(file, projectName || undefined);
      if (data.project && data.page) {
        onSuccess(data.project.id, data.page.id);
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || 'Upload failed. Please check your ZIP file contains an index.html.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">{t('dashboard:loadPage')}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        {/* Drag & Drop Zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
            dragOver ? 'border-blue-500 bg-blue-50' : file ? 'border-green-300 bg-green-50' : 'border-gray-300 hover:border-gray-400'
          }`}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".zip"
            onChange={(e) => e.target.files?.[0] && validateAndSetFile(e.target.files[0])}
            className="hidden"
          />

          {file ? (
            <div className="flex flex-col items-center gap-2">
              <CheckCircle size={32} className="text-green-500" />
              <p className="font-medium text-gray-900">{file.name}</p>
              <p className="text-sm text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
              <button
                onClick={(e) => { e.stopPropagation(); setFile(null); }}
                className="text-xs text-red-500 hover:text-red-700"
              >
                {t('common:delete')}
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <FileArchive size={32} className="text-gray-400" />
              <p className="font-medium text-gray-700">
                Drop your ZIP file here or click to browse
              </p>
              <p className="text-sm text-gray-400">
                ZIP must contain an index.html at the root. Max 100MB.
              </p>
            </div>
          )}
        </div>

        {/* Project Name */}
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            {t('dashboard:projectName')} <span className="text-gray-400">({t('clone:optional', { ns: 'clone' })})</span>
          </label>
          <input
            type="text"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            placeholder="My Project"
          />
        </div>

        {/* Error */}
        {error && (
          <div className="mt-3 flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium text-sm"
          >
            {t('common:cancel')}
          </button>
          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm disabled:opacity-50"
          >
            <Upload size={16} />
            {uploading ? t('common:loading') : t('common:upload')}
          </button>
        </div>
      </div>
    </div>
  );
}
