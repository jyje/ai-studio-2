'use client';

import { useTranslation } from '@/app/i18n/hooks/useTranslation';
import { FileUploadState } from '../hooks/useFileUpload';
import { formatFileSize } from '../utils/fileParser';

interface AttachedFileListProps {
  files: FileUploadState[];
  onRemove: (id: string) => void;
}

// File type icons
function FileIcon({ type }: { type: 'text' | 'pdf' | 'image' | 'unsupported' | 'pending' }) {
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

// Loading spinner
function Spinner() {
  return (
    <svg className="w-4 h-4 animate-spin text-blue-500" viewBox="0 0 24 24" fill="none">
      <circle 
        className="opacity-25" 
        cx="12" 
        cy="12" 
        r="10" 
        stroke="currentColor" 
        strokeWidth="4"
      />
      <path 
        className="opacity-75" 
        fill="currentColor" 
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

// Close/remove button
function CloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="
        flex items-center justify-center
        w-4 h-4 rounded-full
        text-gray-400 hover:text-gray-600
        dark:text-[#858585] dark:hover:text-[#d4d4d4]
        hover:bg-gray-200 dark:hover:bg-[#3e3e42]
        transition-colors duration-150
        cursor-pointer
      "
      aria-label="Remove file"
    >
      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
        <path d="M18 6L6 18M6 6l12 12" />
      </svg>
    </button>
  );
}

export default function AttachedFileList({ files, onRemove }: AttachedFileListProps) {
  const { t } = useTranslation();

  if (files.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 px-2 pb-2">
      {files.map((fileState) => {
        const isLoading = fileState.status === 'pending' || fileState.status === 'parsing';
        const isError = fileState.status === 'error';
        const fileType = fileState.parsedFile?.type || 'pending';

        return (
          <div
            key={fileState.id}
            className={`
              flex items-center gap-2 px-2 py-1.5 rounded-lg
              text-xs
              ${isError 
                ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800' 
                : 'bg-gray-100 dark:bg-[#3e3e42] border border-gray-200 dark:border-[#4e4e52]'
              }
            `}
          >
            {/* Icon or spinner */}
            {isLoading ? (
              <Spinner />
            ) : (
              <FileIcon type={fileType as any} />
            )}

            {/* File info */}
            <div className="flex flex-col min-w-0 flex-1">
              <span 
                className={`
                  truncate max-w-[150px] font-medium
                  ${isError 
                    ? 'text-red-700 dark:text-red-400' 
                    : 'text-gray-700 dark:text-[#d4d4d4]'
                  }
                `}
                title={fileState.file.name}
              >
                {fileState.file.name}
              </span>
              <span 
                className={`
                  text-xs
                  ${isError 
                    ? 'text-red-600 dark:text-red-500' 
                    : 'text-gray-500 dark:text-[#858585]'
                  }
                `}
                title={isError ? fileState.error : undefined}
              >
                {isLoading && fileState.progress > 0 
                  ? `${fileState.progress}%`
                  : isError 
                    ? (fileState.error || t('fileUpload.status.error'))
                    : formatFileSize(fileState.file.size)
                }
              </span>
            </div>

            {/* Remove button */}
            <CloseButton onClick={() => onRemove(fileState.id)} />
          </div>
        );
      })}
    </div>
  );
}

