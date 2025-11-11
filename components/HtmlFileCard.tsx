import React from 'react';
import { HtmlFile } from '../types';
import { StarIcon, ExpandIcon, TrashIcon, Spinner, CheckCircleIcon, AnalyticsIcon } from './icons';

interface HtmlFileCardProps {
  file: HtmlFile;
  previewUrl?: string;
  isSelected: boolean;
  onSetMain: (id: string) => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdateFileName: (id: string, newName: string) => void;
  onFullscreen: (file: HtmlFile, url: string) => void;
  onAnalyze: (id: string) => void;
  isAnalyzing: boolean;
}

export const HtmlFileCard: React.FC<HtmlFileCardProps> = ({
  file,
  previewUrl,
  isSelected,
  onSetMain,
  onSelect,
  onDelete,
  onUpdateFileName,
  onFullscreen,
  onAnalyze,
  isAnalyzing,
}) => {
  const totalPlaceholders = file.placeholders.length + Object.keys(file.linkPlaceholders).length;
  // FIX: Added `typeof v === 'string'` check to fix TypeScript error where `.trim()` was called on an `unknown` type.
  const filledPlaceholders =
    Object.values(file.placeholderValues).filter(v => typeof v === 'string' && v.trim() !== '').length +
    Object.values(file.linkPlaceholders).filter(v => typeof v === 'string' && v.trim() !== '').length;

  const isConfigured = totalPlaceholders > 0 && filledPlaceholders === totalPlaceholders;
  const completionText = totalPlaceholders > 0 ? `${filledPlaceholders}/${totalPlaceholders}` : 'Нет плейсхолдеров';

  return (
    <div className={`bg-gray-800 rounded-lg shadow-lg overflow-hidden transition-all duration-300 ${isSelected ? 'ring-2 ring-cyan-500' : 'ring-1 ring-gray-700'}`}>
      <div className="p-4">
        <div className="relative aspect-video bg-gray-700 rounded-md overflow-hidden mb-3 group">
          {previewUrl ? (
            <iframe src={previewUrl} className="w-full h-full border-0" sandbox="allow-scripts" title={`Preview of ${file.name}`} />
          ) : (
            <div className="w-full h-full flex items-center justify-center"><Spinner className="w-8 h-8 text-gray-500" /></div>
          )}
          <div className="absolute top-2 right-2 flex gap-2">
            <button
                onClick={() => previewUrl && onFullscreen(file, previewUrl)}
                className="p-1.5 bg-gray-900/50 rounded-full text-gray-300 hover:bg-gray-900/75 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label="Развернуть на весь экран"
            >
                <ExpandIcon className="w-4 h-4" />
            </button>
            <button
                onClick={() => onDelete(file.id)}
                className="p-1.5 bg-red-900/60 rounded-full text-red-300 hover:bg-red-800/80 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label="Удалить файл"
            >
                <TrashIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
        <input
          type="text"
          value={file.newFileName}
          disabled={file.isMain}
          onChange={(e) => onUpdateFileName(file.id, e.target.value)}
          className="w-full bg-gray-700 text-white p-2 rounded-md text-sm border border-gray-600 focus:ring-cyan-500 focus:border-cyan-500"
        />
        <div className="flex justify-between items-center mt-3">
          <button onClick={() => onSetMain(file.id)} className={`flex items-center gap-2 text-sm px-3 py-1 rounded-md transition-colors ${file.isMain ? 'text-yellow-300 bg-yellow-900/50' : 'text-gray-300 hover:bg-gray-700'}`}>
            <StarIcon className="w-4 h-4" /> {file.isMain ? 'Главная' : 'Сделать главной'}
          </button>
          <button onClick={() => onSelect(file.id)} className="text-sm text-cyan-400 hover:underline">
            Настроить
          </button>
        </div>
        <div className={`mt-3 pt-3 border-t border-gray-700 flex items-center gap-2 text-xs ${isConfigured ? 'text-green-400' : 'text-gray-400'}`}>
            <CheckCircleIcon className="w-4 h-4" />
            <span>Настроено: {completionText}</span>
        </div>
        <div className="mt-3">
             <button 
                onClick={() => onAnalyze(file.id)} 
                disabled={isAnalyzing}
                className="w-full flex justify-center items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white font-semibold py-2 px-3 rounded-md transition-colors disabled:bg-purple-800 disabled:cursor-not-allowed text-sm"
             >
                {isAnalyzing ? <Spinner className="w-5 h-5"/> : <AnalyticsIcon className="w-5 h-5"/>} 
                <span>{isAnalyzing ? 'Анализ...' : 'Провести AI-Анализ'}</span>
            </button>
        </div>
      </div>
    </div>
  );
};