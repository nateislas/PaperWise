import React from 'react';
import { BookOpen, Brain } from 'lucide-react';

const Header: React.FC = () => {
  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <BookOpen className="h-8 w-8 text-primary-600" />
              <Brain className="h-6 w-6 text-primary-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">PaperWise</h1>
              <p className="text-sm text-gray-600">AI-Powered Research Paper Analysis</p>
            </div>
          </div>
          
          <nav className="hidden md:flex items-center space-x-8">
            <a 
              href="#features" 
              className="text-gray-600 hover:text-primary-600 transition-colors duration-200"
            >
              Features
            </a>
            <a 
              href="#about" 
              className="text-gray-600 hover:text-primary-600 transition-colors duration-200"
            >
              About
            </a>
            <a 
              href="#contact" 
              className="text-gray-600 hover:text-primary-600 transition-colors duration-200"
            >
              Contact
            </a>
          </nav>
          
          <div className="flex items-center space-x-4">
            <button className="hidden md:inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-primary-700 bg-primary-100 hover:bg-primary-200 transition-colors duration-200">
              Sign In
            </button>
            <button className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 transition-colors duration-200">
              Get Started
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
