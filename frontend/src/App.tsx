import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import PaperAnalysis from './pages/PaperAnalysis';
import Dashboard from './pages/Dashboard';
import AnalysisPage from './pages/AnalysisPage';
import './index.css';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/upload" element={<PaperAnalysis />} />
            <Route path="/analysis/:analysisId" element={<AnalysisPage />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
