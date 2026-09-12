import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Upload, Folder, Link as LinkIcon, AlertCircle, CheckCircle2, Loader2, ArrowRight } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { StubBlock } from '../ui/StubBlock';
import { cn } from '../../lib/cn';
import { apiUrl } from '../../config/api';

interface LocalPaperItem {
  filename: string;
  absolute_path: string;
  size_bytes: number;
  modified_at: string;
  already_analyzed: boolean;
  analysis_id?: string | null;
}

export function AddPaperModal({
  isOpen,
  onClose,
  onUpload,
  onImportSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (file: File) => Promise<void>;
  onImportSuccess?: () => void;
}) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'upload' | 'folder' | 'link'>('upload');
  const [folderPath, setFolderPath] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [importingPath, setImportingPath] = useState<string | null>(null);
  const [scannedPapers, setScannedPapers] = useState<LocalPaperItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    onDrop: async (acceptedFiles) => {
      if (acceptedFiles.length === 0) return;
      setError(null);
      setIsUploading(true);
      try {
        await onUpload(acceptedFiles[0]);
        onClose();
      } catch (err: any) {
        setError(err?.message || 'Failed to upload paper');
      } finally {
        setIsUploading(false);
      }
    },
  });

  const handleScanFolder = async () => {
    if (!folderPath.trim()) return;
    setError(null);
    setIsScanning(true);
    try {
      const res = await fetch(apiUrl(`/api/v1/local-papers?path=${encodeURIComponent(folderPath.trim())}`));
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || 'Failed to scan directory');
      }
      const data: LocalPaperItem[] = await res.json();
      setScannedPapers(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to scan folder');
      setScannedPapers(null);
    } finally {
      setIsScanning(false);
    }
  };

  const handleImportLocalPaper = async (paper: LocalPaperItem) => {
    setError(null);
    setImportingPath(paper.absolute_path);
    try {
      const res = await fetch(apiUrl('/api/v1/local-papers/open'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ absolute_path: paper.absolute_path }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || 'Failed to import local paper');
      }
      const data = await res.json();
      onImportSuccess?.();
      onClose();
      if (data.analysis_id) {
        navigate(`/paper/${data.analysis_id}`);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to import paper');
    } finally {
      setImportingPath(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div
        className="w-full max-w-lg rounded-xl border border-[--border-subtle] bg-[--surface] p-6 shadow-lg max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[--border-subtle] pb-4">
          <h2 className="text-lg font-bold text-[--text-primary]">Add Paper to Library</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-[--text-secondary] hover:bg-[--surface-hover]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="mt-4 flex border-b border-[--border-subtle]">
          <button
            type="button"
            onClick={() => { setActiveTab('upload'); setError(null); }}
            className={cn(
              'flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors',
              activeTab === 'upload'
                ? 'border-[--accent] text-[--text-primary]'
                : 'border-transparent text-[--text-secondary] hover:text-[--text-primary]'
            )}
          >
            <Upload className="h-4 w-4" />
            <span>Upload PDF</span>
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('folder'); setError(null); }}
            className={cn(
              'flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors',
              activeTab === 'folder'
                ? 'border-[--accent] text-[--text-primary]'
                : 'border-transparent text-[--text-secondary] hover:text-[--text-primary]'
            )}
          >
            <Folder className="h-4 w-4" />
            <span>Local Folder</span>
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('link'); setError(null); }}
            className={cn(
              'flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors',
              activeTab === 'link'
                ? 'border-[--accent] text-[--text-primary]'
                : 'border-transparent text-[--text-secondary] hover:text-[--text-primary]'
            )}
          >
            <LinkIcon className="h-4 w-4" />
            <span>ArXiv / DOI</span>
          </button>
        </div>

        <div className="mt-5 flex-1 overflow-y-auto pr-1">
          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-lg bg-[--trust-failing-wash] p-3 text-xs font-medium text-[--trust-failing-text]">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {activeTab === 'upload' && (
            <div
              {...getRootProps()}
              className={cn(
                'flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition-colors cursor-pointer',
                isDragActive
                  ? 'border-[--accent] bg-[--accent-subtle]'
                  : 'border-[--border-strong] bg-[--surface-sunken] hover:border-[--border-accent]'
              )}
            >
              <input {...getInputProps()} />
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[--surface] shadow-xs">
                <Upload className="h-6 w-6 text-[--text-accent]" />
              </div>
              <p className="mt-3 text-sm font-semibold text-[--text-primary]">
                {isUploading ? 'Uploading & parsing paper...' : isDragActive ? 'Drop PDF here...' : 'Click or drag PDF paper to upload'}
              </p>
              <p className="mt-1 text-xs text-[--text-secondary]">
                Supports single PDF files up to 50MB
              </p>
            </div>
          )}

          {activeTab === 'folder' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[--text-secondary] mb-1.5">
                  Folder Path on Laptop
                </label>
                <div className="flex gap-2">
                  <Input
                    placeholder="/Users/name/Downloads/Papers"
                    value={folderPath}
                    onChange={(e) => setFolderPath(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleScanFolder();
                      }
                    }}
                    className="flex-1"
                  />
                  <Button
                    variant="primary"
                    size="md"
                    onClick={handleScanFolder}
                    disabled={!folderPath.trim() || isScanning}
                  >
                    {isScanning ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Scanning...</span>
                      </>
                    ) : (
                      <span>Scan</span>
                    )}
                  </Button>
                </div>
              </div>

              {scannedPapers && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-medium text-[--text-secondary]">
                    <span>Found {scannedPapers.length} PDF paper{scannedPapers.length === 1 ? '' : 's'}</span>
                  </div>

                  {scannedPapers.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-[--border-subtle] p-4 text-center text-xs text-[--text-disabled]">
                      No PDF files found in this folder.
                    </p>
                  ) : (
                    <div className="max-h-60 space-y-1.5 overflow-y-auto divide-y divide-[--border-subtle] rounded-lg border border-[--border-subtle] bg-[--surface-sunken]/30 p-2">
                      {scannedPapers.map((paper) => (
                        <div
                          key={paper.absolute_path}
                          className="flex items-center justify-between gap-3 pt-2 first:pt-0"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-medium text-[--text-primary]" title={paper.filename}>
                              {paper.filename}
                            </p>
                            <p className="text-[10px] text-[--text-secondary]">
                              {(paper.size_bytes / (1024 * 1024)).toFixed(1)} MB
                            </p>
                          </div>

                          <div className="shrink-0">
                            {paper.already_analyzed ? (
                              <button
                                type="button"
                                onClick={() => {
                                  onClose();
                                  if (paper.analysis_id) navigate(`/paper/${paper.analysis_id}`);
                                }}
                                className="flex items-center gap-1 text-xs font-medium text-[--text-secondary] hover:text-[--text-primary]"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5 text-[--trust-strong-text]" />
                                <span>In library</span>
                                <ArrowRight className="h-3 w-3" />
                              </button>
                            ) : (
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => handleImportLocalPaper(paper)}
                                disabled={importingPath === paper.absolute_path}
                              >
                                {importingPath === paper.absolute_path ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <span>Import</span>
                                )}
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'link' && (
            <StubBlock title="Direct ArXiv & DOI Ingestion">
              ArXiv, PubMed, and bioRxiv link parsing will be enabled in Phase 2. Currently, please upload PDF files directly.
            </StubBlock>
          )}
        </div>
      </div>
    </div>
  );
}
