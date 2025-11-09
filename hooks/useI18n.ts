
import React from 'react';

const translations: Record<string, Record<string, string>> = {
  ru: {
    'pinCodePage.title': 'Подтвердите доступ',
    'pinCodePage.subtitle': 'Пожалуйста, введите ваш PIN-код для продолжения.',
    'pinCodePage.placeholder': 'PIN-КОД',
    'pinCodePage.button': 'Подтвердить',
    'pinCodePage.verifying': 'Проверка...',
    'pinCodePage.errorUsedOrNotFound': 'PIN-код не найден или уже был использован.',
    'pinCodePage.errorAccessDenied': 'Доступ к этому приложению запрещен для данного PIN-кода.',
    'pinCodePage.error': 'Произошла ошибка. Пожалуйста, попробуйте позже.',
    'pinCodePage.errorNetwork': 'Ошибка сети. Проверьте ваше подключение к интернету.',
  }
};

// Simple hook, defaulting to 'ru' language
export const useI18n = () => {
  const lang = 'ru';
  
  const t = (key: string): string => {
    return translations[lang]?.[key] || key;
  };
  
  return { t };
};
