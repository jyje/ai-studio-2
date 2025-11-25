'use client';

import { useTranslation } from '../i18n/hooks/useTranslation';

interface ContextMenuProps {
  onSettingsClick: () => void;
  onClose: () => void;
}

export default function ContextMenu({ onSettingsClick, onClose }: ContextMenuProps) {
  const { t } = useTranslation();

  return (
    <div className="absolute top-12 right-0 mt-2 w-48 bg-white dark:bg-[#252526] rounded-lg shadow-xl dark:shadow-2xl border border-gray-200 dark:border-[#3e3e42] py-1 z-[10000] pointer-events-auto">
      <button
        onClick={(e) => {
          e.stopPropagation();
          onSettingsClick();
          onClose();
        }}
        className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-[#cccccc] hover:bg-gray-100 dark:hover:bg-[#2d2d30] transition-colors flex items-center gap-2 cursor-pointer"
      >
        <svg
          className="w-4 h-4 text-gray-600 dark:text-[#858585]"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        {t('settings.menu')}
      </button>
    </div>
  );
}

