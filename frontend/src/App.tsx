import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Header } from './components/Header';
import { Library } from './pages/Library';
import { Watch } from './pages/Watch';
import AnalysisPage from './pages/AnalysisPage';
import { AddPaperModal } from './components/library/AddPaperModal';
import { apiUrl } from './config/api';
import './index.css';
import 'katex/dist/katex.min.css';

function AppContent() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const navigate = useNavigate();

  const handleUpload = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    let res = await fetch(apiUrl('/api/v1/analyze'), {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      const uploadRes = await fetch(apiUrl('/api/v1/upload'), {
        method: 'POST',
        body: formData,
      });

      if (!uploadRes.ok) {
        const errData = await uploadRes.json().catch(() => ({}));
        throw new Error(errData.detail || 'Upload failed');
      }

      const uploadData = await uploadRes.json();
      if (!uploadData.file_id) throw new Error('Upload did not return a valid file ID');

      const asyncRes = await fetch(apiUrl('/api/v1/analyze/async'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_id: uploadData.file_id,
          analysis_type: 'comprehensive',
        }),
      });

      if (!asyncRes.ok) {
        const errData = await asyncRes.json().catch(() => ({}));
        throw new Error(errData.detail || 'Failed to queue analysis');
      }

      const jobData = await asyncRes.json();
      const id = jobData.job_id || jobData.analysis_id;
      if (id) {
        navigate(`/paper/${id}`);
      }
      return;
    }

    const data = await res.json();
    const id = data.analysis_id || data.job_id || data.id;
    if (id) {
      navigate(`/paper/${id}`);
    } else {
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen bg-[--canvas] text-[--text-body]">
      <Header onAddPaperClick={() => setIsAddModalOpen(true)} />
      <main>
        <Routes>
          <Route path="/" element={<Library />} />
          <Route path="/watch" element={<Watch />} />
          <Route path="/paper/:analysisId" element={<AnalysisPage />} />
          {/* Legacy route redirects */}
          <Route path="/upload" element={<Navigate to="/?add=1" replace />} />
          <Route path="/analysis/:analysisId" element={<AnalysisPageRedirect />} />
        </Routes>
      </main>

      <AddPaperModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onUpload={handleUpload}
      />
    </div>
  );
}

function AnalysisPageRedirect() {
  const href = window.location.pathname.replace('/analysis/', '/paper/');
  return <Navigate to={href} replace />;
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
