'use client';

import { useState, useRef, useEffect } from 'react';
import { useChatStream } from './hooks/useChatStream';
import { getChatApiUrl } from '../config';
import { useTranslation } from '@/app/i18n/hooks/useTranslation';
import MessageBubble from './components/MessageBubble';
import ChatInput from './components/ChatInput';
import ErrorMessage from './components/ErrorMessage';

export default function Chat() {
  const { t } = useTranslation();
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef<boolean>(true);
  const { messages, isLoading, error, sendMessage, addMessage, abort, clearError } = useChatStream({
    apiUrl: getChatApiUrl(),
    t,
    onError: (err) => {
      console.error('Chat error:', err);
    },
  });

  // Get random 3 examples from welcome examples
  const getRandomExamples = (): string[] => {
    const allExamples = t('welcome.examples');
    const shuffled = [...allExamples].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 3);
  };

  // Initialize random examples on client side only to avoid hydration mismatch
  const [randomExamples, setRandomExamples] = useState<string[]>([]);
  const hasMessages = messages.length > 0;

  // Set random examples only on client side
  useEffect(() => {
    if (randomExamples.length === 0) {
      setRandomExamples(getRandomExamples());
    }
  }, []);

  // Check if user is at the bottom of the page scroll
  const isAtBottom = (): boolean => {
    const windowHeight = window.innerHeight;
    const documentHeight = document.documentElement.scrollHeight;
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    
    // Allow 100px threshold for better UX
    return documentHeight - scrollTop - windowHeight < 100;
  };

  // Scroll to bottom of page
  const scrollToBottom = () => {
    window.scrollTo({
      top: document.documentElement.scrollHeight,
      behavior: 'smooth',
    });
  };

  // Handle scroll event to detect if user scrolled up
  useEffect(() => {
    const handleScroll = () => {
      shouldAutoScrollRef.current = isAtBottom();
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Format messages for clipboard
  const formatMessagesForClipboard = (): string => {
    return messages
      .filter((msg) => msg.role !== 'system') // Exclude system messages from clipboard
      .map((msg) => {
        const role = msg.role === 'user' ? 'User' : 'Assistant';
        const timestamp = msg.timestamp
          ? new Date(msg.timestamp).toLocaleTimeString('ko-KR', {
              hour: '2-digit',
              minute: '2-digit',
            })
          : '';
        const header = timestamp ? `${role} (${timestamp})` : role;
        return `${header}\n${msg.content}\n`;
      })
      .join('\n---\n\n');
  };

  // Handle copy event to format conversation
  const handleCopy = async (e: React.ClipboardEvent) => {
    // Only intercept if copying from messages container
    if (!messagesContainerRef.current?.contains(e.target as Node)) {
      return;
    }

    // Check if Cmd+A was used (all text selected)
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return;
    }

    // Check if the selection covers most of the messages container
    const range = selection.getRangeAt(0);
    const containerText = messagesContainerRef.current.textContent || '';
    const selectedText = selection.toString();
    
    // If most of the container is selected, use formatted version
    if (selectedText.length > containerText.length * 0.5) {
      e.preventDefault();
      const formattedText = formatMessagesForClipboard();
      await navigator.clipboard.writeText(formattedText);
    }
  };

  // Handle Cmd+A to select all and copy formatted version
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Check for Cmd+A (Mac) or Ctrl+A (Windows/Linux)
    if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
      // Only handle if focus is in messages container
      if (messagesContainerRef.current?.contains(e.target as Node)) {
        e.preventDefault();
        
        // Select all text in messages container
        const range = document.createRange();
        range.selectNodeContents(messagesContainerRef.current);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
        
        // Copy formatted version
        setTimeout(async () => {
          const formattedText = formatMessagesForClipboard();
          await navigator.clipboard.writeText(formattedText);
        }, 0);
      }
    }
  };

  // Auto-focus on component mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Re-focus when loading completes
  useEffect(() => {
    if (!isLoading) {
      inputRef.current?.focus();
    }
  }, [isLoading]);

  // Handle ESC key to abort during loading
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle ESC when loading
      if (e.key === 'Escape' && isLoading) {
        e.preventDefault();
        abort();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLoading, abort]);

  // Auto-scroll when messages update (only if at bottom)
  useEffect(() => {
    if (shouldAutoScrollRef.current) {
      // Use requestAnimationFrame for smoother scrolling
      requestAnimationFrame(() => {
        scrollToBottom();
      });
    }
  }, [messages]);

  // Reset auto-scroll when user sends a new message
  useEffect(() => {
    if (isLoading) {
      shouldAutoScrollRef.current = true;
      scrollToBottom();
    }
  }, [isLoading]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    
    const messageContent = input;
    setInput('');
    await sendMessage(messageContent);
    // Maintain focus after sending message
    inputRef.current?.focus();
  };

  const handleExampleClick = (example: string) => {
    setInput(example);
    inputRef.current?.focus();
  };

  return (
    <div className="flex flex-col w-full max-w-full md:max-w-2xl lg:max-w-4xl py-24 mx-auto stretch px-4">
      {/* Welcome screen - only show when no messages */}
      {!hasMessages && (
        <div className="flex flex-col items-center justify-center min-h-[60vh] pb-32">
          <h1 className="text-5xl font-bold mb-12 text-gray-800 dark:text-[#cccccc]">
            {t('welcome.title')}
          </h1>
          <div className="flex flex-col gap-3 w-full max-w-2xl">
            {randomExamples.map((example, index) => (
              <button
                key={index}
                onClick={() => handleExampleClick(example)}
                className="text-left p-4 rounded-xl border border-gray-300 dark:border-[#3e3e42] bg-white dark:bg-[#252526] hover:bg-gray-50 dark:hover:bg-[#2d2d30] transition-colors shadow-sm hover:shadow-md cursor-pointer"
              >
                <span className="text-gray-700 dark:text-[#cccccc]">{example}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div
        ref={messagesContainerRef}
        className="flex flex-col gap-4 pb-32 outline-none select-text"
        onCopy={handleCopy}
        onKeyDown={handleKeyDown}
        tabIndex={0}
      >
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}
      </div>

      {error && <ErrorMessage error={error} onClose={clearError} />}
      <ChatInput
        value={input}
        onChange={handleInputChange}
        onSubmit={handleSubmit}
        isLoading={isLoading}
        inputRef={inputRef}
        onAbort={abort}
      />
    </div>
  );
}
