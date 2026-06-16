'use client';
import React, { createContext, useContext, useState, useEffect } from 'react';
import { dictionaries } from '@/lib/dictionaries';

type Language = 'es' | 'en';
type Dictionary = typeof dictionaries.es;

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  langDict: Dictionary;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>('es');
  
  const value = {
    language,
    setLanguage,
    langDict: dictionaries[language],
  };

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
