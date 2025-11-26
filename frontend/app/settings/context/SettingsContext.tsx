'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

export interface Settings {
  agentGraphExpanded: boolean;
}

interface SettingsContextType {
  settings: Settings;
  updateSettings: (newSettings: Partial<Settings>) => void;
  setAgentGraphExpanded: (expanded: boolean) => void;
}

const defaultSettings: Settings = {
  agentGraphExpanded: false, // Hidden by default
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

const SETTINGS_STORAGE_KEY = 'ai-studio-settings';

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [mounted, setMounted] = useState(false);

  // Load settings from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setSettings({ ...defaultSettings, ...parsed });
      }
    } catch (error) {
      console.error('Failed to load settings from localStorage:', error);
    }
    
    setMounted(true);
  }, []);

  // Save settings to localStorage when they change
  const saveSettings = (newSettings: Settings) => {
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(newSettings));
    } catch (error) {
      console.error('Failed to save settings to localStorage:', error);
    }
  };

  const updateSettings = (newSettings: Partial<Settings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      saveSettings(updated);
      return updated;
    });
  };

  const setAgentGraphExpanded = (expanded: boolean) => {
    updateSettings({ agentGraphExpanded: expanded });
  };

  // Always render the provider to avoid context errors
  // Use default settings until mounted to prevent hydration mismatch
  return (
    <SettingsContext.Provider value={{ 
      settings: mounted ? settings : defaultSettings, 
      updateSettings, 
      setAgentGraphExpanded 
    }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}

