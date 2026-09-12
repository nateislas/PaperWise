import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Plus, Search, Sun, Moon } from 'lucide-react';
import { Button } from './ui/Button';
import { cn } from '../lib/cn';

export function Header({
  onAddPaperClick,
}: {
  onAddPaperClick?: () => void;
}) {
  const location = useLocation();
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (
      (document.documentElement.getAttribute('data-theme') as
        | 'light'
        | 'dark') || 'light'
    );
  });

  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
    try {
      localStorage.setItem('pw.theme', nextTheme);
    } catch (e) {}
  };

  const isLibrary = location.pathname === '/' || location.pathname.startsWith('/paper');
  const isWatch = location.pathname === '/watch';

  return (
    <header className="sticky top-0 z-40 flex h-14 w-full items-center justify-between border-b border-[--border-subtle] bg-[--surface] px-4 md:px-6">
      {/* Left: Brand + Navigation */}
      <div className="flex items-center gap-6">
        <Link
          to="/"
          className="flex items-center gap-2 font-bold text-[--text-primary] text-base tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--focus-ring] rounded-md px-1"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[--surface-inverse] text-[--text-inverse] font-extrabold text-xs">
            PW
          </span>
          <span>PaperWise</span>
        </Link>

        <nav className="flex items-center gap-1">
          <Link
            to="/"
            className={cn(
              'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
              isLibrary
                ? 'bg-[--surface-sunken] text-[--text-primary]'
                : 'text-[--text-secondary] hover:text-[--text-primary] hover:bg-[--surface-hover]'
            )}
          >
            Library
          </Link>
          <Link
            to="/watch"
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
              isWatch
                ? 'bg-[--surface-sunken] text-[--text-primary]'
                : 'text-[--text-secondary] hover:text-[--text-primary] hover:bg-[--surface-hover]'
            )}
          >
            <span>Watch</span>
            <span className="rounded bg-[--accent-subtle] px-1 py-0.2 text-[10px] font-semibold text-[--text-accent]">
              Stub
            </span>
          </Link>
        </nav>
      </div>

      {/* Right: Search + Theme + Add Paper */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => {
            // Search stub
          }}
          className="hidden md:inline-flex items-center gap-2 h-8 px-3 rounded-lg border border-[--border-subtle] bg-[--surface-sunken] text-xs text-[--text-secondary] hover:border-[--border-strong] transition-colors"
        >
          <Search className="h-3.5 w-3.5" />
          <span>Search library...</span>
          <kbd className="tabular rounded bg-[--surface] border border-[--border-subtle] px-1 py-0.5 text-[10px] font-mono text-[--text-disabled]">
            ⌘K
          </kbd>
        </button>

        <button
          type="button"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-[--border-subtle] bg-[--surface] text-[--text-secondary] hover:bg-[--surface-hover] hover:text-[--text-primary] transition-colors"
        >
          {theme === 'light' ? (
            <Moon className="h-4 w-4" />
          ) : (
            <Sun className="h-4 w-4" />
          )}
        </button>

        <Button
          variant="primary"
          size="sm"
          onClick={onAddPaperClick}
          className="font-semibold"
        >
          <Plus className="h-4 w-4" />
          <span>Add paper</span>
        </Button>
      </div>
    </header>
  );
}
