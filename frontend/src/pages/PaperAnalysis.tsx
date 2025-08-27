import React, { useState } from 'react';
import FileUpload from '../components/FileUpload';
import StreamingAnalysisResults from '../components/StreamingAnalysisResults';
import { Zap, Target, TrendingUp, Lightbulb } from 'lucide-react';
import axios from 'axios';

const PaperAnalysis: React.FC = () => {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);
  const [userQuery, setUserQuery] = useState('');
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

      {/* Analysis Configuration */}
      {uploadedFile && fileId && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Analysis Configuration</h2>
          
          {/* Analysis Mode Info */}
          <div className="mb-6">
            <div className="flex items-center space-x-2 px-4 py-2 rounded-md border border-primary-600 bg-primary-50 text-primary-700">
              <Zap className="h-4 w-4" />
              <span className="font-medium">Real-time Streaming Analysis</span>
            </div>
            <p className="text-sm text-gray-600 mt-2">
              Real-time streaming analysis with live progress updates and faster initial response.
            </p>
          </div>

          {/* Query Input */}
          <div className="mb-6">
            <label htmlFor="query" className="block text-sm font-medium text-gray-700 mb-2">
              Specific Questions (Optional)
            </label>
            <div className="flex space-x-2">
              <input
                type="text"
                id="query"
                value={userQuery}
                onChange={(e) => setUserQuery(e.target.value)}
                placeholder="Ask specific questions about the paper..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>
      )}

      {/* Analysis Results */}
      {uploadedFile && fileId && (
        <div className="mb-8">
          <StreamingAnalysisResults
            fileId={fileId}
            userQuery={userQuery}
            onComplete={handleStreamingComplete}
            onError={handleStreamingError}
          />
        </div>
      )}

      {/* Features Section */}
      <div className="grid md:grid-cols-3 gap-6 mt-12">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Target className="h-6 w-6 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Methodology Analysis</h3>
          </div>
          <p className="text-gray-600">
            Deep evaluation of experimental design, statistical approaches, and research methods.
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-2 bg-green-100 rounded-lg">
              <TrendingUp className="h-6 w-6 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Results Interpretation</h3>
          </div>
          <p className="text-gray-600">
            Comprehensive analysis of findings, statistical significance, and data quality.
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Lightbulb className="h-6 w-6 text-purple-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Context & Implications</h3>
          </div>
          <p className="text-gray-600">
            Broader academic context, field contributions, and future research directions.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PaperAnalysis;
