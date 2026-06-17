import React from 'react';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

const SearchBar: React.FC<SearchBarProps> = ({ value, onChange, placeholder = "Search library..." }) => {
  return (
    <div className="relative w-full max-w-md group">
      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
        <svg 
          className="h-5 w-5 text-slate-400 group-focus-within:text-primary-500 transition-colors" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="block w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-medium text-slate-900 placeholder-slate-400 focus-ring shadow-soft hover:border-slate-300 transition-all"
        aria-label="Search research papers"
      />
    </div>
  );
};

export default SearchBar;
