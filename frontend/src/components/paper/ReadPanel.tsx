import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

export function ReadPanel({
  markdownContent,
  paperInfo,
}: {
  markdownContent?: string;
  paperInfo?: any;
}) {
  if (!markdownContent) {
    return (
      <div className="p-8 text-center text-xs text-[--text-secondary]">
        Full text extracted markdown is not available for this paper. Use the PDF viewer pane on the left to read.
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6 pb-20">
      {paperInfo?.title && (
        <div className="border-b border-[--border-subtle] pb-4">
          <h1 className="text-xl font-bold text-[--text-primary] leading-tight">
            {paperInfo.title}
          </h1>
          {paperInfo.authors && (
            <p className="mt-1 text-xs text-[--text-secondary]">
              {Array.isArray(paperInfo.authors) ? paperInfo.authors.join(', ') : paperInfo.authors}
            </p>
          )}
        </div>
      )}

      <div className="prose prose-sm max-w-none text-[--text-body] leading-relaxed">
        <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
          {markdownContent}
        </ReactMarkdown>
      </div>
    </div>
  );
}
