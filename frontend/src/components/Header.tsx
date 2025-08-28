import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BookOpen, Brain } from 'lucide-react';

const Header: React.FC = () => {
  const location = useLocation();
  const isDashboard = location.pathname === '/';

  return (
    <header className="sticky top-0 z-50 bg-white shadow-md border-b border-gray-200">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center space-x-3 hover:opacity-80 transition-opacity">
            <div className="flex items-center space-x-2">
              <BookOpen className="h-8 w-8 text-primary-600" />
              <Brain className="h-6 w-6 text-primary-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">PaperWise</h1>
              <p className="text-sm text-gray-600">AI-Powered Research Paper Analysis</p>
            </div>
          </Link>
          
          <div className="flex items-center space-x-4">
            {!isDashboard && (
              <Link
                to="/"
                className="text-gray-600 hover:text-gray-900 transition-colors"
              >
                Dashboard
              </Link>
            )}
            <Link
              to="/upload"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 transition-colors duration-200"
            >
              Upload Paper
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
