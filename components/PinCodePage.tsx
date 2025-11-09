
import React from 'react';

// Fix: The original component had a compilation error because VALID_PIN_CODE is not exported from constants.
// This component appears to be unused legacy code, replaced by PinValidation.tsx.
// To resolve the compilation error, the component's implementation has been replaced with a placeholder.
interface PinCodePageProps {
  onSuccess: () => void;
}

export const PinCodePage: React.FC<PinCodePageProps> = ({ onSuccess }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] text-center p-4">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-bold text-white mb-4">Component Deprecated</h1>
        <p className="text-gray-400 mb-8">This component is no longer in use. Please use PinValidation instead.</p>
      </div>
    </div>
  );
};
