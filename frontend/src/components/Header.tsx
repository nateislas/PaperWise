import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BookOpen, Brain } from 'lucide-react';

const Header: React.FC = () => {
  const location = useLocation();
  const isDashboard = location.pathname === '/';

  return (
    <header className="sticky top-0 z-50 glass-panel border-b border-slate-200/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          <Link 
            to="/" 
            className="flex items-center space-x-4 focus-ring rounded-lg p-1 group"
            aria-label="PaperWise Home"
          >
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary-600 text-white shadow-soft transition-transform group-hover:scale-105">
              <BookOpen className="h-7 w-7" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">PaperWise</h1>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-widest">AI Research Partner</p>
            </div>
          </Link>
          
          <nav className="flex items-center space-x-6" aria-label="Main Navigation">
            {!isDashboard && (
              <Link
                to="/"
                className="text-sm font-semibold text-slate-600 hover:text-primary-600 transition-colors focus-ring rounded-md px-2 py-1"
              >
                Library
              </Link>
            )}
            <Link
              to="/upload"
              className="inline-flex items-center px-6 py-2.5 border border-transparent text-sm font-bold rounded-xl text-white bg-primary-600 hover:bg-primary-700 shadow-soft hover:shadow-soft-lg transition-all duration-200 focus-ring"
            >
              Upload Paper
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
};

export default Header;
