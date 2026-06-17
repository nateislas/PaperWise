import React, { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

interface UploadAreaProps {
  onUploadSuccess?: () => void;
}

const UploadArea: React.FC<UploadAreaProps> = ({ onUploadSuccess }) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const startAnalysis = useCallback(async (fileId: string, filename: string) => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:8081'}/api/v1/analyze/async`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          file_id: fileId,
          analysis_type: 'comprehensive'
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to start analysis');
      }

      const result = await response.json();
      
      // Navigate to analysis page
      navigate(`/analysis/${result.job_id}`);
      
      // Call success callback
      if (onUploadSuccess) {
        onUploadSuccess();
      }

    } catch (err) {
      setError('Failed to start analysis');
    }
  }, [navigate, onUploadSuccess]);

  const handleFileUpload = useCallback(async (file: File) => {
    // Validate file type
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('Only PDF files are supported');
      return;
    }

    // Validate file size (50MB limit)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      setError('File size must be less than 50MB');
      return;
    }

    setIsUploading(true);
    setError(null);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:8081'}/api/v1/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const result = await response.json();
      setUploadProgress(100);

      // Start analysis
      await startAnalysis(result.file_id, file.name);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  }, [startAnalysis]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  }, [handleFileUpload]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="w-full">
      <div
        className={`relative border-2 border-dashed rounded-2xl p-10 text-center transition-all duration-300 ${
          isDragOver
            ? 'border-primary-400 bg-primary-50/50 scale-[1.02] shadow-soft-lg'
            : 'border-slate-200 hover:border-primary-300 hover:bg-slate-50/50'
        } ${isUploading ? 'pointer-events-none opacity-75' : 'cursor-pointer'}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        role="button"
        tabIndex={isUploading ? -1 : 0}
        aria-label="Upload research paper PDF"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleClick();
          }
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          onChange={handleFileSelect}
          className="sr-only"
        />

        {isUploading ? (
          <div className="space-y-6">
            <div className="w-20 h-20 bg-primary-100 rounded-3xl flex items-center justify-center mx-auto shadow-soft animate-pulse">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Analyzing Document...</h3>
              <p className="text-sm font-medium text-slate-500">Extracting insights and methodology</p>
            </div>
            <div className="w-full max-w-xs mx-auto bg-slate-100 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-primary-600 h-full rounded-full transition-all duration-500 ease-out"
                style={{ width: `${uploadProgress}%` }}
                role="progressbar"
                aria-valuenow={uploadProgress}
                aria-valuemin={0}
                aria-valuemax={100}
              ></div>
            </div>
            <p className="text-sm font-bold text-primary-600" aria-live="polite">{uploadProgress}% complete</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="w-20 h-20 bg-slate-100 rounded-3xl flex items-center justify-center mx-auto shadow-sm group-hover:scale-110 transition-transform duration-300">
              <svg className="w-10 h-10 text-slate-400 group-hover:text-primary-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Drop your paper here</h3>
              <p className="text-sm font-medium text-slate-500">
                Support for PDF files up to 50MB. Click to browse.
              </p>
            </div>
            <div className="inline-flex items-center px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl shadow-soft">
              SELECT PDF FILE
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-6 p-4 bg-rose-50 border border-rose-100 rounded-2xl shadow-sm" role="alert">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-rose-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-bold text-rose-800">{error}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UploadArea;
