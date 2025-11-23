'use client';

import { Message } from '../hooks/types';
import ReactMarkdown from 'react-markdown';
import { useState, useRef, useEffect } from 'react';
import { useTranslation } from '@/app/i18n/hooks/useTranslation';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';

interface MessageBubbleProps {
  message: Message;
}

// Copy to clipboard function
const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      document.body.removeChild(textArea);
      return true;
    } catch (fallbackErr) {
      document.body.removeChild(textArea);
      return false;
    }
  }
};

// Clipboard icon SVG
const ClipboardIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
    />
  </svg>
);

// Check icon SVG
const CheckIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M5 13l4 4L19 7"
    />
  </svg>
);

// Code block component with copy button
function CodeBlockWithCopy({ code, language }: { code: string; language: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleCopy = async () => {
    const success = await copyToClipboard(code);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleMouseEnter = () => {
    tooltipTimeoutRef.current = setTimeout(() => {
      setShowTooltip(true);
    }, 500);
  };

  const handleMouseLeave = () => {
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
      tooltipTimeoutRef.current = null;
    }
    setShowTooltip(false);
  };

  useEffect(() => {
    return () => {
      if (tooltipTimeoutRef.current) {
        clearTimeout(tooltipTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="relative group/codeblock my-2">
      <div className="absolute top-2 right-2 z-10 flex items-center gap-2">
        {language && (
          <span className="text-xs font-mono text-gray-300 bg-gray-800/80 px-2 py-2 rounded border border-gray-600 flex items-center h-8">
            {language}
          </span>
        )}
        <div className="relative">
          <button
            onClick={handleCopy}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            className={`p-2 rounded-md transition-all shadow-md border cursor-pointer ${
              copied
                ? 'text-white bg-green-600 border-green-500'
                : 'text-white bg-gray-800 hover:bg-gray-700 border-gray-600 opacity-80 group-hover/codeblock:opacity-100'
            }`}
          >
            {copied ? (
              <CheckIcon className="w-4 h-4" />
            ) : (
              <ClipboardIcon className="w-4 h-4" />
            )}
          </button>
          {showTooltip && (
            <div className="absolute bottom-full right-0 mb-2 px-2 py-1 text-xs text-white bg-gray-900 rounded shadow-lg whitespace-nowrap z-20">
              {copied ? t('messageBubble.copied') : t('messageBubble.copyTitle')}
            </div>
          )}
        </div>
      </div>
      <SyntaxHighlighter
        language={language}
        style={vscDarkPlus}
        PreTag="div"
        className="rounded-lg"
        customStyle={{
          fontWeight: '500',
          fontSize: '0.875rem',
          lineHeight: '1.5',
        }}
        codeTagProps={{
          style: {
            fontWeight: '500',
          },
        }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const { t, locale } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Format timestamp to local time string
  const formatTimestamp = (timestamp?: Date): string => {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleTimeString(locale === 'ko' ? 'ko-KR' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const handleCopy = async () => {
    const success = await copyToClipboard(message.content);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleMouseEnter = () => {
    tooltipTimeoutRef.current = setTimeout(() => {
      setShowTooltip(true);
    }, 500);
  };

  const handleMouseLeave = () => {
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
      tooltipTimeoutRef.current = null;
    }
    setShowTooltip(false);
  };

  useEffect(() => {
    return () => {
      if (tooltipTimeoutRef.current) {
        clearTimeout(tooltipTimeoutRef.current);
      }
    };
  }, []);

  if (message.role === 'user') {
    // User message: right-aligned bubble
    return (
      <div className="w-full">
        {message.timestamp && (
          <div className="text-right mb-1">
            <span className="text-xs text-gray-400">
              {formatTimestamp(message.timestamp)}
            </span>
          </div>
        )}
        <div className="flex justify-end">
          <div className="max-w-[80%] rounded-2xl px-4 py-2 bg-blue-500 text-white break-words">
            <div className="whitespace-pre-wrap break-words" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{message.content}</div>
          </div>
        </div>
      </div>
    );
  }

  if (message.role === 'system') {
    // System message: right-aligned orange bubble
    return (
      <div className="w-full">
        {message.timestamp && (
          <div className="text-right mb-1">
            <span className="text-xs text-gray-400">
              {formatTimestamp(message.timestamp)}
            </span>
          </div>
        )}
        <div className="flex justify-end">
          <div className="max-w-[80%] rounded-2xl px-4 py-2 bg-orange-500 text-white break-words">
            <div className="whitespace-pre-wrap break-words" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{message.content}</div>
          </div>
        </div>
      </div>
    );
  }

  // Check if this is a "thinking" message
  const thinkingText = t('chatStream.thinking');
  const isThinking = message.content === thinkingText;

  // AI message: full width, transparent background
  return (
    <div className="w-full group">
      {message.timestamp && (
        <div className="mb-1">
          <span className="text-xs text-gray-400">
            {formatTimestamp(message.timestamp)}
          </span>
        </div>
      )}
      {isThinking ? (
        <div className={`markdown-content thinking-glow`}>
          {message.content}
        </div>
      ) : (
        <div className="markdown-content">
          <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  // Custom styling for code blocks with syntax highlighting
                  code: ({ node, className, children, ...props }: any) => {
                    const match = /language-(\w+)/.exec(className || '');
                    const language = match ? match[1] : '';
                    const codeString = String(children).replace(/\n$/, '');
                    
                    if (match) {
                      // Code block with copy button
                      return <CodeBlockWithCopy code={codeString} language={language} />;
                    } else {
                      // Inline code
                      return (
                        <code
                          className="bg-gray-300 dark:bg-gray-700 px-1 py-0.5 rounded text-sm"
                          {...props}
                        >
                          {children}
                        </code>
                      );
                    }
                  },
                  // Custom styling for pre blocks (handled by SyntaxHighlighter)
                  pre: ({ children }: any) => {
                    return <>{children}</>;
                  },
                  // Custom styling for paragraphs
                  p: ({ children }) => {
                    return <p className="mb-2 last:mb-0">{children}</p>;
                  },
                  // Custom styling for lists
                  ul: ({ children }) => {
                    return <ul className="list-disc list-outside mb-2 space-y-1 pl-6">{children}</ul>;
                  },
                  ol: ({ children }) => {
                    return <ol className="list-decimal list-outside mb-2 space-y-1 pl-6">{children}</ol>;
                  },
                  // Custom styling for list items
                  li: ({ children }) => {
                    return <li className="mb-1">{children}</li>;
                  },
                  // Custom styling for headings
                  h1: ({ children }) => {
                    return <h1 className="text-xl font-bold mb-2 mt-4 first:mt-0">{children}</h1>;
                  },
                  h2: ({ children }) => {
                    return <h2 className="text-lg font-bold mb-2 mt-3 first:mt-0">{children}</h2>;
                  },
                  h3: ({ children }) => {
                    return <h3 className="text-base font-bold mb-2 mt-2 first:mt-0">{children}</h3>;
                  },
                  // Custom styling for links
                  a: ({ href, children }) => {
                    return (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 underline break-all"
                      >
                        {children}
                      </a>
                    );
                  },
                  // Custom styling for strong
                  strong: ({ children }) => {
                    return <strong className="font-bold">{children}</strong>;
                  },
                  // Custom styling for emphasis
                  em: ({ children }) => {
                    return <em className="italic">{children}</em>;
                  },
                  // Custom styling for blockquote
                  blockquote: ({ children }) => {
                    return (
                      <blockquote className="border-l-4 border-gray-400 pl-4 my-2 italic text-gray-700">
                        {children}
                      </blockquote>
                    );
                  },
                  // Custom styling for tables
                  table: ({ children }) => {
                    return (
                      <div className="overflow-x-auto my-4">
                        <table className="min-w-full border-collapse border border-gray-300">
                          {children}
                        </table>
                      </div>
                    );
                  },
                  thead: ({ children }) => {
                    return (
                      <thead className="bg-gray-100">
                        {children}
                      </thead>
                    );
                  },
                  tbody: ({ children }) => {
                    return (
                      <tbody>
                        {children}
                      </tbody>
                    );
                  },
                  tr: ({ children }) => {
                    return (
                      <tr className="border-b border-gray-200">
                        {children}
                      </tr>
                    );
                  },
                  th: ({ children }) => {
                    return (
                      <th className="border border-gray-300 px-4 py-2 text-left font-semibold">
                        {children}
                      </th>
                    );
                  },
                  td: ({ children }) => {
                    return (
                      <td className="border border-gray-300 px-4 py-2">
                        {children}
                      </td>
                    );
                  },
                }}
          >
            {message.content}
          </ReactMarkdown>
        </div>
      )}
      <div className="flex justify-end mt-2">
        <div className="relative">
          <button
            onClick={handleCopy}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            className={`p-2 rounded-md transition-all shadow-md border cursor-pointer ${
              copied
                ? 'text-white bg-green-600 border-green-500'
                : 'text-gray-700 bg-white hover:bg-gray-50 border-gray-300 opacity-0 group-hover:opacity-100'
            }`}
          >
            {copied ? (
              <CheckIcon className="w-4 h-4" />
            ) : (
              <ClipboardIcon className="w-4 h-4" />
            )}
          </button>
          {showTooltip && (
            <div className="absolute bottom-full right-0 mb-2 px-2 py-1 text-xs text-white bg-gray-900 rounded shadow-lg whitespace-nowrap z-20">
              {copied ? t('messageBubble.copied') : t('messageBubble.copyTitle')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

