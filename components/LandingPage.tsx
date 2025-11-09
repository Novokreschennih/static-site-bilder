
import React from 'react';
import { UploadIcon, StarIcon, MagicIcon, ZipIcon } from './icons';

interface LandingPageProps {
    onEnter: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onEnter }) => {
    return (
        <div className="flex flex-col items-center justify-center min-h-[80vh] text-center p-4">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">Упаковщик статичных сайтов</h1>
            <p className="max-w-2xl text-lg text-gray-400 mb-12">
                Загрузите свой статичный сайт, настройте его с помощью динамических плейсхолдеров, оптимизируйте имена файлов с помощью ИИ и упакуйте все в готовый для развертывания ZIP-архив.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-5xl mb-12">
                <div className="bg-gray-800/50 p-6 rounded-lg"> <UploadIcon className="w-8 h-8 mx-auto mb-3 text-cyan-400"/> <h3 className="font-semibold text-white">1. Загрузка</h3> <p className="text-sm text-gray-400">Перетащите папку или отдельные файлы вашего сайта (HTML, CSS, JS, изображения).</p> </div>
                <div className="bg-gray-800/50 p-6 rounded-lg"> <StarIcon className="w-8 h-8 mx-auto mb-3 text-cyan-400"/> <h3 className="font-semibold text-white">2. Настройка</h3> <p className="text-sm text-gray-400">Заполните плейсхолдеры и выберите главную страницу.</p> </div>
                <div className="bg-gray-800/50 p-6 rounded-lg"> <MagicIcon className="w-8 h-8 mx-auto mb-3 text-cyan-400"/> <h3 className="font-semibold text-white">3. Оптимизация</h3> <p className="text-sm text-gray-400">Используйте ИИ для создания SEO-дружелюбных имен файлов.</p> </div>
                <div className="bg-gray-800/50 p-6 rounded-lg"> <ZipIcon className="w-8 h-8 mx-auto mb-3 text-cyan-400"/> <h3 className="font-semibold text-white">4. Упаковка</h3> <p className="text-sm text-gray-400">Получите ZIP-архив, готовый к публикации на GitHub Pages или Vercel.</p> </div>
            </div>
            <button onClick={onEnter} className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 px-8 rounded-lg text-lg transition-transform transform hover:scale-105">Начать работу</button>
        </div>
    );
};
