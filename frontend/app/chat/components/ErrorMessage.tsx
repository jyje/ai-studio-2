'use client';

import { useTranslation } from '@/app/i18n/hooks/useTranslation';

interface ErrorMessageProps {
  error: Error;
  onClose: () => void;
}

export default function ErrorMessage({ error, onClose }: ErrorMessageProps) {
  const { t } = useTranslation();
  
  return (
    <div className="fixed top-0 w-full max-w-md p-4 text-white bg-red-500 z-50">
      <div className="flex justify-between items-center">
        <span>{t('error.prefix')} {error.message}</span>
        <button
          onClick={onClose}
          className="ml-4 text-white hover:text-gray-200 cursor-pointer"
        >
          ×
        </button>
      </div>
    </div>
  );
}

