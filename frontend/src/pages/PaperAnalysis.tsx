import React, { useState } from 'react';
import FileUpload from '../components/FileUpload';
import AnalysisResults from '../components/AnalysisResults';
import { Send } from 'lucide-react';
import axios from 'axios';

const PaperAnalysis: React.FC = () => {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
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

  const handleAnalyze = async () => {
    if (!fileId) return;
    
    setIsAnalyzing(true);
    setError(null);
    
    try {
      const response = await axios.post('/api/v1/analyze', {
        file_id: fileId,
        query: userQuery || undefined,
        analysis_type: 'comprehensive'
      });
      
      setAnalysis(response.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Analysis failed');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* Hero Section */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          AI-Powered Research Paper Analysis
        </h1>
        <p className="text-xl text-gray-600 max-w-3xl mx-auto">
          Upload your research paper and get comprehensive insights into methodology, 
          results, and implications. Our AI agents provide the kind of analysis 
          that PhD students and researchers need.
        </p>
      </div>

      {/* Main Content */}
      <div className="grid lg:grid-cols-3 gap-8">
        {/* Left Column - Upload and Query */}
        <div className="lg:col-span-1 space-y-6">
          {/* File Upload */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Upload Research Paper
            </h2>
            <FileUpload
              onFileUpload={handleFileUpload}
              onFileRemove={handleFileRemove}
              uploadedFile={uploadedFile}
              isUploading={isUploading}
            />
          </div>

          {/* Query Input */}
          {uploadedFile && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Analysis Query (Optional)
              </h2>
              <div className="space-y-4">
                <textarea
                  value={userQuery}
                  onChange={(e) => setUserQuery(e.target.value)}
                  placeholder="Ask specific questions about the paper (e.g., 'What are the main limitations?' or 'How does this compare to previous work?')"
                  className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                  rows={4}
                />
                
                <button
                  onClick={handleAnalyze}
                  disabled={isAnalyzing || !fileId}
                  className="w-full flex items-center justify-center space-x-2 bg-primary-600 text-white px-4 py-3 rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                >
                  {isAnalyzing ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      <span>Analyzing...</span>
                    </>
                  ) : (
                    <>
                      <Send className="h-5 w-5" />
                      <span>Analyze Paper</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center space-x-2">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-red-800">Error</h3>
                  <p className="text-sm text-red-700 mt-1">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Features */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              What You'll Get
            </h2>
            <div className="space-y-3">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-6 h-6 bg-primary-100 rounded-full flex items-center justify-center">
                  <span className="text-xs font-medium text-primary-700">1</span>
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">Executive Summary</h3>
                  <p className="text-sm text-gray-600">Concise overview of key findings and implications</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-6 h-6 bg-primary-100 rounded-full flex items-center justify-center">
                  <span className="text-xs font-medium text-primary-700">2</span>
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">Methodology Analysis</h3>
                  <p className="text-sm text-gray-600">Critical evaluation of experimental design and methods</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-6 h-6 bg-primary-100 rounded-full flex items-center justify-center">
                  <span className="text-xs font-medium text-primary-700">3</span>
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">Results Interpretation</h3>
                  <p className="text-sm text-gray-600">Statistical significance and practical implications</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-6 h-6 bg-primary-100 rounded-full flex items-center justify-center">
                  <span className="text-xs font-medium text-primary-700">4</span>
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">Context & Impact</h3>
                  <p className="text-sm text-gray-600">Field contribution and future research directions</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Results */}
        <div className="lg:col-span-2">
          <AnalysisResults 
            analysis={analysis} 
            isLoading={isAnalyzing} 
          />
        </div>
      </div>

      {/* Footer Info */}
      <div className="mt-12 text-center text-gray-500">
        <p className="text-sm">
          PaperWise uses advanced AI agents to provide comprehensive research paper analysis. 
          Your files are processed securely and are not stored permanently.
        </p>
      </div>
    </div>
  );
};

export default PaperAnalysis;
