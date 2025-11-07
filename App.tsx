
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { SiteFile, HtmlFile } from './types';
import { optimizeFileName } from './services/geminiService';
import { StarIcon, UploadIcon, MagicIcon, ZipIcon, HelpIcon, Spinner, ExpandIcon } from './components/icons';
import Modal from './components/Modal';
import JSZip from 'jszip';
import saveAs from 'file-saver';
import { HelpContent } from './components/HelpContent';

const App: React.FC = () => {
    const [appState, setAppState] = useState<'welcome' | 'main'>('welcome');
    const [files, setFiles] = useState<SiteFile[]>([]);
    const [htmlFiles, setHtmlFiles] = useState<HtmlFile[]>([]);
    const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<Record<string, boolean>>({ optimizing: false, zipping: false });
    const [notification, setNotification] = useState<{ message: string; type: 'info' | 'success' | 'error' } | null>(null);
    const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
    const [isDeployModalOpen, setIsDeployModalOpen] = useState(false);
    const [fullscreenPreviewFile, setFullscreenPreviewFile] = useState<HtmlFile | null>(null);
    const [globalScripts, setGlobalScripts] = useState<string>('');
    
    const [apiKey, setApiKey] = useState<string>('');
    const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
    const [apiKeyInput, setApiKeyInput] = useState('');

    useEffect(() => {
        const storedKey = localStorage.getItem('geminiApiKey');
        if (storedKey) {
            setApiKey(storedKey);
            setApiKeyInput(storedKey);
        }
    }, []);

    const deploymentInstructions = useMemo(() => getDeploymentInstructions(), []);

    const resetState = () => {
        files.forEach(file => file.objectUrl && URL.revokeObjectURL(file.objectUrl));
        htmlFiles.forEach(file => file.previewUrl && URL.revokeObjectURL(file.previewUrl));
        setFiles([]);
        setHtmlFiles([]);
        setSelectedFileId(null);
        setNotification(null);
        setGlobalScripts('');
        setAppState('welcome');
    };

    const processFiles = useCallback(async (uploadedFiles: FileList | null) => {
        if (!uploadedFiles) return;
        // Reset only file-related state, not appState
        files.forEach(file => file.objectUrl && URL.revokeObjectURL(file.objectUrl));
        htmlFiles.forEach(file => file.previewUrl && URL.revokeObjectURL(file.previewUrl));
        setFiles([]);
        setHtmlFiles([]);
        setSelectedFileId(null);
        setNotification(null);
        setGlobalScripts('');

        const filePromises: Promise<SiteFile>[] = Array.from(uploadedFiles).map(file => {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                const path = (file as any).webkitRelativePath || file.name;

                reader.onload = (e) => {
                    const content = e.target?.result;
                    if (content) {
                        const newFile: SiteFile = {
                            id: `${path}-${file.lastModified}`,
                            path,
                            name: file.name,
                            content: content,
                            type: file.type,
                        };
                        resolve(newFile);
                    } else {
                        reject(new Error(`Failed to read file: ${file.name}`));
                    }
                };
                reader.onerror = reject;

                if (file.type.startsWith('text/') || file.type === 'application/javascript') {
                    reader.readAsText(file);
                } else {
                    reader.readAsArrayBuffer(file);
                }
            });
        });

        const allFiles = await Promise.all(filePromises);
        
        const fileMap = new Map<string, SiteFile>();
        allFiles.forEach(f => {
             const objectUrl = URL.createObjectURL(new Blob([f.content], { type: f.type }));
             const fileWithUrl = {...f, objectUrl};
             fileMap.set(f.path, fileWithUrl);
        });
        
        const processedHtmlFiles: HtmlFile[] = [];
        let totalPlaceholders = 0;

        for (const file of allFiles) {
            if (file.type === 'text/html') {
                const content = file.content as string;
                const placeholderRegex = /(?:\[\[|{{)\s*(.*?)\s*(?:\]\]|}})/g;
                const placeholders = [...new Set(Array.from(content.matchAll(placeholderRegex), m => m[1].trim()))];
                totalPlaceholders += placeholders.length;

                const placeholderValues = placeholders.reduce((acc, p) => ({ ...acc, [p]: '' }), {});
                
                const previewUrl = await createPreviewUrl(content, file.path, fileMap);
                
                processedHtmlFiles.push({
                    ...file,
                    content,
                    isMain: false,
                    newFileName: file.name,
                    placeholders,
                    placeholderValues,
                    previewUrl
                });
            }
        }
        
        setFiles(Array.from(fileMap.values()));
        setHtmlFiles(processedHtmlFiles);

        if (totalPlaceholders > 0) {
            setNotification({ message: "Найдены плейсхолдеры! Выберите страницу, чтобы их настроить.", type: 'success' });
        } else {
            setNotification({ message: "Плейсхолдеры для настройки не найдены. Вы можете упаковать сайт как есть.", type: 'info' });
        }
    }, [files, htmlFiles]);
    
    useEffect(() => {
        const updatePreviews = async () => {
            // FIX: Explicitly type `fileMap` to resolve a TypeScript type inference issue.
            const fileMap: Map<string, SiteFile> = new Map(files.map(f => [f.path, f]));
            const updatedHtmlFiles = await Promise.all(htmlFiles.map(async (hf) => {
                 if (hf.id === selectedFileId) {
                     URL.revokeObjectURL(hf.previewUrl);
                     const substitutedContent = substitutePlaceholders(hf.content, hf.placeholderValues);
                     const newPreviewUrl = await createPreviewUrl(substitutedContent, hf.path, fileMap);
                     return { ...hf, previewUrl: newPreviewUrl };
                 }
                 return hf;
            }));
            setHtmlFiles(updatedHtmlFiles);
        };
        if(selectedFileId) updatePreviews();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [htmlFiles.find(hf => hf.id === selectedFileId)?.placeholderValues]);


    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        processFiles(e.target.files);
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            processFiles(e.dataTransfer.files);
        }
    };
    
    const setMainPage = (id: string) => {
        setHtmlFiles(prev => prev.map(file => ({
            ...file,
            isMain: file.id === id,
            newFileName: file.id === id ? 'index.html' : file.name,
        })));
        setSelectedFileId(id);
    };

    const handleOptimizeNames = async () => {
        setNotification(null);

        if (!apiKey) {
            setIsApiKeyModalOpen(true);
            return;
        }

        setIsLoading(prev => ({ ...prev, optimizing: true }));
        try {
            const promises = htmlFiles.map(async file => {
                if (file.isMain) return file;
                const newName = await optimizeFileName(file.content, apiKey);
                return { ...file, newFileName: `${newName}.html` };
            });
            const optimizedFiles = await Promise.all(promises);
            setHtmlFiles(optimizedFiles);
            setNotification({ message: 'Имена файлов успешно оптимизированы!', type: 'success' });
        } catch (error) {
            console.error("Error during filename optimization:", error);
            if (error instanceof Error) {
                setNotification({ message: error.message, type: 'error' });
                if (error.message.includes('Неверный API ключ')) {
                    setApiKey('');
                    localStorage.removeItem('geminiApiKey');
                    setApiKeyInput('');
                    setIsApiKeyModalOpen(true);
                }
            } else {
                setNotification({ message: "Произошла неизвестная ошибка.", type: 'error' });
            }
        } finally {
            setIsLoading(prev => ({ ...prev, optimizing: false }));
        }
    };

    const handlePackageZip = async () => {
        setIsLoading(prev => ({ ...prev, zipping: true }));
        const zip = new JSZip();
        
        const htmlFileNameMap = new Map(htmlFiles.map(f => [f.name, f.newFileName]));

        // Process HTML files
        for (const htmlFile of htmlFiles) {
            let finalContent = substitutePlaceholders(htmlFile.content, htmlFile.placeholderValues);
            
            // Update relative links
            finalContent = finalContent.replace(/(href|src)=["'](?!https?:\/\/)([^"']+)["']/g, (match, attr, path) => {
                const baseName = path.split('/').pop();
                if(baseName && htmlFileNameMap.has(baseName)) {
                    const newPath = path.replace(baseName, htmlFileNameMap.get(baseName)!);
                    return `${attr}="${newPath}"`;
                }
                return match;
            });
            
            // Inject global scripts
            if (globalScripts.trim()) {
                finalContent = finalContent.replace('</head>', `${globalScripts.trim()}\n</head>`);
            }


            zip.file(htmlFile.newFileName, finalContent);
        }

        // Add other files
        files.forEach(file => {
            if (file.type !== 'text/html') {
                zip.file(file.path, file.content);
            }
        });
        
        zip.file("README.md", deploymentInstructions);
        zip.file("vercel.json", JSON.stringify({}, null, 2));

        try {
            const content = await zip.generateAsync({ type: 'blob' });
            saveAs(content, 'deploy.zip');
            setIsDeployModalOpen(true);
        } catch (error) {
            console.error("Error creating ZIP file:", error);
        } finally {
            setIsLoading(prev => ({ ...prev, zipping: false }));
        }
    };
    
    const handlePlaceholderChange = (fileId: string, placeholder: string, value: string) => {
        setHtmlFiles(prev => prev.map(f => {
            if (f.id === fileId) {
                return {
                    ...f,
                    placeholderValues: {
                        ...f.placeholderValues,
                        [placeholder]: value
                    }
                };
            }
            return f;
        }));
    };

    const handleSaveApiKey = () => {
        const trimmedKey = apiKeyInput.trim();
        if (trimmedKey) {
            setApiKey(trimmedKey);
            localStorage.setItem('geminiApiKey', trimmedKey);
            setIsApiKeyModalOpen(false);
            setNotification({ message: 'API ключ сохранен. Теперь вы можете попробовать оптимизировать имена снова.', type: 'success' });
        } else {
            setNotification({ message: 'API ключ не может быть пустым.', type: 'error' });
        }
    };
    
    const selectedFileData = useMemo(() => htmlFiles.find(f => f.id === selectedFileId), [htmlFiles, selectedFileId]);
    const hasMainPage = useMemo(() => htmlFiles.some(f => f.isMain), [htmlFiles]);

    const notificationColorClasses = {
        success: 'bg-green-900/50 text-green-300',
        info: 'bg-blue-900/50 text-blue-300',
        error: 'bg-red-900/50 text-red-300',
    };

    const WelcomeScreen = () => (
        <div className="flex flex-col items-center justify-center min-h-[80vh] text-center p-4">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">Упаковщик статичных сайтов</h1>
            <p className="max-w-2xl text-lg text-gray-400 mb-12">
                Загрузите свой статичный сайт, настройте его с помощью динамических плейсхолдеров, оптимизируйте имена файлов с помощью ИИ и упакуйте все в готовый для развертывания ZIP-архив.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-5xl mb-12">
                <div className="bg-gray-800/50 p-6 rounded-lg">
                    <UploadIcon className="w-8 h-8 mx-auto mb-3 text-cyan-400"/>
                    <h3 className="font-semibold text-white">1. Загрузка</h3>
                    <p className="text-sm text-gray-400">Перетащите папку или отдельные файлы вашего сайта (HTML, CSS, JS, изображения).</p>
                </div>
                <div className="bg-gray-800/50 p-6 rounded-lg">
                    <StarIcon className="w-8 h-8 mx-auto mb-3 text-cyan-400"/>
                    <h3 className="font-semibold text-white">2. Настройка</h3>
                    <p className="text-sm text-gray-400">Заполните плейсхолдеры и выберите главную страницу.</p>
                </div>
                <div className="bg-gray-800/50 p-6 rounded-lg">
                    <MagicIcon className="w-8 h-8 mx-auto mb-3 text-cyan-400"/>
                    <h3 className="font-semibold text-white">3. Оптимизация</h3>
                    <p className="text-sm text-gray-400">Используйте ИИ для создания SEO-дружелюбных имен файлов.</p>
                </div>
                <div className="bg-gray-800/50 p-6 rounded-lg">
                    <ZipIcon className="w-8 h-8 mx-auto mb-3 text-cyan-400"/>
                    <h3 className="font-semibold text-white">4. Упаковка</h3>
                    <p className="text-sm text-gray-400">Получите ZIP-архив, готовый к публикации на GitHub Pages или Vercel.</p>
                </div>
            </div>
            <button 
                onClick={() => setAppState('main')}
                className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 px-8 rounded-lg text-lg transition-transform transform hover:scale-105"
            >
                Начать работу
            </button>
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-900 text-gray-200 p-4 sm:p-6 lg:p-8">
            <div className="max-w-7xl mx-auto">
                <header className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-3xl font-bold text-white">Упаковщик статичных сайтов</h1>
                        <p className="text-gray-400">Для GitHub Pages и Vercel</p>
                    </div>
                    <button onClick={() => setIsHelpModalOpen(true)} className="p-2 rounded-full hover:bg-gray-700 transition-colors">
                        <HelpIcon className="w-6 h-6 text-gray-400"/>
                    </button>
                </header>
                
                {appState === 'welcome' && <WelcomeScreen />}
                
                {appState === 'main' && (
                    files.length === 0 ? (
                        <div
                            onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                            onDragLeave={() => setIsDragging(false)}
                            onDrop={handleDrop}
                            className={`relative border-2 border-dashed rounded-lg p-12 text-center transition-colors duration-300 ${isDragging ? 'border-cyan-500 bg-gray-800' : 'border-gray-600 hover:border-cyan-400'}`}
                        >
                            <input
                                type="file"
                                id="folder-upload"
                                className="hidden"
                                onChange={handleFileChange}
                                multiple
                                {...{ webkitdirectory: "", directory: "" }}
                            />
                             <input
                                type="file"
                                id="files-upload"
                                className="hidden"
                                onChange={handleFileChange}
                                multiple
                            />
                            <div className="flex flex-col items-center">
                                <UploadIcon className="w-12 h-12 text-gray-500 mb-4"/>
                                <span className="text-xl font-medium text-white">Перетащите папку или файлы сюда</span>
                                <span className="text-gray-400 mt-1 mb-4">или выберите способ загрузки</span>
                                <div className="flex flex-col sm:flex-row gap-4">
                                    <label htmlFor="folder-upload" className="cursor-pointer text-cyan-400 font-semibold hover:text-cyan-300 bg-gray-700 hover:bg-gray-600 px-6 py-3 rounded-lg transition-colors">
                                        Выбрать папку
                                    </label>
                                    <label htmlFor="files-upload" className="cursor-pointer text-cyan-400 font-semibold hover:text-cyan-300 bg-gray-700 hover:bg-gray-600 px-6 py-3 rounded-lg transition-colors">
                                        Выбрать файлы
                                    </label>
                                </div>
                            </div>
                             <button onClick={resetState} className="absolute bottom-4 right-4 text-sm text-gray-500 hover:text-gray-300 transition-colors">
                                ← Назад
                            </button>
                        </div>
                    ) : (
                        <main className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            <div className="lg:col-span-2">
                               {notification && (
                                    <div className={`p-4 rounded-lg mb-4 text-sm ${notificationColorClasses[notification.type]}`}>
                                        {notification.message}
                                    </div>
                                )}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {htmlFiles.map(file => (
                                        <div key={file.id} className={`bg-gray-800 rounded-lg shadow-lg overflow-hidden transition-all duration-300 ${selectedFileId === file.id ? 'ring-2 ring-cyan-500' : 'ring-1 ring-gray-700'}`}>
                                            <div className="p-4">
                                                <div className="relative aspect-video bg-gray-700 rounded-md overflow-hidden mb-3 group">
                                                   <iframe
                                                        src={file.previewUrl}
                                                        className="w-full h-full border-0"
                                                        sandbox="allow-scripts"
                                                        title={`Preview of ${file.name}`}
                                                    />
                                                    <button
                                                        onClick={() => setFullscreenPreviewFile(file)}
                                                        className="absolute top-2 right-2 p-1.5 bg-gray-900/50 rounded-full text-gray-300 hover:bg-gray-900/75 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                                        aria-label="Развернуть на весь экран"
                                                    >
                                                        <ExpandIcon className="w-4 h-4" />
                                                    </button>
                                                </div>
                                                <input
                                                    type="text"
                                                    value={file.newFileName}
                                                    disabled={file.isMain}
                                                    onChange={(e) => setHtmlFiles(prev => prev.map(f => f.id === file.id ? {...f, newFileName: e.target.value} : f))}
                                                    className="w-full bg-gray-700 text-white p-2 rounded-md text-sm border border-gray-600 focus:ring-cyan-500 focus:border-cyan-500"
                                                />
                                                <div className="flex justify-between items-center mt-3">
                                                    <button
                                                        onClick={() => setMainPage(file.id)}
                                                        className={`flex items-center gap-2 text-sm px-3 py-1 rounded-md transition-colors ${file.isMain ? 'text-yellow-300 bg-yellow-900/50' : 'text-gray-300 hover:bg-gray-700'}`}
                                                    >
                                                        <StarIcon className="w-4 h-4"/>
                                                        {file.isMain ? 'Главная' : 'Сделать главной'}
                                                    </button>
                                                    <button onClick={() => setSelectedFileId(file.id)} className="text-sm text-cyan-400 hover:underline">
                                                        Настроить
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
    
                            <aside className="lg:col-span-1">
                                <div className="sticky top-8 bg-gray-800 rounded-lg p-6 shadow-lg">
                                    <div className="pb-6 border-b border-gray-700">
                                        <h2 className="text-xl font-semibold mb-4 text-white">Настройки страницы</h2>
                                        {selectedFileData ? (
                                            selectedFileData.placeholders.length > 0 ? (
                                                <form className="space-y-4">
                                                    {selectedFileData.placeholders.map(p => (
                                                        <div key={p}>
                                                            <label htmlFor={p} className="block text-sm font-medium text-gray-300 mb-1">{p}</label>
                                                            <input
                                                                type="text"
                                                                id={p}
                                                                value={selectedFileData.placeholderValues[p] || ''}
                                                                onChange={(e) => handlePlaceholderChange(selectedFileData.id, p, e.target.value)}
                                                                className="w-full bg-gray-700 text-white p-2 rounded-md text-sm border border-gray-600 focus:ring-cyan-500 focus:border-cyan-500"
                                                            />
                                                        </div>
                                                    ))}
                                                </form>
                                            ) : <p className="text-gray-400">На этой странице нет плейсхолдеров.</p>
                                        ) : (
                                            <p className="text-gray-400">Выберите HTML файл для настройки его плейсхолдеров.</p>
                                        )}
                                    </div>
                                    <div className="py-6 border-b border-gray-700">
                                        <h2 className="text-xl font-semibold mb-4 text-white">Глобальные скрипты</h2>
                                        <p className="text-sm text-gray-400 mb-3">Код отсюда (например, Яндекс.Метрика) будет добавлен перед `&lt;/head&gt;` на всех страницах.</p>
                                        <textarea
                                            rows={5}
                                            value={globalScripts}
                                            onChange={(e) => setGlobalScripts(e.target.value)}
                                            className="w-full bg-gray-700 text-white p-2 rounded-md text-sm border border-gray-600 focus:ring-cyan-500 focus:border-cyan-500 font-mono"
                                            placeholder="<!-- Yandex.Metrika counter -->..."
                                        />
                                    </div>
                                    <div className="mt-6 space-y-3">
                                        <button
                                            onClick={handleOptimizeNames}
                                            disabled={isLoading.optimizing}
                                            className="w-full flex justify-center items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2 px-4 rounded-md transition-colors disabled:bg-indigo-800 disabled:cursor-not-allowed"
                                        >
                                            {isLoading.optimizing ? <Spinner className="w-5 h-5"/> : <MagicIcon className="w-5 h-5"/>}
                                            <span>Оптимизировать имена</span>
                                        </button>
                                         <button
                                            onClick={handlePackageZip}
                                            disabled={!hasMainPage || isLoading.zipping}
                                            className="w-full flex justify-center items-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold py-2 px-4 rounded-md transition-colors disabled:bg-cyan-800 disabled:cursor-not-allowed"
                                        >
                                            {isLoading.zipping ? <Spinner className="w-5 h-5"/> : <ZipIcon className="w-5 h-5"/>}
                                            <span>Подготовить для GitHub</span>
                                        </button>
                                         <button onClick={resetState} className="w-full text-center text-sm text-gray-400 hover:text-red-400 transition-colors mt-2">
                                            Начать заново
                                        </button>
                                    </div>
                                </div>
                            </aside>
                        </main>
                    )
                )}
            </div>
            
             <Modal isOpen={isHelpModalOpen} onClose={() => setIsHelpModalOpen(false)} title="Описание и инструкция">
                <HelpContent />
            </Modal>

            <Modal isOpen={isApiKeyModalOpen} onClose={() => setIsApiKeyModalOpen(false)} title="Введите ваш API ключ Google Gemini">
                <div className="space-y-4 text-gray-300">
                    <p>Для оптимизации имен файлов с помощью ИИ требуется API ключ от Google AI Studio. Этот ключ будет сохранен в вашем браузере и не будет никуда отправлен.</p>
                    
                    <div>
                        <label htmlFor="api-key-input" className="block text-sm font-medium text-gray-300 mb-1">
                            API ключ
                        </label>
                        <input
                            id="api-key-input"
                            type="password"
                            value={apiKeyInput}
                            onChange={(e) => setApiKeyInput(e.target.value)}
                            className="w-full bg-gray-700 text-white p-2 rounded-md text-sm border border-gray-600 focus:ring-cyan-500 focus:border-cyan-500"
                            placeholder="Введите ваш ключ..."
                        />
                    </div>
                    <p className="text-sm text-gray-400">
                        Вы можете получить свой ключ в <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">Google AI Studio</a>.
                    </p>
                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-700">
                        <button onClick={() => setIsApiKeyModalOpen(false)} className="px-4 py-2 rounded-md text-sm font-medium text-gray-300 bg-gray-600 hover:bg-gray-500 transition-colors">
                            Отмена
                        </button>
                        <button onClick={handleSaveApiKey} className="px-4 py-2 rounded-md text-sm font-medium text-white bg-cyan-600 hover:bg-cyan-500 transition-colors">
                            Сохранить ключ
                        </button>
                    </div>
                </div>
            </Modal>

            <Modal isOpen={isDeployModalOpen} onClose={() => setIsDeployModalOpen(false)} title="Сайт готов к развертыванию!">
                <div className="space-y-4 text-gray-300 prose prose-invert prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: deploymentInstructions.replace(/\n/g, '<br />').replace(/`([^`]+)`/g, '<code>$1</code>') }}>
                </div>
            </Modal>

            {fullscreenPreviewFile && (
                <Modal 
                    isOpen={!!fullscreenPreviewFile} 
                    onClose={() => setFullscreenPreviewFile(null)} 
                    title={`Предпросмотр: ${fullscreenPreviewFile.name}`}
                    size="large"
                >
                    <iframe
                        key={fullscreenPreviewFile.id}
                        src={fullscreenPreviewFile.previewUrl}
                        className="w-full h-full border-0 rounded-md bg-white"
                        sandbox="allow-scripts"
                        title={`Fullscreen Preview of ${fullscreenPreviewFile.name}`}
                    />
                </Modal>
            )}
        </div>
    );
};

function escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

function substitutePlaceholders(content: string, values: Record<string, string>): string {
    let result = content;
    for (const [key, value] of Object.entries(values)) {
        const escapedKey = escapeRegExp(key);
        const placeholder1 = new RegExp(`\\[\\[\\s*${escapedKey}\\s*\\]\\]`, 'g');
        const placeholder2 = new RegExp(`\\{\\{\\s*${escapedKey}\\s*\\}\\}`, 'g');
        result = result.replace(placeholder1, value);
        result = result.replace(placeholder2, value);
    }
    return result;
}

async function createPreviewUrl(htmlContent: string, htmlPath: string, fileMap: Map<string, SiteFile>): Promise<string> {
    let processedContent = htmlContent;
    
    // Create a DOM parser to find links
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');
    
    // Get base path
    const basePath = htmlPath.substring(0, htmlPath.lastIndexOf('/') + 1);

    const elementsToUpdate = doc.querySelectorAll<HTMLLinkElement | HTMLScriptElement | HTMLImageElement>('link[href], script[src], img[src]');
    
    for (const el of elementsToUpdate) {
        const originalPath = el.getAttribute('href') || el.getAttribute('src');
        if (!originalPath || originalPath.startsWith('http') || originalPath.startsWith('data:')) {
            continue;
        }

        const absolutePath = new URL(originalPath, `file:///${basePath}`).pathname.substring(1);
        
        const assetFile = fileMap.get(absolutePath);
        if (assetFile && assetFile.objectUrl) {
            processedContent = processedContent.replace(originalPath, assetFile.objectUrl);
        }
    }
    
    const blob = new Blob([processedContent], { type: 'text/html' });
    return URL.createObjectURL(blob);
}

function getDeploymentInstructions(): string {
    return `
### Ваш сайт готов!

Скачанный ZIP-архив содержит все необходимые файлы для развертывания.

---

#### 🚀 Вариант 1: GitHub Pages (Самый простой)

1.  Создайте новый публичный репозиторий на [GitHub](https://github.com/new). Назовите его \`<ваш-юзернейм>.github.io\`.
2.  Распакуйте архив и загрузите **все файлы** из него в этот репозиторий.
3.  Перейдите в настройки репозитория (\`Settings\` -> \`Pages\`).
4.  В разделе "Build and deployment" выберите источник (\`Source\`) \`Deploy from a branch\`.
5.  Выберите ветку \`main\` (или \`master\`) и папку \`/ (root)\`. Сохраните.
6.  Через несколько минут ваш сайт будет доступен по адресу \`https://<ваш-юзернейм>.github.io\`.

---

#### 🚀 Вариант 2: Vercel

1.  Зарегистрируйтесь или войдите на [Vercel](https://vercel.com) с помощью вашего GitHub аккаунта.
2.  Создайте новый репозиторий на GitHub и загрузите в него все файлы из распакованного архива.
3.  На дашборде Vercel нажмите \`Add New...\` -> \`Project\`.
4.  Импортируйте репозиторий, который вы только что создали.
5.  Vercel автоматически определит, что это статичный сайт. Просто нажмите \`Deploy\`.
6.  Ваш сайт будет развернут через минуту!
`;
}


export default App;
