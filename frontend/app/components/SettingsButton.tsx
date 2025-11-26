'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslation } from '../i18n/hooks/useTranslation';
import ContextMenu from './ContextMenu';
import SettingsModal from './SettingsModal';

export default function SettingsButton() {
  const { t } = useTranslation();
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        buttonRef.current &&
        menuRef.current &&
        !buttonRef.current.contains(event.target as Node) &&
        !menuRef.current.contains(event.target as Node)
      ) {
        setShowContextMenu(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (showSettingsModal) {
          setShowSettingsModal(false);
        } else if (showContextMenu) {
          setShowContextMenu(false);
        }
      }
    };

    if (showContextMenu || showSettingsModal) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('keydown', handleEscape);
      };
    }
  }, [showContextMenu, showSettingsModal]);

  const handleSettingsClick = () => {
    setShowContextMenu(false);
    setShowSettingsModal(true);
  };

  return (
    <>
      <div className="fixed top-4 right-4 z-[9999]">
        <button
          ref={buttonRef}
          onClick={() => setShowContextMenu(!showContextMenu)}
          className="p-2 rounded-lg bg-white dark:bg-[#252526]/95 backdrop-blur-sm border border-gray-300 dark:border-[#3e3e42] shadow-lg dark:shadow-xl hover:bg-gray-50 dark:hover:bg-[#2d2d30] transition-colors cursor-pointer"
          title={t('settings.menu')}
          aria-label={t('settings.menu')}
        >
          <svg
            className="w-5 h-5 text-gray-900 dark:text-[#cccccc]"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <circle cx="12" cy="12" r="1.5" />
            <circle cx="12" cy="5" r="1.5" />
            <circle cx="12" cy="19" r="1.5" />
          </svg>
        </button>
        {showContextMenu && (
          <div ref={menuRef}>
            <ContextMenu
              onSettingsClick={handleSettingsClick}
              onClose={() => setShowContextMenu(false)}
            />
          </div>
        )}
      </div>
      {showSettingsModal && (
        <SettingsModal onClose={() => setShowSettingsModal(false)} />
      )}
    </>
  );
}

