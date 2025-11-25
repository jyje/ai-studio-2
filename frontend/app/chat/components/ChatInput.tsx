'use client';

import { useTranslation } from '@/app/i18n/hooks/useTranslation';
import { useEffect, useRef, useState } from 'react';
import { fetchModelInfo, ModelInfo } from '@/app/config';
import { FileUploadState } from '../hooks/useFileUpload';
import FileUploadButton from './FileUploadButton';
import AttachedFileList from './AttachedFileList';

interface ChatInputProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
  isLoading: boolean;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  onAbort?: () => void;
  // File upload props
  files?: FileUploadState[];
  onFilesSelected?: (files: FileList) => void;
  onRemoveFile?: (id: string) => void;
}

export default function ChatInput({
  value,
  onChange,
  onSubmit,
  isLoading,
  inputRef,
  onAbort,
  files = [],
  onFilesSelected,
  onRemoveFile,
}: ChatInputProps) {
  const { t } = useTranslation();
  const hasInput = value.trim().length > 0;
  const hasFiles = files.length > 0;
  const showSendButton = !isLoading && (hasInput || hasFiles);
  const showAbortButton = isLoading && onAbort;
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null);

  // Fetch model info on mount
  useEffect(() => {
    fetchModelInfo()
      .then(setModelInfo)
      .catch((err) => {
        console.error('Failed to fetch model info:', err);
      });
  }, []);

  // Auto-resize textarea based on content
  const resizeTextarea = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const newHeight = Math.min(textarea.scrollHeight, 400);
      textarea.style.height = `${newHeight}px`;
    }
  };

  useEffect(() => {
    resizeTextarea();
  }, [value]);

  // Handle input change with auto-resize
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e);
    // Resize after state update
    setTimeout(() => {
      resizeTextarea();
    }, 0);
  };

  // Handle Enter key: submit on Enter, newline on Shift+Enter
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isLoading && (hasInput || hasFiles)) {
        onSubmit(e as any);
      }
    }
  };

  // Handle file selection from button
  const handleFilesSelected = (fileList: FileList) => {
    if (onFilesSelected) {
      onFilesSelected(fileList);
    }
  };

  // Handle file removal
  const handleRemoveFile = (id: string) => {
    if (onRemoveFile) {
      onRemoveFile(id);
    }
  };

  return (
    <form
      onSubmit={onSubmit}
      className="fixed bottom-0 left-0 right-0 w-full max-w-full md:max-w-2xl lg:max-w-4xl mx-auto p-2 mb-8 bg-white/90 dark:bg-[#252526]/95 backdrop-blur-sm border border-gray-300 dark:border-[#3e3e42] rounded-2xl shadow-xl dark:shadow-2xl"
    >
      {/* Attached files list */}
      {hasFiles && (
        <AttachedFileList files={files} onRemove={handleRemoveFile} />
      )}

      <div className="flex items-end">
        {/* File upload button */}
        {onFilesSelected && (
          <div className={`flex-shrink-0 ${modelInfo ? 'mb-6' : ''}`}>
            <FileUploadButton
              onFilesSelected={handleFilesSelected}
              disabled={isLoading}
            />
          </div>
        )}

        <div className="flex-1 flex flex-col">
          <textarea
            ref={(node) => {
              textareaRef.current = node;
              if (inputRef) {
                (inputRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = node;
              }
            }}
            className="w-full p-2 rounded-xl resize-none overflow-y-auto min-h-[40px] max-h-[400px] bg-transparent text-gray-900 dark:text-[#d4d4d4] placeholder:text-gray-400 dark:placeholder:text-[#858585] focus:outline-none"
            style={{ height: 'auto' }}
            value={value}
            placeholder={isLoading ? t('chatInput.placeholder.waiting') : t('chatInput.placeholder.default')}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            rows={1}
          />
          {/* Model and Agent Info */}
          {modelInfo && (
            <div className="flex items-center gap-3 mt-1 px-2 text-xs text-gray-500 dark:text-[#858585] h-5">
              <span>
                {t('chatInput.info.model')}: <span className="font-medium">{modelInfo.model}</span>
              </span>
              <span className="text-gray-300 dark:text-[#3e3e42]">|</span>
              <span>
                {t('chatInput.info.agent')}: <span className="font-medium">{modelInfo.agent}</span>
              </span>
            </div>
          )}
        </div>
        <div className={`relative overflow-hidden transition-all duration-200 ${
          showSendButton || showAbortButton
            ? 'opacity-100 scale-100 translate-x-0 ml-2 w-auto'
            : 'opacity-0 scale-95 translate-x-2 ml-0 w-0 pointer-events-none'
        } ${modelInfo ? 'mb-6' : ''}`}>
          {/* Send Button */}
          <button
            type="submit"
            className={`absolute inset-0 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-xl whitespace-nowrap transition-all duration-200 px-3 py-2 cursor-pointer ${
              showSendButton
                ? 'opacity-100 scale-100 translate-x-0 pointer-events-auto'
                : 'opacity-0 scale-95 translate-x-2 pointer-events-none'
            }`}
            title={t('chatInput.title.send')}
            disabled={!showSendButton}
          >
            {t('chatInput.button.send')}
          </button>
          {/* Abort Button */}
          <button
            type="button"
            onClick={onAbort}
            className={`absolute inset-0 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-xl whitespace-nowrap transition-all duration-200 px-3 py-2 cursor-pointer ${
              showAbortButton
                ? 'opacity-100 scale-100 translate-x-0 pointer-events-auto'
                : 'opacity-0 scale-95 -translate-x-2 pointer-events-none'
            }`}
            title={t('chatInput.title.abort')}
          >
            {t('chatInput.button.abort')}
          </button>
          {/* Spacer to maintain layout */}
          <div className="invisible px-3 py-2 text-sm whitespace-nowrap">
            {showAbortButton ? t('chatInput.button.abort') : t('chatInput.button.send')}
          </div>
        </div>
      </div>
    </form>
  );
}
