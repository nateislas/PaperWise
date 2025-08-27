import React, { useState } from 'react';
import FileUpload from '../components/FileUpload';
import StreamingAnalysisResults from '../components/StreamingAnalysisResults';

import axios from 'axios';

const PaperAnalysis: React.FC = () => {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);

  const [fileId, setFileId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    setError(null);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await axios.post('/api/v1/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      setFileId(response.data.file_id);
      setUploadedFile(file);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to upload file');
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileRemove = () => {
    setUploadedFile(null);
    setFileId(null);
    setAnalysis(null);
    setError(null);
  };



  const handleStreamingComplete = (finalAnalysis: any) => {
    setAnalysis(finalAnalysis);
  };

  const handleStreamingError = (errorMessage: string) => {
    setError(errorMessage);
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* Hero Section */}
      <div className="text-center py-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          AI-Powered Research Paper Analysis
        </h1>
        <p className="text-xl text-gray-600 max-w-3xl mx-auto">
        Upload your research paper to PaperWise and get instant, in-depth analysis. Our AI agent goes beyond a simple summary, providing you with a critical breakdown of the methodology, key findings, and contributions to the field—just like a fellow researcher would.
        </p>
      </div>

      {/* File Upload Section */}
      <div className="mb-8">
        <FileUpload
          onFileUpload={handleFileUpload}
          onFileRemove={handleFileRemove}
          uploadedFile={uploadedFile}
          isUploading={isUploading}
          error={error}
        />
      </div>



      {/* Analysis Results */}
      {uploadedFile && fileId && (
        <div className="mb-8">
          <StreamingAnalysisResults
            fileId={fileId}
            onComplete={handleStreamingComplete}
            onError={handleStreamingError}
          />
        </div>
      )}


    </div>
  );
};

export default PaperAnalysis;
