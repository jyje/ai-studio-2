'use client';

import { useRef } from 'react';
import { useTranslation } from '@/app/i18n/hooks/useTranslation';
import { getAcceptedFileTypes } from '../utils/fileParser';

interface FileUploadButtonProps {
  onFilesSelected: (files: FileList) => void;
  disabled?: boolean;
}

export default function FileUploadButton({ 
  onFilesSelected, 
  disabled = false 
}: FileUploadButtonProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    inputRef.current?.click();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFilesSelected(e.target.files);
      // Reset input to allow selecting the same file again
      e.target.value = '';
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={getAcceptedFileTypes()}
        onChange={handleChange}
        className="hidden"
        aria-hidden="true"
      />
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        className={`
          flex items-center justify-center
          w-8 h-8 rounded-lg
          text-gray-500 dark:text-[#858585]
          hover:text-gray-700 dark:hover:text-[#d4d4d4]
          hover:bg-gray-100 dark:hover:bg-[#3e3e42]
          transition-colors duration-150
          cursor-pointer
          disabled:opacity-50 disabled:cursor-not-allowed
        `}
        title={t('fileUpload.button.title')}
        aria-label={t('fileUpload.button.title')}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-5 h-5"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
    </>
  );
}

