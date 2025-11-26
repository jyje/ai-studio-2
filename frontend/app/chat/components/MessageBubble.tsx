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
import { ParsedFile } from '../utils/fileParser';
import ToolCallCard from './ToolCallCard';

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

// File type icon component (matching AttachedFileList)
function FileTypeIcon({ type }: { type: 'text' | 'pdf' | 'image' | 'unsupported' }) {
  switch (type) {
    case 'pdf':
      return (
        <svg className="w-4 h-4 text-red-500" viewBox="0 0 24 24" fill="currentColor">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 1.5L18.5 9H13V3.5zM6 20V4h5v7h7v9H6z"/>
          <path d="M8 12h2v2H8v-2zm0 3h5v1H8v-1zm0 2h5v1H8v-1z"/>
        </svg>
      );
    case 'image':
      return (
        <svg className="w-4 h-4 text-green-500" viewBox="0 0 24 24" fill="currentColor">
          <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
        </svg>
      );
    case 'text':
      return (
        <svg className="w-4 h-4 text-blue-500" viewBox="0 0 24 24" fill="currentColor">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm4 18H6V4h7v5h5v11z"/>
          <path d="M8 12h8v1H8v-1zm0 2h8v1H8v-1zm0 2h5v1H8v-1z"/>
        </svg>
      );
    default:
      return (
        <svg className="w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="currentColor">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm4 18H6V4h7v5h5v11z"/>
        </svg>
      );
  }
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const { t, locale } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [imagePreview, setImagePreview] = useState<{ src: string; x: number; y: number } | null>(null);
  const imagePreviewRef = useRef<{ src: string; x: number; y: number } | null>(null);

  // Check if a date is today
  const isToday = (date: Date): boolean => {
    const today = new Date();
    const d = new Date(date);
    return (
      d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear()
    );
  };

  // Format timestamp - time only for today, date + time for other days
  const formatTimestamp = (timestamp?: Date): string => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const localeCode = locale === 'ko' ? 'ko-KR' : 'en-US';
    
    if (isToday(date)) {
      // Today: show time only
      return date.toLocaleTimeString(localeCode, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } else {
      // Other days: show date and time
      return date.toLocaleString(localeCode, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
  };

  // Format full timestamp for tooltip
  const formatFullTimestamp = (timestamp?: Date): string => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const localeCode = locale === 'ko' ? 'ko-KR' : 'en-US';
    
    return date.toLocaleString(localeCode, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long',
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

  // Image preview handlers (for both user message files and AI message images)
  const handleImagePreviewEnter = (src: string, e: React.MouseEvent) => {
    const preview = {
      src,
      x: e.clientX,
      y: e.clientY,
    };
    setImagePreview(preview);
    imagePreviewRef.current = preview;
  };

  const handleImagePreviewMove = (e: React.MouseEvent) => {
    if (imagePreviewRef.current) {
      const preview = {
        ...imagePreviewRef.current,
        x: e.clientX,
        y: e.clientY,
      };
      setImagePreview(preview);
      imagePreviewRef.current = preview;
    }
  };

  const handleImagePreviewLeave = () => {
    setImagePreview(null);
    imagePreviewRef.current = null;
  };

  // For user message attached files
  const handleImageMouseEnter = (file: ParsedFile, e: React.MouseEvent) => {
    if (file.type === 'image' && file.content) {
      handleImagePreviewEnter(file.content, e);
    }
  };

  const handleImageMouseMove = (e: React.MouseEvent) => {
    handleImagePreviewMove(e);
  };

  const handleImageMouseLeave = () => {
    handleImagePreviewLeave();
  };

  // Global mouse move handler for image preview
  useEffect(() => {
    if (imagePreview) {
      const handleMouseMove = (e: MouseEvent) => {
        if (imagePreviewRef.current) {
          const preview = {
            ...imagePreviewRef.current,
            x: e.clientX,
            y: e.clientY,
          };
          setImagePreview(preview);
          imagePreviewRef.current = preview;
        }
      };
      window.addEventListener('mousemove', handleMouseMove);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
      };
    }
  }, [imagePreview]);

  // Image preview portal component
  const ImagePreviewPortal = () => {
    if (!imagePreview) return null;
    return (
      <div
        className="fixed pointer-events-none z-50 rounded-lg shadow-2xl border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 overflow-hidden"
        style={{
          left: `${imagePreview.x + 15}px`,
          top: `${imagePreview.y + 15}px`,
          maxWidth: '400px',
          maxHeight: '400px',
        }}
      >
        <img
          src={imagePreview.src}
          alt="Preview"
          className="max-w-full max-h-full object-contain"
          style={{ display: 'block' }}
        />
      </div>
    );
  };

  if (message.role === 'user') {
    // User message: right-aligned bubble
    const hasAttachedFiles = message.attachedFiles && message.attachedFiles.length > 0;
    
    return (
      <div className="w-full group">
        {message.timestamp && (
          <div className="text-right mb-1">
            <span 
              className="text-xs text-gray-400 cursor-default"
              title={formatFullTimestamp(message.timestamp)}
            >
              {formatTimestamp(message.timestamp)}
            </span>
          </div>
        )}
        <div className="flex justify-end">
          <div className="max-w-[80%] rounded-2xl px-4 py-2 bg-blue-500 text-white break-words select-text">
            <div className="whitespace-pre-wrap break-words" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{message.content}</div>
            {hasAttachedFiles && (
              <div className="flex items-center gap-2 mt-2 pt-2 border-t border-blue-400/30">
                {message.attachedFiles.map((file: ParsedFile) => (
                  <div
                    key={file.id}
                    className="flex items-center gap-1.5 bg-blue-400/20 rounded px-2 py-1"
                    title={file.name}
                    onMouseEnter={(e) => file.type === 'image' && handleImageMouseEnter(file, e)}
                    onMouseLeave={file.type === 'image' ? handleImageMouseLeave : undefined}
                    onMouseMove={file.type === 'image' ? handleImageMouseMove : undefined}
                  >
                    <FileTypeIcon type={file.type} />
                    <span className="text-xs truncate max-w-[120px]">{file.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
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
        <ImagePreviewPortal />
      </div>
    );
  }

  if (message.role === 'system') {
    // System message: right-aligned orange bubble
    return (
      <div className="w-full">
        {message.timestamp && (
          <div className="text-right mb-1">
            <span 
              className="text-xs text-gray-400 cursor-default"
              title={formatFullTimestamp(message.timestamp)}
            >
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
          <span 
            className="text-xs text-gray-400 cursor-default"
            title={formatFullTimestamp(message.timestamp)}
          >
            {formatTimestamp(message.timestamp)}
          </span>
        </div>
      )}
      {/* Tool calls display */}
      {message.toolCalls && message.toolCalls.length > 0 && (
        <div className="mb-4 space-y-3">
          {message.toolCalls.map((toolCall) => (
            <ToolCallCard key={toolCall.id} toolCall={toolCall} />
          ))}
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
                          className="bg-gray-300 dark:bg-[#eaeaea] dark:text-[#222222] px-0.5 py-0.25 rounded text-sm font-mono border dark:border-[#eaeaea]"
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
                    return <p className="mb-2 last:mb-0 text-black dark:text-black">{children}</p>;
                  },
                  // Custom styling for lists
                  ul: ({ children }) => {
                    return <ul className="list-disc list-outside mb-2 space-y-1 pl-6 text-black dark:text-black">{children}</ul>;
                  },
                  ol: ({ children }) => {
                    return <ol className="list-decimal list-outside mb-2 space-y-1 pl-6 text-black dark:text-black">{children}</ol>;
                  },
                  // Custom styling for list items
                  li: ({ children }) => {
                    return <li className="mb-1">{children}</li>;
                  },
                  // Custom styling for headings
                  h1: ({ children }) => {
                    return <h1 className="text-xl font-bold mb-2 mt-4 first:mt-0 text-black dark:text-black">{children}</h1>;
                  },
                  h2: ({ children }) => {
                    return <h2 className="text-lg font-bold mb-2 mt-3 first:mt-0 text-black dark:text-black">{children}</h2>;
                  },
                  h3: ({ children }) => {
                    return <h3 className="text-base font-bold mb-2 mt-2 first:mt-0 text-black dark:text-black">{children}</h3>;
                  },
                  // Custom styling for images with preview
                  img: ({ src, alt, ...props }: any) => {
                    return (
                      <img
                        src={src}
                        alt={alt}
                        {...props}
                        className="max-w-full h-auto rounded-lg my-2 cursor-pointer hover:opacity-90 transition-opacity"
                        onMouseEnter={(e) => {
                          if (src) {
                            handleImagePreviewEnter(src, e as any);
                          }
                        }}
                        onMouseMove={(e) => {
                          if (imagePreviewRef.current) {
                            handleImagePreviewMove(e as any);
                          }
                        }}
                        onMouseLeave={handleImagePreviewLeave}
                      />
                    );
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
                      <blockquote className="border-l-4 border-gray-400 dark:border-[#3e3e42] pl-4 my-2 italic text-black dark:text-black bg-gray-50 dark:bg-[#252526] py-2 rounded-r">
                        {children}
                      </blockquote>
                    );
                  },
                  // Custom styling for tables
                  table: ({ children }) => {
                    return (
                      <div className="overflow-x-auto my-4">
                        <table className="min-w-full border-collapse border border-gray-300 dark:border-[#3e3e42] bg-white dark:bg-transparent">
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
                      <tr className="border-b border-gray-200 dark:border-[#3e3e42] bg-white dark:bg-transparent">
                        {children}
                      </tr>
                    );
                  },
                  th: ({ children }) => {
                    return (
                      <th className="border border-gray-300 dark:border-[#3e3e42] px-4 py-2 text-left font-semibold bg-gray-100 dark:bg-transparent text-gray-900 dark:text-black">
                        {children}
                      </th>
                    );
                  },
                  td: ({ children }) => {
                    return (
                      <td className="border border-gray-300 dark:border-[#3e3e42] px-4 py-2 bg-white dark:bg-transparent text-gray-900 dark:text-black">
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
      <ImagePreviewPortal />
      {/* Model/Agent info and Copy button row */}
      <div className="flex items-center justify-between mt-2">
        {/* Model/Agent meta info - left side */}
        {message.meta && (
          <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
            {message.meta.modelName && (
              <span className="flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                {message.meta.modelName}
              </span>
            )}
            {message.meta.agentType && (
              <>
                <span className="text-gray-300 dark:text-gray-600">•</span>
                <span className="flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  {message.meta.agentType === 'langgraph' ? 'LangGraph' : message.meta.agentType === 'plan-1' ? 'Plan-1' : 'Basic'}
                </span>
              </>
            )}
          </div>
        )}
        {!message.meta && <div />}
        {/* Copy button - right side */}
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

