
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { SiteFile, HtmlFile } from './types';
import { analyzeHtmlContent, optimizeFileName, applyAnalysisFixes } from './services/geminiService';
import { UploadIcon, MagicIcon, ZipIcon, HelpIcon, Spinner, SettingsIcon, ShieldCheckIcon, FolderPlusIcon, DocumentPlusIcon, AnalyticsIcon, EyeIcon, CodeBracketIcon } from './components/icons';
import { HtmlFileCard } from './components/HtmlFileCard';
import Modal from './components/Modal';
import JSZip from 'jszip';
import saveAs from 'file-saver';
import { HelpContent } from './components/HelpContent';
import { LegalContent } from './components/LegalContent';
import { useLocalStorage } from './hooks/useLocalStorage';
import useProjectState from './hooks/useProjectState';
import { AUTH_STORAGE_KEY, APP_ID } from './constants';
import { LandingPage } from './components/LandingPage';
import PinValidation from './components/PinValidation';
import { substituteAllPlaceholders, createPreviewUrl, getDeploymentInstructions, parseMarkdown } from './utils';


const App: React.FC = () => {
    const [isAuthenticated, setIsAuthenticated] = useLocalStorage<boolean>(AUTH_STORAGE_KEY, false);
    const [view, setView] = useState<'landing' | 'pin' | 'app'>('landing');
    
    const [{ files, htmlFiles, globalScripts }, updateProjectState, clearProjectState] = useProjectState();
    
    const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
    const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<{ optimizing: boolean; zipping: boolean; analyzingFileId: string | null; applyingFixes: boolean }>({ optimizing: false, zipping: false, analyzingFileId: null, applyingFixes: false });
    const [notification, setNotification] = useState<{ message: string; type: 'info' | 'success' | 'error' } | null>(null);
    const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
    const [isLegalModalOpen, setIsLegalModalOpen] = useState(false);
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const [isDeployModalOpen, setIsDeployModalOpen] = useState(false);
    const [isFullscreenPreview, setFullscreenPreview] = useState<{file: HtmlFile, viewMode: 'preview' | 'code'} | null>(null);
    const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
    
    const [apiKey, setApiKey] = useLocalStorage<string>('gemini-api-key', '');
    const [tempApiKey, setTempApiKey] = useState(apiKey);

    const [sidebarView, setSidebarView] = useState<'settings' | 'analysis'>('settings');
    const [currentAnalysisReport, setCurrentAnalysisReport] = useState<string | null>(null);
    const [isGlobalSettingsExpanded, setIsGlobalSettingsExpanded] = useState(false);

    useEffect(() => {
        setTempApiKey(apiKey);
    }, [apiKey, isSettingsModalOpen]);

    useEffect(() => {
        if (isAuthenticated) {
            setView('app');
        } else {
            setView('landing');
        }
    }, [isAuthenticated]);

    const deploymentInstructions = useMemo(() => getDeploymentInstructions(), []);

    const resetState = useCallback(() => {
        Object.values(previewUrls).forEach(URL.revokeObjectURL);
        clearProjectState();
        setPreviewUrls({});
        setSelectedFileId(null);
        setNotification(null);
        setSidebarView('settings');
        setCurrentAnalysisReport(null);
    }, [previewUrls, clearProjectState]);

    const handleEnterApp = () => {
        setView(isAuthenticated ? 'app' : 'pin');
    };

    const handlePinSuccess = () => {
        setIsAuthenticated(true);
    };
    
    const handleSelectFile = (id: string) => {
        setSelectedFileId(id);
        setSidebarView('settings');
        setCurrentAnalysisReport(null);
        setIsGlobalSettingsExpanded(false);
    };

    const handleLogout = useCallback(() => {
        resetState();
        setIsAuthenticated(false);
    }, [resetState, setIsAuthenticated]);

    const processFiles = useCallback(async (uploadedFileArray: File[]) => {
        if (!uploadedFileArray || uploadedFileArray.length === 0) return;

        let commonBasePath = '';
        if (uploadedFileArray.length > 1 && uploadedFileArray[0].webkitRelativePath) {
            const firstPath = uploadedFileArray[0].webkitRelativePath;
            const firstPathParts = firstPath.split('/');
            if (firstPathParts.length > 1) {
                const potentialBasePath = `${firstPathParts[0]}/`;
                if (uploadedFileArray.every(f => (f as any).webkitRelativePath && (f as any).webkitRelativePath.startsWith(potentialBasePath))) {
                    commonBasePath = potentialBasePath;
                }
            }
        }

        const existingFileIds = new Set(files.map(f => f.id));

        const filePromises: Promise<SiteFile | null>[] = uploadedFileArray
            .map(file => {
                return new Promise((resolve) => {
                    const originalPath = (file as any).webkitRelativePath || file.name;
                     const path = originalPath.startsWith(commonBasePath) ? originalPath.substring(commonBasePath.length) : originalPath;
                    const fileId = `${path}-${file.lastModified}`;
                    
                    if (!path || existingFileIds.has(fileId)) { resolve(null); return; }

                    const reader = new FileReader();
                    reader.onload = (e) => {
                        const content = e.target?.result;
                        if (content) {
                            const newFile: SiteFile = { id: fileId, path, name: file.name, content, type: file.type };
                            resolve(newFile);
                        } else { resolve(null); }
                    };
                    reader.onerror = () => resolve(null);

                    if (file.type.startsWith('text/') || file.type === 'application/javascript' || file.type === '') {
                        reader.readAsText(file);
                    } else {
                        reader.readAsArrayBuffer(file);
                    }
                });
            });

        const newFiles = (await Promise.all(filePromises)).filter((f): f is SiteFile => f !== null);
        if (newFiles.length === 0) {
            setNotification({ message: "Все выбранные файлы уже добавлены.", type: 'info'});
            return;
        };
        
        const newFilesWithUrls = newFiles.map(f => {
             const objectUrl = URL.createObjectURL(new Blob([f.content], { type: f.type }));
             return {...f, objectUrl};
        });
        
        const newHtmlFiles: HtmlFile[] = [];
        for (const file of newFilesWithUrls) {
            if (file.type === 'text/html') {
                const content = file.content as string;
                const placeholderRegex = /(?:\[\[|{{)\s*(.*?)\s*(?:\]\]|}})/g;
                const allMatches = Array.from(content.matchAll(placeholderRegex), m => m[1].trim());
                const allPlaceholders = [...new Set(allMatches)];
                const textPlaceholders = allPlaceholders.filter(p => !/^(link|url)_/i.test(p));
                const linkPlaceholderKeys = allPlaceholders.filter(p => /^(link|url)_/i.test(p));
                const placeholderValues = textPlaceholders.reduce((acc, p) => ({ ...acc, [p]: '' }), {});
                const linkPlaceholders = linkPlaceholderKeys.reduce((acc, p) => ({ ...acc, [p]: '' }), {});
                newHtmlFiles.push({ ...file, content, isMain: false, newFileName: file.name, placeholders: textPlaceholders, placeholderValues, linkPlaceholders });
            }
        }
        
        updateProjectState({
            files: [...files, ...newFilesWithUrls],
            htmlFiles: [...htmlFiles, ...newHtmlFiles],
        });
        setNotification({ message: `Добавлено ${newFiles.length} новых файлов.`, type: 'success' });
    }, [files, htmlFiles, updateProjectState]);
    
    useEffect(() => {
        const generateAllPreviews = async () => {
            const currentUrls = { ...previewUrls };
            const assetFileMap: Map<string, SiteFile> = new Map(files.map(f => [f.path, f]));
            const newPreviewUrls: Record<string, string> = {};

            for (const hf of htmlFiles) {
                // To avoid re-generating existing URLs if content hasn't changed, a more complex check would be needed.
                // For simplicity, we regenerate all, revoking old ones first.
                if (currentUrls[hf.id]) URL.revokeObjectURL(currentUrls[hf.id]);
                const substitutedContent = substituteAllPlaceholders(hf, htmlFiles);
                const url = await createPreviewUrl(substitutedContent, hf.path, assetFileMap);
                newPreviewUrls[hf.id] = url;
            }
            setPreviewUrls(newPreviewUrls);
        };

        if (htmlFiles.length > 0 || files.length > 0) {
            generateAllPreviews();
        }

        return () => {
            Object.values(previewUrls).forEach(URL.revokeObjectURL);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [files, htmlFiles]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) processFiles(Array.from(e.target.files));
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            processFiles(Array.from(e.dataTransfer.files));
        }
    };
    
    const setMainPage = (id: string) => {
        const oldMain = htmlFiles.find(f => f.isMain);
        const newHtmlFiles = htmlFiles.map(file => {
            let newFileName = file.newFileName;
            if (file.id === id) { newFileName = 'index.html'; } 
            else if (oldMain && file.id === oldMain.id) { newFileName = file.newFileName === 'index.html' ? file.name : file.newFileName; }
            return { ...file, isMain: file.id === id, newFileName: newFileName };
        });
        updateProjectState({ htmlFiles: newHtmlFiles });
        setSelectedFileId(id);
    };

    const handleDeleteFile = useCallback((fileIdToDelete: string) => {
        const fileToDelete = files.find(f => f.id === fileIdToDelete);
        if (!fileToDelete) return;

        if (fileToDelete.objectUrl) URL.revokeObjectURL(fileToDelete.objectUrl);
        if (previewUrls[fileIdToDelete]) URL.revokeObjectURL(previewUrls[fileIdToDelete]);

        const newHtmlFiles = htmlFiles
            .map(hf => {
                const newLinkPlaceholders = { ...hf.linkPlaceholders };
                let changed = false;
                for (const key in newLinkPlaceholders) {
                    if (newLinkPlaceholders[key] === fileIdToDelete) {
                        newLinkPlaceholders[key] = '';
                        changed = true;
                    }
                }
                return changed ? { ...hf, linkPlaceholders: newLinkPlaceholders } : hf;
            })
            .filter(hf => hf.id !== fileIdToDelete);

        updateProjectState({
            files: files.filter(f => f.id !== fileIdToDelete),
            htmlFiles: newHtmlFiles
        });
        
        setPreviewUrls(prev => { const newUrls = { ...prev }; delete newUrls[fileIdToDelete]; return newUrls; });
        if (selectedFileId === fileIdToDelete) { setSelectedFileId(null); }
        
        setNotification({ message: `Файл "${fileToDelete.name}" удален.`, type: 'info' });
    }, [files, htmlFiles, previewUrls, selectedFileId, updateProjectState]);


    const handleOptimizeNames = async () => {
        setNotification(null);
        if (!apiKey) {
            setNotification({ message: 'Пожалуйста, введите ваш API ключ в настройках.', type: 'error' });
            setIsSettingsModalOpen(true);
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
            updateProjectState({ htmlFiles: optimizedFiles });
            setNotification({ message: 'Имена файлов успешно оптимизированы!', type: 'success' });
        } catch (error) {
            console.error("Error during filename optimization:", error);
            if (error instanceof Error && error.message.includes("API-ключ недействителен")) {
                setNotification({ message: "Ваш API-ключ недействителен. Проверьте его в настройках.", type: 'error' });
                setIsSettingsModalOpen(true);
            } else if (error instanceof Error) {
                setNotification({ message: error.message, type: 'error' });
            } else { setNotification({ message: "Произошла неизвестная ошибка.", type: 'error' }); }
        } finally { setIsLoading(prev => ({ ...prev, optimizing: false })); }
    };

    const handleAnalyzeContent = async (fileId: string) => {
        setNotification(null);
        setSelectedFileId(fileId);
        setSidebarView('analysis');
        setCurrentAnalysisReport(null);

        if (!apiKey) {
            setNotification({ message: 'Пожалуйста, введите ваш API ключ в настройках.', type: 'error' });
            setIsSettingsModalOpen(true);
            setCurrentAnalysisReport('## Ошибка\n\nНеобходимо ввести API-ключ в настройках для использования этой функции.');
            return;
        }
        
        const fileToAnalyze = htmlFiles.find(f => f.id === fileId);
        if (!fileToAnalyze) return;

        setIsLoading(prev => ({ ...prev, analyzingFileId: fileId }));
        
        try {
            const report = await analyzeHtmlContent(fileToAnalyze.content, apiKey);
            setCurrentAnalysisReport(report);
        } catch (error) {
            console.error("Error during content analysis:", error);
            let errorMessage = "Произошла неизвестная ошибка при анализе.";
            if (error instanceof Error) {
                if (error.message.includes("API-ключ недействителен")) {
                    errorMessage = "Ваш API-ключ недействителен. Проверьте его в настройках.";
                    setIsSettingsModalOpen(true);
                } else {
                    errorMessage = error.message;
                }
            }
            setCurrentAnalysisReport(`## Ошибка анализа\n\n${errorMessage}`);
        } finally {
            setIsLoading(prev => ({ ...prev, analyzingFileId: null }));
        }
    };
    
    const handleApplyFixes = async () => {
        if (!selectedFileId) return;
        
        const fileToFix = htmlFiles.find(f => f.id === selectedFileId);
        if (!fileToFix) return;

        setIsLoading(prev => ({ ...prev, applyingFixes: true }));
        setNotification(null);

        try {
            const fixedHtml = await applyAnalysisFixes(fileToFix.content, apiKey);
            
            const newHtmlFiles = htmlFiles.map(f =>
                f.id === selectedFileId ? { ...f, content: fixedHtml } : f
            );
            const newFiles = files.map(f =>
                f.id === selectedFileId ? { ...f, content: fixedHtml } : f
            );
            
            updateProjectState({ files: newFiles, htmlFiles: newHtmlFiles });

            if (isFullscreenPreview && isFullscreenPreview.file.id === selectedFileId) {
                const updatedFile = newHtmlFiles.find(f => f.id === selectedFileId);
                if(updatedFile) {
                    setFullscreenPreview(prev => prev ? { ...prev, file: updatedFile } : null);
                }
            }
            
            setCurrentAnalysisReport(null);
            setNotification({ message: `Изменения успешно применены! Проведите аудит заново, чтобы увидеть обновленный отчет.`, type: 'success' });
        } catch (error) {
            console.error("Error applying fixes:", error);
            let errorMessage = "Произошла неизвестная ошибка при применении исправлений.";
            if (error instanceof Error) {
                errorMessage = error.message;
            }
            setNotification({ message: errorMessage, type: 'error' });
        } finally {
            setIsLoading(prev => ({ ...prev, applyingFixes: false }));
        }
    };


    const handlePackageZip = async () => {
        setIsLoading(prev => ({ ...prev, zipping: true }));
        const zip = new JSZip();
        const htmlFileNameMap = new Map(htmlFiles.map(f => [f.name, f.newFileName]));
        const htmlFilePathMap = new Map(htmlFiles.map(f => [f.path, f.newFileName]));
        for (const htmlFile of htmlFiles) {
            let finalContent = substituteAllPlaceholders(htmlFile, htmlFiles);
            finalContent = finalContent.replace(/(href|src)=["'](?!https?:\/\/)([^"']+)["']/g, (match, attr, path) => {
                const fullPath = new URL(path, `file:///${htmlFile.path.substring(0, htmlFile.path.lastIndexOf('/') + 1)}`).pathname.substring(1);
                if(htmlFilePathMap.has(fullPath)) {
                    const newName = htmlFilePathMap.get(fullPath)!; const newPath = path.substring(0, path.lastIndexOf('/') + 1) + newName;
                    return `${attr}="${newPath}"`;
                }
                const baseName = path.split('/').pop();
                if(baseName && htmlFileNameMap.has(baseName)) { const newPath = path.replace(baseName, htmlFileNameMap.get(baseName)!); return `${attr}="${newPath}"`; }
                return match;
            });
            if (globalScripts.trim()) { finalContent = finalContent.replace('</head>', `${globalScripts.trim()}\n</head>`); }
            const finalPath = htmlFile.path.substring(0, htmlFile.path.lastIndexOf('/') + 1) + htmlFile.newFileName;
            zip.file(finalPath, finalContent);
        }
        files.forEach(file => { if (file.type !== 'text/html') { zip.file(file.path, file.content); } });
        zip.file("README.md", deploymentInstructions);
        zip.file("vercel.json", JSON.stringify({}, null, 2));
        try {
            const content = await zip.generateAsync({ type: 'blob' });
            saveAs(content, 'deploy.zip'); setIsDeployModalOpen(true);
        } catch (error) {
            console.error("Error creating ZIP file:", error);
            setNotification({ message: 'Ошибка при создании ZIP-архива.', type: 'error' });
        } finally { setIsLoading(prev => ({ ...prev, zipping: false })); }
    };
    
    const handlePlaceholderChange = (fileId: string, placeholder: string, value: string) => {
        const newHtmlFiles = htmlFiles.map(f => f.id === fileId ? { ...f, placeholderValues: { ...f.placeholderValues, [placeholder]: value } } : f)
        updateProjectState({ htmlFiles: newHtmlFiles });
    };
    const handleLinkPlaceholderChange = (fileId: string, placeholder: string, targetFileId: string) => {
        const newHtmlFiles = htmlFiles.map(f => f.id === fileId ? { ...f, linkPlaceholders: { ...f.linkPlaceholders, [placeholder]: targetFileId } } : f);
        updateProjectState({ htmlFiles: newHtmlFiles });
    };
    const handleSaveApiKey = () => {
        setApiKey(tempApiKey);
        setIsSettingsModalOpen(false);
        setNotification({ message: 'API ключ успешно сохранен.', type: 'success' });
    };

    const handleUpdateFileName = (fileId: string, newName: string) => {
        const newHtmlFiles = htmlFiles.map(f => f.id === fileId ? {...f, newFileName: newName} : f);
        updateProjectState({ htmlFiles: newHtmlFiles });
    };

    const handleUpdateFileContent = useCallback((fileId: string, newContent: string) => {
        let updatedFile: HtmlFile | undefined;
        
        const newHtmlFiles = htmlFiles.map(hf => {
            if (hf.id === fileId) {
                updatedFile = { ...hf, content: newContent };
                return updatedFile;
            }
            return hf;
        });
        const newFiles = files.map(f => (f.id === fileId ? { ...f, content: newContent } : f));
        updateProjectState({ files: newFiles, htmlFiles: newHtmlFiles });
        
        if (isFullscreenPreview && isFullscreenPreview.file.id === fileId && updatedFile) {
            setFullscreenPreview(prev => prev ? { ...prev, file: updatedFile } : null);
        }
    }, [files, htmlFiles, isFullscreenPreview, updateProjectState]);

    const selectedFileData = useMemo(() => htmlFiles.find(f => f.id === selectedFileId), [htmlFiles, selectedFileId]);
    const hasMainPage = useMemo(() => htmlFiles.some(f => f.isMain), [htmlFiles]);
    const notificationColorClasses = { success: 'bg-green-900/50 text-green-300', info: 'bg-blue-900/50 text-blue-300', error: 'bg-red-900/50 text-red-300' };

    if (view === 'landing') return <div className="min-h-screen bg-gray-900 text-gray-200"><LandingPage onEnter={handleEnterApp} /></div>;
    if (view === 'pin') return <div className="min-h-screen bg-gray-900 text-gray-200"><PinValidation onSuccess={handlePinSuccess} appId={APP_ID} /></div>;

    const renderSidebarContent = () => {
        if (!selectedFileData && htmlFiles.length > 0) {
             return (
                <div className="sticky top-0 bg-gray-800 rounded-lg shadow-lg flex flex-col h-[calc(100vh-4rem)]">
                    <div className="flex border-b border-gray-700 flex-shrink-0">
                        <button
                            className={`flex-1 py-3 px-4 text-center font-semibold text-sm bg-gray-700 text-white flex items-center justify-center gap-2`}
                        >
                            <SettingsIcon className="w-5 h-5" />
                            Глобальные настройки
                        </button>
                    </div>
                    <div className="flex-grow overflow-y-auto p-6">
                         <div className="py-6 border-b border-gray-700">
                            <h2 className="text-xl font-semibold mb-4 text-white">Инструменты ИИ</h2>
                            <div className="space-y-3">
                                <button onClick={handleOptimizeNames} disabled={isLoading.optimizing} className="w-full flex justify-center items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2 px-4 rounded-md transition-colors disabled:bg-indigo-800 disabled:cursor-not-allowed">
                                    {isLoading.optimizing ? <Spinner className="w-5 h-5"/> : <MagicIcon className="w-5 h-5"/>} <span>Оптимизировать все имена</span>
                                </button>
                                <p className="text-sm text-gray-400">Переименовать все страницы (кроме главной) для лучшего SEO.</p>
                            </div>
                        </div>
                        <div className="py-6 border-b border-gray-700">
                            <h2 className="text-xl font-semibold mb-4 text-white">Глобальные скрипты</h2>
                            <p className="text-sm text-gray-400 mb-3">Код отсюда (например, Яндекс.Метрика) будет добавлен перед `&lt;/head&gt;` на всех страницах.</p>
                            <textarea rows={5} value={globalScripts} onChange={(e) => updateProjectState({ globalScripts: e.target.value })} className="w-full bg-gray-700 text-white p-2 rounded-md text-sm border border-gray-600 focus:ring-cyan-500 focus:border-cyan-500 font-mono" placeholder="<!-- Yandex.Metrika counter -->..." />
                        </div>
                        <div className="mt-6 space-y-3">
                            <h2 className="text-xl font-semibold mb-4 text-white">Упаковка</h2>
                            <button onClick={handlePackageZip} disabled={!hasMainPage || isLoading.zipping} className="w-full flex justify-center items-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold py-2 px-4 rounded-md transition-colors disabled:bg-cyan-800 disabled:cursor-not-allowed">
                                {isLoading.zipping ? <Spinner className="w-5 h-5"/> : <ZipIcon className="w-5 h-5"/>} <span>Упаковать ZIP-архив</span>
                            </button>
                             <p className="text-sm text-gray-400">Создать готовый для загрузки ZIP-архив. <span className={!hasMainPage ? 'text-yellow-400' : ''}>{!hasMainPage ? 'Сначала выберите главную страницу.' : ''}</span></p>
                        </div>
                         <div className="mt-auto pt-6">
                             <button onClick={resetState} className="w-full text-center text-sm text-gray-400 hover:text-red-400 transition-colors"> Начать заново </button>
                        </div>
                    </div>
                </div>
            );
        }
        
        if (!selectedFileData) return null;


        return (
            <div className="sticky top-0 bg-gray-800 rounded-lg shadow-lg flex flex-col h-[calc(100vh-4rem)]">
                <div className="flex border-b border-gray-700 flex-shrink-0">
                    <button
                        onClick={() => setSidebarView('settings')}
                        className={`flex-1 py-3 px-4 text-center font-semibold text-sm transition-colors flex items-center justify-center gap-2 ${sidebarView === 'settings' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:bg-gray-700/50 hover:text-gray-200'}`}
                    >
                        <SettingsIcon className="w-5 h-5" />
                        Настройки
                    </button>
                    <button
                        onClick={() => {
                            setSidebarView('analysis');
                            if (!currentAnalysisReport) { // Trigger analysis if not already done
                                handleAnalyzeContent(selectedFileData.id);
                            }
                        }}
                        className={`flex-1 py-3 px-4 text-center font-semibold text-sm transition-colors flex items-center justify-center gap-2 ${sidebarView === 'analysis' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:bg-gray-700/50 hover:text-gray-200'}`}
                    >
                         <AnalyticsIcon className="w-5 h-5" />
                        AI-Анализ
                    </button>
                </div>

                {sidebarView === 'settings' && (
                    <div className="flex-grow overflow-y-auto p-6">
                        <div className="pb-6 border-b border-gray-700">
                            <h2 className="text-xl font-semibold mb-1 text-white">Плейсхолдеры</h2>
                            <p className="text-sm text-gray-400 mb-4 truncate">{selectedFileData.newFileName}</p>
                            {(selectedFileData.placeholders.length > 0 || Object.keys(selectedFileData.linkPlaceholders).length > 0) ? (
                                <form>
                                    {selectedFileData.placeholders.length > 0 && <div className="space-y-4">
                                        <h3 className="text-lg font-medium text-gray-300 border-b border-gray-700 pb-2">Текстовые поля</h3>
                                        {selectedFileData.placeholders.map(p => (
                                            <div key={p}>
                                                <label htmlFor={p} className="block text-sm font-medium text-gray-300 mb-1">{p}</label>
                                                <div className="flex items-center gap-2">
                                                    <input type="text" id={p} value={selectedFileData.placeholderValues[p] || ''} onChange={(e) => handlePlaceholderChange(selectedFileData.id, p, e.target.value)} className="w-full bg-gray-700 text-white p-2 rounded-md text-sm border border-gray-600 focus:ring-cyan-500 focus:border-cyan-500" />
                                                </div>
                                            </div>
                                        ))}
                                    </div>}
                                    {Object.keys(selectedFileData.linkPlaceholders).length > 0 && <div className="space-y-4 mt-6">
                                        <h3 className="text-lg font-medium text-gray-300 border-b border-gray-700 pb-2">Ссылки на страницы</h3>
                                        {Object.keys(selectedFileData.linkPlaceholders).map(p => (
                                            <div key={p}>
                                                <label htmlFor={p} className="block text-sm font-medium text-gray-300 mb-1">{p}</label>
                                                <select id={p} value={selectedFileData.linkPlaceholders[p] || ''} onChange={(e) => handleLinkPlaceholderChange(selectedFileData.id, p, e.target.value)} className="w-full bg-gray-700 text-white p-2 rounded-md text-sm border border-gray-600 focus:ring-cyan-500 focus:border-cyan-500 appearance-none bg-no-repeat bg-right pr-8" style={{backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: 'right 0.5rem center', backgroundSize: '1.5em 1.5em'}}>
                                                    <option value="">-- Выберите страницу --</option>
                                                    {htmlFiles.filter(f => f.id !== selectedFileData.id).map(optionFile => ( <option key={optionFile.id} value={optionFile.id}> {optionFile.newFileName} </option> ))}
                                                </select>
                                            </div>
                                        ))}
                                    </div>}
                                </form>
                            ) : <p className="text-gray-400">На этой странице нет плейсхолдеров.</p>}
                        </div>
                        <div className="mt-6 pt-6 border-t border-gray-700">
                             <h3
                                onClick={() => setIsGlobalSettingsExpanded(!isGlobalSettingsExpanded)}
                                className="text-xl font-semibold text-white mb-4 flex justify-between items-center cursor-pointer group"
                            >
                                <span className="group-hover:text-cyan-400 transition-colors">Глобальные настройки</span>
                                <svg className={`w-5 h-5 transition-transform text-gray-400 group-hover:text-cyan-400 ${isGlobalSettingsExpanded ? 'rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                </svg>
                            </h3>
                            {isGlobalSettingsExpanded && (
                                <div className="space-y-6">
                                    <div>
                                        <h4 className="text-lg font-medium text-gray-300 mb-3">Инструменты ИИ</h4>
                                        <div className="space-y-3">
                                            <button onClick={handleOptimizeNames} disabled={isLoading.optimizing} className="w-full flex justify-center items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2 px-4 rounded-md transition-colors disabled:bg-indigo-800 disabled:cursor-not-allowed">
                                                {isLoading.optimizing ? <Spinner className="w-5 h-5"/> : <MagicIcon className="w-5 h-5"/>} <span>Оптимизировать все имена</span>
                                            </button>
                                            <p className="text-sm text-gray-400">Переименовать все страницы (кроме главной) для лучшего SEO.</p>
                                        </div>
                                    </div>
                                    <div>
                                        <h4 className="text-lg font-medium text-gray-300 mb-3">Глобальные скрипты</h4>
                                        <p className="text-sm text-gray-400 mb-3">Код отсюда (например, Яндекс.Метрика) будет добавлен перед `&lt;/head&gt;` на всех страницах.</p>
                                        <textarea rows={5} value={globalScripts} onChange={(e) => updateProjectState({ globalScripts: e.target.value })} className="w-full bg-gray-700 text-white p-2 rounded-md text-sm border border-gray-600 focus:ring-cyan-500 focus:border-cyan-500 font-mono" placeholder="<!-- Yandex.Metrika counter -->..." />
                                    </div>
                                    <div>
                                        <h4 className="text-lg font-medium text-gray-300 mb-3">Упаковка</h4>
                                        <button onClick={handlePackageZip} disabled={!hasMainPage || isLoading.zipping} className="w-full flex justify-center items-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold py-2 px-4 rounded-md transition-colors disabled:bg-cyan-800 disabled:cursor-not-allowed">
                                            {isLoading.zipping ? <Spinner className="w-5 h-5"/> : <ZipIcon className="w-5 h-5"/>} <span>Упаковать ZIP-архив</span>
                                        </button>
                                        <p className="text-sm text-gray-400">Создать готовый для загрузки ZIP-архив. <span className={!hasMainPage ? 'text-yellow-400' : ''}>{!hasMainPage ? 'Сначала выберите главную страницу.' : ''}</span></p>
                                    </div>
                                    <div className="mt-auto pt-6 border-t border-gray-700">
                                        <button onClick={resetState} className="w-full text-center text-sm text-gray-400 hover:text-red-400 transition-colors"> Начать заново </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
                
                {sidebarView === 'analysis' && (
                    <>
                        <div className="flex-grow overflow-y-auto p-6">
                            {isLoading.analyzingFileId === selectedFileId && !currentAnalysisReport ? (
                                <div className="flex flex-col items-center justify-center h-full text-center">
                                    <Spinner className="w-12 h-12 text-purple-400" />
                                    <span className="mt-4 text-lg">Анализирую страницу...</span>
                                    <p className="text-sm text-gray-400 mt-2">Это может занять до 30 секунд.</p>
                                </div>
                            ) : (
                                <>
                                    <h2 className="text-xl font-semibold text-white mb-1">Отчет AI-Анализа</h2>
                                    <p className="text-sm text-gray-400 mb-4 truncate">{selectedFileData.newFileName}</p>
                                    <div
                                        className="space-y-4 text-gray-300 prose prose-invert prose-sm max-w-none"
                                        dangerouslySetInnerHTML={{ __html: parseMarkdown(currentAnalysisReport || '') }}
                                    />
                                </>
                            )}
                        </div>
                        <div className="p-6 border-t border-gray-700 flex-shrink-0 space-y-3">
                            <button
                                onClick={handleApplyFixes}
                                disabled={isLoading.applyingFixes || !currentAnalysisReport || currentAnalysisReport.includes("Ошибка")}
                                className="w-full bg-green-600 hover:bg-green-500 text-white font-semibold py-2 px-4 rounded-md transition-colors disabled:bg-green-800 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {isLoading.applyingFixes ? <Spinner className="w-5 h-5" /> : null}
                                Применить изменения
                            </button>
                             <button
                                onClick={() => handleAnalyzeContent(selectedFileData.id)}
                                disabled={isLoading.analyzingFileId === selectedFileId}
                                className="w-full bg-purple-600/50 hover:bg-purple-600 text-white font-semibold py-2 px-4 rounded-md transition-colors disabled:bg-purple-800 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {isLoading.analyzingFileId === selectedFileId ? <Spinner className="w-5 h-5" /> : null}
                                Провести аудит заново
                            </button>
                        </div>
                    </>
                )}
            </div>
        );
    };


    return (
        <div className="min-h-screen bg-gray-900 text-gray-200 p-4 sm:p-6 lg:p-8">
            <div className="max-w-7xl mx-auto">
                <header className="flex justify-between items-center mb-6">
                    <div> <h1 className="text-3xl font-bold text-white">Упаковщик статичных сайтов</h1> <p className="text-gray-400">Для GitHub Pages и Vercel</p> </div>
                    <div className="flex items-center gap-2"> <button onClick={handleLogout} className="text-sm font-semibold text-gray-300 hover:text-red-400 transition-colors px-4 py-2 rounded-md hover:bg-gray-700"> Выйти </button> </div>
                </header>
                
                <main>
                    {files.length === 0 ? (
                        <div onDragOver={e => { e.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)} onDrop={handleDrop} className={`relative border-2 border-dashed rounded-lg p-12 text-center transition-colors duration-300 h-full flex flex-col justify-center ${isDragging ? 'border-cyan-500 bg-gray-800' : 'border-gray-600 hover:border-cyan-400'}`}>
                            <input type="file" id="folder-upload" className="hidden" onChange={handleFileChange} multiple {...{ webkitdirectory: "", directory: "" }} />
                            <input type="file" id="files-upload" className="hidden" onChange={handleFileChange} multiple />
                            <div className="flex flex-col items-center">
                                <UploadIcon className="w-12 h-12 text-gray-500 mb-4"/>
                                <span className="text-xl font-medium text-white">Перетащите папку или файлы сюда</span>
                                <span className="text-gray-400 mt-1 mb-4">или выберите способ загрузки</span>
                                <div className="flex flex-col sm:flex-row gap-4">
                                    <label htmlFor="folder-upload" className="cursor-pointer text-cyan-400 font-semibold hover:text-cyan-300 bg-gray-700 hover:bg-gray-600 px-6 py-3 rounded-lg transition-colors"> Выбрать папку </label>
                                    <label htmlFor="files-upload" className="cursor-pointer text-cyan-400 font-semibold hover:text-cyan-300 bg-gray-700 hover:bg-gray-600 px-6 py-3 rounded-lg transition-colors"> Выбрать файлы </label>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            <div className="lg:col-span-2">
                                <div className="flex flex-wrap justify-between items-center gap-4 mb-6 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                                    <h2 className="text-xl font-semibold text-white">Ваши страницы</h2>
                                    <div className="flex gap-2">
                                        <label htmlFor="add-folder-upload" className="cursor-pointer text-sm flex items-center gap-2 text-cyan-400 font-semibold hover:text-cyan-300 bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded-lg transition-colors"><FolderPlusIcon className="w-5 h-5" /> Папку</label>
                                        <input type="file" id="add-folder-upload" className="hidden" onChange={handleFileChange} multiple {...{ webkitdirectory: "", directory: "" }} />
                                        <label htmlFor="add-files-upload" className="cursor-pointer text-sm flex items-center gap-2 text-cyan-400 font-semibold hover:text-cyan-300 bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded-lg transition-colors"><DocumentPlusIcon className="w-5 h-5" /> Файлы</label>
                                        <input type="file" id="add-files-upload" className="hidden" onChange={handleFileChange} multiple />
                                    </div>
                                </div>
                               {notification && ( <div className={`p-4 rounded-lg mb-4 text-sm ${notificationColorClasses[notification.type]}`}> {notification.message} </div> )}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {htmlFiles.map(file => (
                                        <HtmlFileCard
                                            key={file.id}
                                            file={file}
                                            previewUrl={previewUrls[file.id]}
                                            isSelected={selectedFileId === file.id}
                                            onSetMain={setMainPage}
                                            onSelect={handleSelectFile}
                                            onDelete={handleDeleteFile}
                                            onUpdateFileName={handleUpdateFileName}
                                            onFullscreen={file => setFullscreenPreview({ file, viewMode: 'preview' })}
                                            onAnalyze={handleAnalyzeContent}
                                            isAnalyzing={isLoading.analyzingFileId === file.id}
                                        />
                                    ))}
                                </div>
                            </div>
                             <aside className="lg:col-span-1">
                                {renderSidebarContent()}
                            </aside>
                        </div>
                    )}
                </main>
            </div>
            
            <div className="fixed bottom-8 right-8 flex flex-col gap-4 z-40">
                 <button onClick={() => setIsLegalModalOpen(true)} className="bg-gray-600 hover:bg-gray-500 text-white rounded-full p-4 shadow-lg transition-transform transform hover:scale-110" aria-label="Политика конфиденциальности и Условия использования"><ShieldCheckIcon className="w-6 h-6" /></button>
                <button onClick={() => setIsSettingsModalOpen(true)} className="bg-gray-600 hover:bg-gray-500 text-white rounded-full p-4 shadow-lg transition-transform transform hover:scale-110" aria-label="Настройки API"><SettingsIcon className="w-6 h-6" /></button>
                <button onClick={() => setIsHelpModalOpen(true)} className="bg-cyan-600 hover:bg-cyan-500 text-white rounded-full p-4 shadow-lg transition-transform transform hover:scale-110" aria-label="Открыть справку"><HelpIcon className="w-6 h-6" /></button>
            </div>

            <Modal isOpen={isHelpModalOpen} onClose={() => setIsHelpModalOpen(false)} title="Описание и инструкция"> <HelpContent /> </Modal>
            <Modal isOpen={isLegalModalOpen} onClose={() => setIsLegalModalOpen(false)} title="Политика конфиденциальности и Условия использования"> <LegalContent /> </Modal>
            <Modal isOpen={isSettingsModalOpen} onClose={() => setIsSettingsModalOpen(false)} title="Настройки API ключа">
                <div className="space-y-4">
                    <p className="text-sm text-gray-400">
                        Для использования функций на базе ИИ (оптимизация имен, генерация контента) вам понадобится API-ключ от Google AI Studio.
                        <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline ml-1">Получить ключ</a>
                    </p>
                    <div>
                        <label htmlFor="api-key-input" className="block text-sm font-medium text-gray-300 mb-1">Ваш Google Gemini API ключ</label>
                        <input
                            id="api-key-input"
                            type="password"
                            value={tempApiKey}
                            onChange={(e) => setTempApiKey(e.target.value)}
                            className="w-full bg-gray-700 text-white p-2 rounded-md text-sm border border-gray-600 focus:ring-cyan-500 focus:border-cyan-500"
                            placeholder="Введите ваш API ключ"
                        />
                    </div>
                    <div className="flex justify-end gap-3">
                         <button
                            onClick={() => setIsSettingsModalOpen(false)}
                            className="bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-md transition-colors"
                        >
                            Отмена
                        </button>
                        <button
                            onClick={handleSaveApiKey}
                            className="bg-cyan-600 hover:bg-cyan-500 text-white font-semibold py-2 px-4 rounded-md transition-colors"
                        >
                            Сохранить
                        </button>
                    </div>
                </div>
            </Modal>
            <Modal isOpen={isDeployModalOpen} onClose={() => setIsDeployModalOpen(false)} title="Сайт готов к развертыванию!">
                <div className="space-y-4 text-gray-300 prose prose-invert prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: deploymentInstructions.replace(/`([^`]+)`/g, '<code class="bg-gray-700 text-sm rounded-md px-1.5 py-0.5 font-mono text-cyan-300">$1</code>').replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-cyan-400 hover:underline">$1</a>').replace(/\n/g, '<br />') }} />
            </Modal>
            
            {isFullscreenPreview && (
                <Modal isOpen={!!isFullscreenPreview} onClose={() => setFullscreenPreview(null)} title={`Редактор: ${isFullscreenPreview.file.newFileName}`} size="large">
                    <div className="flex flex-col h-full">
                         <div className="flex-shrink-0 mb-4 flex items-center justify-between p-1 bg-gray-900 rounded-lg">
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => setFullscreenPreview(prev => prev ? { ...prev, viewMode: 'preview' } : null)}
                                    className={`flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors ${isFullscreenPreview.viewMode === 'preview' ? 'bg-cyan-600 text-white' : 'bg-transparent text-gray-300 hover:bg-gray-700'}`}
                                >
                                    <EyeIcon className="w-5 h-5" /> Превью
                                </button>
                                <button
                                    onClick={() => setFullscreenPreview(prev => prev ? { ...prev, viewMode: 'code' } : null)}
                                    className={`flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors ${isFullscreenPreview.viewMode === 'code' ? 'bg-cyan-600 text-white' : 'bg-transparent text-gray-300 hover:bg-gray-700'}`}
                                >
                                    <CodeBracketIcon className="w-5 h-5" /> Код
                                </button>
                            </div>

                            {isFullscreenPreview.viewMode === 'preview' && (
                                <div className="flex items-center gap-1">
                                    <button onClick={() => setPreviewDevice('desktop')} className={`p-2 text-sm rounded-md transition-colors ${previewDevice === 'desktop' ? 'bg-gray-700 text-white' : 'bg-transparent text-gray-400 hover:bg-gray-700/50 hover:text-white'}`} aria-label="Desktop preview">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                                    </button>
                                    <button onClick={() => setPreviewDevice('mobile')} className={`p-2 text-sm rounded-md transition-colors ${previewDevice === 'mobile' ? 'bg-gray-700 text-white' : 'bg-transparent text-gray-400 hover:bg-gray-700/50 hover:text-white'}`} aria-label="Mobile preview">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 18h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                                    </button>
                                </div>
                            )}
                        </div>
                        <div className="flex-grow relative bg-gray-900 rounded-lg flex items-center justify-center">
                            {isFullscreenPreview.viewMode === 'preview' ? (
                                <div className={`bg-white rounded-md shadow-2xl transition-all duration-300 ${previewDevice === 'desktop' ? 'w-full h-full' : 'w-[375px] h-[667px] max-w-full max-h-full'}`}>
                                    <iframe key={`${isFullscreenPreview.file.id}-${previewUrls[isFullscreenPreview.file.id]}`} src={previewUrls[isFullscreenPreview.file.id]} className="w-full h-full border-0 rounded-md" sandbox="allow-scripts" title={`Fullscreen Preview of ${isFullscreenPreview.file.name}`} />
                                </div>
                            ) : (
                                <textarea
                                    value={isFullscreenPreview.file.content}
                                    onChange={(e) => handleUpdateFileContent(isFullscreenPreview.file.id, e.target.value)}
                                    className="w-full h-full absolute inset-0 bg-gray-900 text-gray-300 font-mono text-sm p-4 resize-none focus:outline-none focus:ring-1 focus:ring-cyan-500 rounded-md"
                                    spellCheck="false"
                                />
                            )}
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default App;
