import React, { useState } from 'react';
import { useI18n } from '../hooks/useI18n';
import Icon from './Icon';
import { PIN_AUTH_SERVICE_URL } from '../constants';

interface PinValidationProps {
  onSuccess: () => void;
  appId: string;
}

const PinValidation: React.FC<PinValidationProps> = ({ onSuccess, appId }) => {
  const { t } = useI18n();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isShaking, setIsShaking] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const triggerError = (errorMessageKey: string) => {
    setError(t(errorMessageKey));
    setPin('');
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 820);
    setIsVerifying(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsVerifying(true);

    try {
      const response = await fetch(PIN_AUTH_SERVICE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ pin, appId }),
      });

      if (response.ok) {
        // Success! Simulate a short network delay for better UX.
        setTimeout(() => {
            onSuccess();
        }, 300);
      } else {
         // Handle specific error codes from the service.
         if (response.status === 404) {
             triggerError('pinCodePage.errorUsedOrNotFound');
         } else {
             triggerError('pinCodePage.error');
         }
      }
    } catch (err) {
      console.error('PIN validation network error:', err);
      triggerError('pinCodePage.errorNetwork');
    }
  };
  
  const isSubmitDisabled = pin.length < 4 || isVerifying;

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-900 text-white p-4">
      <div className="w-full max-w-sm text-center">
        <Icon name="logo" className="w-20 h-20 text-indigo-400 mx-auto mb-6" />
        <h1 className="text-3xl font-bold mb-2">{t('pinCodePage.title')}</h1>
        <p className="text-gray-400 mb-8">{t('pinCodePage.subtitle')}</p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className={isShaking ? 'animate-shake' : ''}>
            <input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder={t('pinCodePage.placeholder')}
              className="form-input w-full bg-gray-800 border-2 border-gray-700 rounded-lg text-center text-2xl tracking-[0.5em] py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
              maxLength={8}
              autoFocus
            />
            {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
          </div>
          <button
            type="submit"
            disabled={isSubmitDisabled}
            className="w-full py-3 px-4 border border-transparent text-base font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 focus:ring-offset-gray-900 disabled:bg-indigo-800 disabled:text-gray-400 disabled:cursor-not-allowed transition flex items-center justify-center"
          >
            {isVerifying ? t('pinCodePage.verifying') : t('pinCodePage.button')}
          </button>
        </form>
      </div>
    </div>
  );
};

export default PinValidation;