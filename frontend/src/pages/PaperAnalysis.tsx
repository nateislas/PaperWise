import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import FileUpload from '../components/FileUpload';
import axios from 'axios';

const PaperAnalysis: React.FC = () => {
  const navigate = useNavigate();
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    setError(null);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const apiBase = process.env.REACT_APP_API_URL || 'http://localhost:8081';
      const response = await axios.post(`${apiBase}/api/v1/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      const fileId = response.data.file_id;
      setUploadedFile(file);

      // Start analysis asynchronously
      const analysisResponse = await axios.post(`${apiBase}/api/v1/analyze/async`, {
        file_id: fileId,
        analysis_type: 'comprehensive'
      });

      // Redirect to the analysis page
      navigate(`/analysis/${analysisResponse.data.job_id}`);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to upload file');
      setIsUploading(false);
    }
  };

  const handleFileRemove = () => {
    setUploadedFile(null);
    setError(null);
  };

  return (
    <main className="min-h-screen bg-slate-50/50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        {/* Hero Section */}
        <div className="text-center mb-16 animate-fade-in">
          <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-primary-50 text-primary-700 text-xs font-bold uppercase tracking-widest mb-6 border border-primary-100">
            Analysis Engine
          </div>
          <h1 className="text-5xl font-extrabold text-slate-900 mb-6 tracking-tight">
            New Research Analysis
          </h1>
          <p className="text-lg font-medium text-slate-500 max-w-2xl mx-auto leading-relaxed">
            Upload your PDF and let our multi-agent system perform a deep 
            methodological and results audit of your research paper.
          </p>
        </div>

        {/* File Upload Section */}
        <div className="bg-white rounded-3xl shadow-soft border border-slate-100 p-10 animate-slide-up">
          <FileUpload
            onFileUpload={handleFileUpload}
            onFileRemove={handleFileRemove}
            uploadedFile={uploadedFile}
            isUploading={isUploading}
            error={error}
          />
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-16">
          <div className="p-6 bg-white rounded-2xl shadow-sm border border-slate-100">
            <h3 className="text-sm font-bold text-slate-900 mb-2">Deep Methodology Audit</h3>
            <p className="text-xs font-medium text-slate-500 leading-relaxed">
              We analyze experimental design, statistical significance, and baseline comparisons 
              to ensure results are robust and reproducible.
            </p>
          </div>
          <div className="p-6 bg-white rounded-2xl shadow-sm border border-slate-100">
            <h3 className="text-sm font-bold text-slate-900 mb-2">Contextual Gap Analysis</h3>
            <p className="text-xs font-medium text-slate-500 leading-relaxed">
              Our agents map the paper against existing literature to identify specific 
              research gaps and novelty contributions.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
};

export default PaperAnalysis;
