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
    </div>
  );
};

export default PaperAnalysis;
