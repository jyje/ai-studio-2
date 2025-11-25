'use client';

import { Message } from '../hooks/types';
import ReactMarkdown from 'react-markdown';
import { useState, useRef, useEffect } from 'react';
import { useTranslation } from '@/app/i18n/hooks/useTranslation';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeRaw from 'rehype-raw';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

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
  
  // Reset copied state when code changes (allows copying during streaming)
  useEffect(() => {
    setCopied(false);
  }, [code]);
  
  const handleCopy = async () => {
    // Copy current code content (works even during streaming)
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
    <div className="group/codeblock my-2">
      {/* Header bar with language label (left) and copy button (right) */}
      <div className="flex items-center justify-between bg-[#1e1e1e] px-3 py-1.5 rounded-t-lg">
        {language && (
          <span className="text-xs font-mono text-gray-200 flex items-center">
            {language}
          </span>
        )}
        {!language && <div />}
        <div className="relative">
          <button
            onClick={handleCopy}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            className={`p-1.5 rounded transition-all cursor-pointer ${
              copied
                ? 'text-white bg-green-600'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50 opacity-80 group-hover/codeblock:opacity-100'
            }`}
          >
            {copied ? (
              <CheckIcon className="w-3 h-3" />
            ) : (
              <ClipboardIcon className="w-3 h-3" />
            )}
          </button>
          {showTooltip && (
            <div className="absolute bottom-full right-0 mb-2 px-2 py-1 text-[10px] text-white bg-gray-900 dark:bg-[#252526] rounded shadow-lg dark:shadow-xl whitespace-nowrap z-20 border border-gray-800 dark:border-[#3e3e42]">
              {copied ? t('messageBubble.copied') : t('messageBubble.copyTitle')}
            </div>
          )}
        </div>
      </div>
      <SyntaxHighlighter
        language={language}
        style={vscDarkPlus}
        PreTag="div"
        className="rounded-b-lg rounded-t-none -mt-px"
        customStyle={{
          fontWeight: '500',
          fontSize: '0.875rem',
          lineHeight: '1.5',
          margin: 0,
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

// Preprocess LaTeX environments to be recognized by remark-math
// This converts \begin{...}...\end{...} environments to $$...$$ format
const preprocessLaTeX = (content: string): string => {
  // List of LaTeX environments that should be treated as block equations
  const blockEnvironments = [
    'equation',
    'align',
    'aligned',
    'eqnarray',
    'gather',
    'multline',
    'split',
    'array',
    'matrix',
    'pmatrix',
    'bmatrix',
    'vmatrix',
    'Vmatrix',
    'cases',
    'alignat',
  ];

  let processed = content;

  // First, handle standalone LaTeX environments that might not be wrapped
  // Convert \(...\) to $...$ (inline math) - must come before other replacements
  processed = processed.replace(/\\\(([\s\S]*?)\\\)/g, '$$$1$$');
  
  // Convert \[...\] to $$...$$ (display math) - must come before other replacements
  processed = processed.replace(/\\\[([\s\S]*?)\\\]/g, '$$$$$1$$$$');

  // Convert \begin{env}...\end{env} to $$...$$ format
  // Only process if not already wrapped in $$
  for (const env of blockEnvironments) {
    const envPattern = new RegExp(
      `\\\\begin\\{${env}\\}([\\s\\S]*?)\\\\end\\{${env}\\}`,
      'g'
    );
    
    processed = processed.replace(envPattern, (match, innerContent, offset) => {
      // Check if already inside $$...$$ by counting $$ before this position
      const before = processed.substring(0, offset);
      const dollarCount = (before.match(/\$\$/g) || []).length;
      const isInsideMath = dollarCount % 2 === 1;
      
      if (isInsideMath) {
        // Already inside $$...$$, return as is
        return match;
      }
      
      // Not inside $$...$$, wrap it
      return `$$\n\\begin{${env}}${innerContent}\\end{${env}}\n$$`;
    });
  }

  return processed;
};

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

  // Force KaTeX elements to use appropriate color based on theme
  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null;
    
    const applyKaTeXColors = () => {
      const isDark = document.documentElement.classList.contains('dark');
      const color = isDark ? '#d4d4d4' : '#171717';

      // Find all KaTeX-related elements with multiple selectors
      const selectors = [
        '.katex',
        '.katex *',
        'math',
        'math *',
        '[class*="katex"]',
        '[class*="katex"] *',
      ];
      
      const allElements = new Set<Element>();
      
      // Collect all elements
      selectors.forEach(selector => {
        try {
          document.querySelectorAll(selector).forEach(el => allElements.add(el));
        } catch (e) {
          // Ignore invalid selectors
        }
      });
      
      // Apply color to all collected elements
      allElements.forEach((element) => {
        if (element instanceof HTMLElement || element instanceof SVGElement) {
          element.style.setProperty('color', color, 'important');
          element.style.setProperty('fill', color, 'important');
          
          // Also apply to all child elements recursively
          const children = element.querySelectorAll('*');
          children.forEach((child) => {
            if (child instanceof HTMLElement || child instanceof SVGElement) {
              child.style.setProperty('color', color, 'important');
              child.style.setProperty('fill', color, 'important');
            }
          });
        }
      });
    };

    // Debounced version to avoid too frequent updates
    const debouncedApply = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(() => {
        applyKaTeXColors();
        timeoutId = null;
      }, 50);
    };

    // Apply immediately
    applyKaTeXColors();

    // Apply after delays to catch dynamically rendered KaTeX
    setTimeout(applyKaTeXColors, 100);
    setTimeout(applyKaTeXColors, 300);
    setTimeout(applyKaTeXColors, 500);

    // Watch for DOM changes (for streaming messages)
    const observer = new MutationObserver(() => {
      debouncedApply();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class'],
    });

    // Watch for theme changes
    const themeObserver = new MutationObserver(() => {
      applyKaTeXColors();
    });

    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      observer.disconnect();
      themeObserver.disconnect();
    };
  }, [message.content]);

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
          <div className="max-w-[80%] rounded-2xl px-4 py-2 bg-blue-500 text-white break-words select-text">
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
          <div className="max-w-[80%] rounded-2xl px-4 py-2 bg-orange-500 text-white break-words select-text">
            <div className="whitespace-pre-wrap break-words" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{message.content}</div>
          </div>
        </div>
      </div>
    );
  }

  // Check if this is a "thinking" message
  const thinkingText = t('chatStream.thinking');
  const isThinking = message.content === thinkingText;

  // Preprocess content to handle LaTeX environments
  const processedContent = isThinking ? message.content : preprocessLaTeX(message.content);

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
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[
                  rehypeRaw,
                  [
                    rehypeKatex,
                    {
                      // Support all LaTeX environments
                      throwOnError: false,
                      errorColor: '#cc0000',
                      strict: false,
                      // Enable display mode for block equations
                      displayMode: false, // Will be set per equation
                      fleqn: false,
                      leqno: false,
                      macros: {},
                    },
                  ],
                ]}
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
                          className="bg-gray-300 dark:bg-[#252526] dark:text-[#d4d4d4] px-1 py-0.5 rounded text-sm font-mono border dark:border-[#3e3e42]"
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
                    return <p className="mb-2 last:mb-0 text-gray-900 dark:text-[#d4d4d4]">{children}</p>;
                  },
                  // Custom styling for lists
                  ul: ({ children }) => {
                    return <ul className="list-disc list-outside mb-2 space-y-1 pl-6 text-gray-900 dark:text-[#d4d4d4]">{children}</ul>;
                  },
                  ol: ({ children }) => {
                    return <ol className="list-decimal list-outside mb-2 space-y-1 pl-6 text-gray-900 dark:text-[#d4d4d4]">{children}</ol>;
                  },
                  // Custom styling for list items
                  li: ({ children }) => {
                    return <li className="mb-1">{children}</li>;
                  },
                  // Custom styling for headings
                  h1: ({ children }) => {
                    return <h1 className="text-xl font-bold mb-2 mt-4 first:mt-0 text-gray-900 dark:text-[#cccccc]">{children}</h1>;
                  },
                  h2: ({ children }) => {
                    return <h2 className="text-lg font-bold mb-2 mt-3 first:mt-0 text-gray-900 dark:text-[#cccccc]">{children}</h2>;
                  },
                  h3: ({ children }) => {
                    return <h3 className="text-base font-bold mb-2 mt-2 first:mt-0 text-gray-900 dark:text-[#cccccc]">{children}</h3>;
                  },
                  // Custom styling for links
                  a: ({ href, children }) => {
                    return (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 dark:text-[#4ec9b0] hover:text-blue-800 dark:hover:text-[#6ed4c0] underline break-all transition-colors"
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
                      <blockquote className="border-l-4 border-gray-400 dark:border-[#3e3e42] pl-4 my-2 italic text-gray-700 dark:text-[#d4d4d4] bg-gray-50 dark:bg-[#252526] py-2 rounded-r">
                        {children}
                      </blockquote>
                    );
                  },
                  // Custom styling for tables
                  table: ({ children }) => {
                    return (
                      <div className="overflow-x-auto my-4">
                        <table className="min-w-full border-collapse border border-gray-300 dark:border-[#3e3e42]">
                          {children}
                        </table>
                      </div>
                    );
                  },
                  thead: ({ children }) => {
                    return (
                      <thead className="bg-gray-100 dark:bg-[#252526]">
                        {children}
                      </thead>
                    );
                  },
                  tbody: ({ children }) => {
                    return (
                      <tbody className="bg-white dark:bg-[#1e1e1e]">
                        {children}
                      </tbody>
                    );
                  },
                  tr: ({ children }) => {
                    return (
                      <tr className="border-b border-gray-200 dark:border-[#3e3e42]">
                        {children}
                      </tr>
                    );
                  },
                  th: ({ children }) => {
                    return (
                      <th className="border border-gray-300 dark:border-[#3e3e42] px-4 py-2 text-left font-semibold text-gray-900 dark:text-[#cccccc]">
                        {children}
                      </th>
                    );
                  },
                  td: ({ children }) => {
                    return (
                      <td className="border border-gray-300 dark:border-[#3e3e42] px-4 py-2 text-gray-900 dark:text-[#d4d4d4]">
                        {children}
                      </td>
                    );
                  },
                }}
          >
            {processedContent}
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
                : 'text-gray-700 dark:text-[#cccccc] bg-white dark:bg-[#252526] hover:bg-gray-50 dark:hover:bg-[#2d2d30] border-gray-300 dark:border-[#3e3e42] opacity-0 group-hover:opacity-100'
            }`}
          >
            {copied ? (
              <CheckIcon className="w-4 h-4" />
            ) : (
              <ClipboardIcon className="w-4 h-4" />
            )}
          </button>
          {showTooltip && (
            <div className="absolute bottom-full right-0 mb-2 px-2 py-1 text-xs text-white bg-gray-900 dark:bg-[#252526] rounded shadow-lg dark:shadow-xl whitespace-nowrap z-20 border border-gray-800 dark:border-[#3e3e42]">
              {copied ? t('messageBubble.copied') : t('messageBubble.copyTitle')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

