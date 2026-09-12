import React, { useState, useEffect, useRef } from 'react';
import { Send, Sparkles, User, Bot, FileText, Bookmark, ArrowUpRight, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { cn } from '../../lib/cn';
import { apiUrl } from '../../config/api';
import { resolveReportSectionId } from '../../constants/sections';

export interface SourceDetail {
  label: string;
  page?: number;
  section?: string;
  snippet?: string;
  type?: 'pdf' | 'report' | 'paper_chunk' | 'analysis_report' | string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  sources?: string[];
  source_details?: SourceDetail[];
  thinking?: boolean;
}

export interface ChatPanelProps {
  analysisId: string;
  paperInfo?: any;
  initialContext?: string | null;
  concerns?: any[];
  onJumpToPdfPage: (page: number, sectionOrQuote?: string) => void;
  onJumpToReportSection: (section: string) => void;
}

export function ChatPanel({
  analysisId,
  paperInfo,
  initialContext,
  concerns = [],
  onJumpToPdfPage,
  onJumpToReportSection,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [attachedContext, setAttachedContext] = useState<string | null>(initialContext || null);
  const [loading, setLoading] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const activeAnalysisIdRef = useRef(analysisId);

  // Reset state and cancel in-flight requests whenever analysisId changes
  useEffect(() => {
    if (activeAnalysisIdRef.current !== analysisId) {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      activeAnalysisIdRef.current = analysisId;
      setMessages([]);
      setInput('');
      setAttachedContext(null);
      setLoading(false);
    }
  }, [analysisId]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  useEffect(() => {
    if (initialContext) {
      setAttachedContext(initialContext);
    }
  }, [initialContext]);

  // Generate dynamic starters per-paper from concerns or defaults
  const topConcern = concerns.length > 0
    ? (typeof concerns[0] === 'string' ? concerns[0] : concerns[0].title || concerns[0].category)
    : null;

  const starters = [
    topConcern
      ? `What is the impact of: ${topConcern.slice(0, 60)}?`
      : "What's the weakest part of the methods?",
    'Does the primary claim replicate or have sufficient controls?',
    'How do the baselines compare to state-of-the-art?',
  ];

  const handleCitationClick = (rawCitation: string) => {
    const trimmed = rawCitation.trim();
    const pageMatch = trimmed.match(/Page\s+(\d+)(?:[,\s:]+§?\s*(.*))?/i);
    if (pageMatch) {
      const pageNum = parseInt(pageMatch[1], 10);
      const sectionSnippet = pageMatch[2]?.trim();
      onJumpToPdfPage(pageNum, sectionSnippet);
      return;
    }

    let sec = trimmed;
    if (/Analysis Report:/i.test(trimmed)) {
      sec = trimmed.replace(/^Analysis Report:\s*/i, '').trim();
    }

    const canonicalId = resolveReportSectionId(sec) || sec;
    onJumpToReportSection(canonicalId);
  };

  const handleSend = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || loading) return;

    const fullQuery = attachedContext
      ? `[Context from PDF: "${attachedContext}"]\n\n${query}`
      : query;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: query,
    };
    const thinkingMsg: ChatMessage = {
      id: `thinking-${Date.now()}`,
      sender: 'assistant',
      text: 'Searching paper text and methodology report...',
      thinking: true,
    };

    // Capture history prior to appending current query
    const historyPayload = messages
      .filter((m) => !m.thinking)
      .map((m) => ({
        role: m.sender,
        content: m.text,
      }));

    setMessages((prev) => [...prev, userMsg, thinkingMsg]);
    setInput('');
    setAttachedContext(null);
    setLoading(true);

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const requestAnalysisId = analysisId;

    try {
      const res = await fetch(apiUrl(`/api/v1/analyses/${requestAnalysisId}/chat`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: fullQuery,
          history: historyPayload,
        }),
        signal: controller.signal,
      });

      if (!res.ok) throw new Error('Chat API error');
      const data = await res.json();

      // Guard against stale response if user switched papers
      if (activeAnalysisIdRef.current !== requestAnalysisId) return;

      const assistantMsg: ChatMessage = {
        id: `asst-${Date.now()}`,
        sender: 'assistant',
        text: data.response || data.answer || 'No response returned.',
        sources: data.sources || [],
        source_details: data.source_details || [],
      };

      setMessages((prev) => prev.filter((m) => !m.thinking).concat(assistantMsg));
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      if (activeAnalysisIdRef.current !== requestAnalysisId) return;
      console.error('Chat error:', err);
      setMessages((prev) =>
        prev.filter((m) => !m.thinking).concat({
          id: `err-${Date.now()}`,
          sender: 'assistant',
          text: 'Sorry, an error occurred while evaluating the query. Please try again.',
        })
      );
    } finally {
      if (activeAnalysisIdRef.current === requestAnalysisId) {
        setLoading(false);
      }
    }
  };

  const renderMessageContent = (text: string) => {
    // 1. Strip backticks around citations
    let clean = text.replace(/`+(\[(?:Page\s+\d+|Analysis Report:)[^\]`]+\])`+/gi, '$1');

    // 2. Remove existing double-encodings
    clean = clean.replace(/\[((?:Page\s+\d+|Analysis Report:|Methodolog|Evidence|Results|Critical|Novelty|Executive|Gap|Impact|Overall)[^\]]*)\]\(#cite-[^)]+\)/gi, '[$1]');

    // 3. Transform citations in square brackets like [Page 2: ...], [Page 4], [Analysis Report: ...] into markdown link format
    const transformed = clean.replace(
      /\[(Page\s+\d+[^\]\n]*|Analysis Report:[^\]\n]*|Methodology Evaluation|Methodological Evaluation|Evidence Quality|Results Scrutiny|Critical Review|Novelty Assessment|Executive Summary|Gap Analysis|Impact Assessment|Overall Verdict)\](?!\()/gi,
      (match, p1) => {
        const encoded = encodeURIComponent(p1.trim());
        return `[${p1.trim()}](#cite-${encoded})`;
      }
    );

    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          a: ({ href, children }) => {
            if (href && href.startsWith('#cite-')) {
              const rawCitation = decodeURIComponent(href.replace('#cite-', ''));
              const isPdf = rawCitation.toLowerCase().startsWith('page');
              return (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleCitationClick(rawCitation);
                  }}
                  className={cn(
                    'inline-flex items-center gap-1 px-2 py-0.5 my-0.5 mx-1 rounded-md text-[11px] font-bold transition-all shadow-xs align-middle cursor-pointer',
                    isPdf
                      ? 'bg-[--accent-subtle] text-[--text-accent] border border-[--border-accent]/40 hover:bg-[--accent-subtle]/80'
                      : 'bg-[--caut-light-wash] dark:bg-[--caut-dark-wash] text-[--caut-light-text] dark:text-[--caut-dark-text] border border-[--caut-light-dot]/40 hover:opacity-90'
                  )}
                  title={isPdf ? `Jump to PDF: ${rawCitation}` : `View in Verdict tab: ${rawCitation}`}
                >
                  {isPdf ? <FileText className="h-3 w-3" /> : <Bookmark className="h-3 w-3" />}
                  <span>{children}</span>
                  <ArrowUpRight className="h-2.5 w-2.5 opacity-70" />
                </button>
              );
            }
            return (
              <a href={href} target="_blank" rel="noopener noreferrer" className="text-[--text-accent] underline">
                {children}
              </a>
            );
          },
        }}
      >
        {transformed}
      </ReactMarkdown>
    );
  };

  return (
    <div className="flex flex-col h-full bg-[--surface]">
      {/* Messages List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="py-8 text-center space-y-3">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-[--accent-subtle] text-[--text-accent]">
              <Bot className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-bold text-[--text-primary]">
              Knowledge Chat
            </h3>
            <p className="text-xs text-[--text-secondary] max-w-xs mx-auto">
              Ask questions grounded directly in the paper's parsed text chunks, tables, and methodology critique.
            </p>
          </div>
        )}

        {messages.map((m) => (
          <div
            key={m.id}
            className={cn(
              'flex gap-3 text-xs leading-5',
              m.sender === 'user' ? 'flex-row-reverse' : 'flex-row'
            )}
          >
            <div
              className={cn(
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg font-bold text-xs',
                m.sender === 'user'
                  ? 'bg-[--surface-inverse] text-[--text-inverse]'
                  : 'bg-[--accent-subtle] text-[--text-accent]'
              )}
            >
              {m.sender === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
            </div>

            <div
              className={cn(
                'max-w-[85%] rounded-xl p-3.5 space-y-2',
                m.sender === 'user'
                  ? 'bg-[--surface-inverse] text-[--text-inverse]'
                  : 'bg-[--surface-sunken] text-[--text-primary]'
              )}
            >
              {m.thinking ? (
                <div className="flex items-center gap-2 text-[--text-secondary]">
                  <Sparkles className="h-4 w-4 animate-spin text-[--text-accent]" />
                  <span>{m.text}</span>
                </div>
              ) : (
                <div className="prose prose-xs max-w-none text-[--text-primary]">
                  {renderMessageContent(m.text)}
                </div>
              )}

              {/* Source Chips */}
              {m.sources && m.sources.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5 border-t border-[--border-subtle] pt-2">
                  <span className="text-[10px] font-semibold text-[--text-secondary] self-center mr-1">
                    Sources:
                  </span>
                  {m.sources.map((src, i) => {
                    const isPdf = src.toLowerCase().startsWith('page');
                    return (
                      <button
                        key={i}
                        onClick={() => handleCitationClick(src)}
                        className={cn(
                          'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold border transition-colors cursor-pointer',
                          isPdf
                            ? 'bg-[--surface] border-[--border-subtle] text-[--text-accent] hover:border-[--border-accent]'
                            : 'bg-[--surface] border-[--border-subtle] text-[--caut-light-text] dark:text-[--caut-dark-text] hover:border-[--caut-light-dot]'
                        )}
                        title={isPdf ? `Jump to PDF: ${src}` : `Jump to Verdict: ${src}`}
                      >
                        {isPdf ? <FileText className="h-3 w-3" /> : <Bookmark className="h-3 w-3" />}
                        <span>{src}</span>
                        <ArrowUpRight className="h-2.5 w-2.5 opacity-60" />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Suggested Starters */}
      {messages.length === 0 && (
        <div className="p-4 border-t border-[--border-subtle] space-y-2 bg-[--surface-sunken]/30">
          <p className="text-[11px] font-semibold text-[--text-secondary]">Suggested questions:</p>
          <div className="flex flex-col gap-1.5">
            {starters.map((s, i) => (
              <button
                key={i}
                onClick={() => handleSend(s)}
                className="text-left text-xs rounded-lg border border-[--border-subtle] bg-[--surface] p-2.5 hover:border-[--border-strong] text-[--text-body] hover:bg-[--surface-hover] transition-colors shadow-2xs"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Form with attached PDF selection context */}
      <div className="p-3 border-t border-[--border-subtle] bg-[--surface] space-y-2">
        {attachedContext && (
          <div className="flex items-center justify-between gap-2 rounded-lg bg-[--accent-subtle] border border-[--border-accent]/30 px-2.5 py-1 text-xs text-[--text-accent]">
            <span className="truncate italic">"{attachedContext.slice(0, 75)}..."</span>
            <button
              type="button"
              onClick={() => setAttachedContext(null)}
              className="p-0.5 hover:opacity-80 rounded cursor-pointer"
              title="Remove context"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about methodology, evidence, or data..."
            disabled={loading}
            className="flex-1"
          />
          <Button variant="primary" size="md" type="submit" disabled={!input.trim() || loading}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}

export default ChatPanel;
