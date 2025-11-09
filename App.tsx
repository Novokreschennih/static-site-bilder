

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { SiteFile, HtmlFile } from './types';
import { optimizeFileName } from './services/geminiService';
import { StarIcon, UploadIcon, MagicIcon, ZipIcon, HelpIcon, Spinner, ExpandIcon } from './components/icons';
import Modal from './components/Modal';
import JSZip from 'jszip';
import saveAs from 'file-saver';
import { HelpContent } from './components/HelpContent';
import { useLocalStorage } from './hooks/useLocalStorage';
import { AUTH_STORAGE_KEY, APP_ID } from './constants';
import { LandingPage } from './components/LandingPage';
import PinValidation from './components/PinValidation';


// Helper function to escape strings for regex
function escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// New placeholder substitution logic that handles both text and links
function substituteAllPlaceholders(
    file: HtmlFile,
    allHtmlFiles: HtmlFile[]
): string {
    let result = file.content;
    const fileMapById = new Map(allHtmlFiles.map(f => [f.id, f]));

    // Substitute text placeholders
    for (const [key, value] of Object.entries(file.placeholderValues)) {
        const escapedKey = escapeRegExp(key);
        const placeholder1 = new RegExp(`\\[\\[\\s*${escapedKey}\\s*\\]\\]`, 'g');
        const placeholder2 = new RegExp(`\\{\\{\\s*${escapedKey}\\s*\\}\\}`, 'g');
        result = result.replace(placeholder1, value);
        result = result.replace(placeholder2, value);
    }

    // Substitute link placeholders
    for (const [key, targetFileId] of Object.entries(file.linkPlaceholders)) {
        const targetFile = fileMapById.get(targetFileId);
        if (targetFile) {
            const linkUrl = targetFile.newFileName;
            const escapedKey = escapeRegExp(key);
            const placeholder1 = new RegExp(`\\[\\[\\s*${escapedKey}\\s*\\]\\]`, 'g');
            const placeholder2 = new RegExp(`\\{\\{\\s*${escapedKey}\\s*\\}\\}`, 'g');
            result = result.replace(placeholder1, linkUrl);
            result = result.replace(placeholder2, linkUrl);
        }
    }
    return result;
}

// New preview URL creation logic
async function createPreviewUrl(htmlContent: string, htmlPath: string, fileMap: Map<string, SiteFile>): Promise<string> {
    let processedContent = htmlContent;
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');
    const basePath = htmlPath.substring(0, htmlPath.lastIndexOf('/') + 1);
    const elementsToUpdate = doc.querySelectorAll<HTMLLinkElement | HTMLScriptElement | HTMLImageElement>('link[href], script[src], img[src]');

    for (const el of elementsToUpdate) {
        const originalPath = el.getAttribute('href') || el.getAttribute('src');
        if (!originalPath || originalPath.startsWith('http') || originalPath.startsWith('data:')) {
            continue;
        }

        // Resolve relative paths correctly
        const absolutePath = new URL(originalPath, `file:///${basePath.replace(/\\/g, '/')}`).pathname.substring(1);
        
        const assetFile = fileMap.get(absolutePath);
        if (assetFile && assetFile.objectUrl) {
            // Using a regex replacement to handle multiple occurrences and avoid issues with special characters
            processedContent = processedContent.replace(new RegExp(`(["'])${escapeRegExp(originalPath)}(["'])`, 'g'), `$1${assetFile.objectUrl}$2`);
        }
    }

    const blob = new Blob([processedContent], { type: 'text/html' });
    return URL.createObjectURL(blob);
}


const App: React.FC = () => {
    const [isAuthenticated, setIsAuthenticated] = useLocalStorage<boolean>(AUTH_STORAGE_KEY, false);
    const [view, setView] = useState<'landing' | 'pin' | 'app'>('landing');
    
    const [files, setFiles] = useState<SiteFile[]>([]);
    const [htmlFiles, setHtmlFiles] = useState<HtmlFile[]>([]);
    const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
    const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<Record<string, boolean>>({ optimizing: false, zipping: false });
    const [notification, setNotification] = useState<{ message: string; type: 'info' | 'success' | 'error' } | null>(null);
    const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
    const [isDeployModalOpen, setIsDeployModalOpen] = useState(false);
    const [fullscreenPreview, setFullscreenPreview] = useState<{file: HtmlFile, url: string} | null>(null);
    const [globalScripts, setGlobalScripts] = useState<string>('');
    
    // Fix: Removed state management for API key to comply with guidelines.
    
    useEffect(() => {
        if (isAuthenticated) {
            setView('app');
        } else {
            setView('landing');
        }
    }, [isAuthenticated]);

    // Fix: Removed useEffect for loading API key from localStorage.

    const deploymentInstructions = useMemo(() => getDeploymentInstructions(), []);

    const resetState = useCallback(() => {
        files.forEach(file => file.objectUrl && URL.revokeObjectURL(file.objectUrl));
        Object.values(previewUrls).forEach(URL.revokeObjectURL);
        setFiles([]);
        setHtmlFiles([]);
        setPreviewUrls({});
        setSelectedFileId(null);
        setNotification(null);
        setGlobalScripts('');
    }, [files, previewUrls]);

    const handleEnterApp = () => {
        setView(isAuthenticated ? 'app' : 'pin');
    };

    const handlePinSuccess = () => {
        setIsAuthenticated(true);
    };

    const handleLogout = useCallback(() => {
        resetState();
        setIsAuthenticated(false);
    }, [resetState, setIsAuthenticated]);


    const processFiles = useCallback(async (uploadedFiles: FileList | null) => {
        if (!uploadedFiles) return;
        files.forEach(file => file.objectUrl && URL.revokeObjectURL(file.objectUrl));
        Object.values(previewUrls).forEach(URL.revokeObjectURL);
        setFiles([]);
        setHtmlFiles([]);
        setPreviewUrls({});
        setSelectedFileId(null);
        setNotification(null);
        setGlobalScripts('');

        const uploadedFileArray = Array.from(uploadedFiles);
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

        const filePromises: Promise<SiteFile | null>[] = uploadedFileArray.map(file => {
            return new Promise((resolve) => {
                const reader = new FileReader();
                const originalPath = (file as any).webkitRelativePath || file.name;
                const path = originalPath.startsWith(commonBasePath)
                    ? originalPath.substring(commonBasePath.length)
                    : originalPath;

                if (!path) {
                    resolve(null);
                    return;
                }

                reader.onload = (e) => {
                    const content = e.target?.result;
                    if (content) {
                        const newFile: SiteFile = { id: `${path}-${file.lastModified}`, path, name: file.name, content, type: file.type };
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

        const allFiles = (await Promise.all(filePromises)).filter((f): f is SiteFile => f !== null);
        
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
                const allMatches = Array.from(content.matchAll(placeholderRegex), m => m[1].trim());
                const allPlaceholders = [...new Set(allMatches)];

                const textPlaceholders = allPlaceholders.filter(p => !/^(link|url)_/i.test(p));
                const linkPlaceholderKeys = allPlaceholders.filter(p => /^(link|url)_/i.test(p));
                totalPlaceholders += allPlaceholders.length;

                const placeholderValues = textPlaceholders.reduce((acc, p) => ({ ...acc, [p]: '' }), {});
                const linkPlaceholders = linkPlaceholderKeys.reduce((acc, p) => ({ ...acc, [p]: '' }), {});

                processedHtmlFiles.push({
                    ...file,
                    content,
                    isMain: false,
                    newFileName: file.name,
                    placeholders: textPlaceholders,
                    placeholderValues,
                    linkPlaceholders
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
    }, [files, previewUrls]);
    
    useEffect(() => {
        const generateAllPreviews = async () => {
             // Revoke old URLs before creating new ones
            Object.values(previewUrls).forEach(URL.revokeObjectURL);

            const assetFileMap = new Map(files.map(f => [f.path, f]));
            const newPreviewUrls: Record<string, string> = {};

            for (const hf of htmlFiles) {
                const substitutedContent = substituteAllPlaceholders(hf, htmlFiles);
                const url = await createPreviewUrl(substitutedContent, hf.path, assetFileMap);
                newPreviewUrls[hf.id] = url;
            }
            setPreviewUrls(newPreviewUrls);
        };

        if (htmlFiles.length > 0) {
            generateAllPreviews();
        }

        return () => {
            if (htmlFiles.length > 0) {
                Object.values(previewUrls).forEach(URL.revokeObjectURL);
            }
        };
        // This effect should run whenever the source data for previews changes.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [htmlFiles]);


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
        setHtmlFiles(prev => {
            const oldMain = prev.find(f => f.isMain);
            return prev.map(file => {
                let newFileName = file.newFileName;
                if (file.id === id) {
                    newFileName = 'index.html';
                } else if (oldMain && file.id === oldMain.id) {
                    // Revert old main page back to its original name if it wasn't modified
                    // Or keep its optimized name if it was
                     newFileName = file.newFileName === 'index.html' ? file.name : file.newFileName;
                }

                return {
                    ...file,
                    isMain: file.id === id,
                    newFileName: newFileName,
                };
            });
        });
        setSelectedFileId(id);
    };


    const handleOptimizeNames = async () => {
        setNotification(null);

        // Fix: Removed API key check and modal logic.
        setIsLoading(prev => ({ ...prev, optimizing: true }));
        try {
            const promises = htmlFiles.map(async file => {
                if (file.isMain) return file;
                // Fix: Call optimizeFileName without the apiKey argument.
                const newName = await optimizeFileName(file.content);
                return { ...file, newFileName: `${newName}.html` };
            });
            const optimizedFiles = await Promise.all(promises);
            setHtmlFiles(optimizedFiles);
            setNotification({ message: 'Имена файлов успешно оптимизированы!', type: 'success' });
        } catch (error) {
            console.error("Error during filename optimization:", error);
            if (error instanceof Error) {
                setNotification({ message: error.message, type: 'error' });
                // Fix: Removed specific error handling for invalid API key.
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
        const htmlFilePathMap = new Map(htmlFiles.map(f => [f.path, f.newFileName]));

        // Process HTML files
        for (const htmlFile of htmlFiles) {
            let finalContent = substituteAllPlaceholders(htmlFile, htmlFiles);
            
            finalContent = finalContent.replace(/(href|src)=["'](?!https?:\/\/)([^"']+)["']/g, (match, attr, path) => {
                const fullPath = new URL(path, `file:///${htmlFile.path.substring(0, htmlFile.path.lastIndexOf('/') + 1)}`).pathname.substring(1);
                
                if(htmlFilePathMap.has(fullPath)) {
                    // This is a link to another managed HTML file, its name is already handled by placeholders or direct naming.
                    // However, we need to adjust the path relative to the final output structure.
                    const newName = htmlFilePathMap.get(fullPath)!;
                    const newPath = path.substring(0, path.lastIndexOf('/') + 1) + newName;
                    return `${attr}="${newPath}"`;
                }
                 // Let's also check against original names, just in case
                const baseName = path.split('/').pop();
                if(baseName && htmlFileNameMap.has(baseName)) {
                    const newPath = path.replace(baseName, htmlFileNameMap.get(baseName)!);
                    return `${attr}="${newPath}"`;
                }
                return match;
            });
            
            if (globalScripts.trim()) {
                finalContent = finalContent.replace('</head>', `${globalScripts.trim()}\n</head>`);
            }

            const finalPath = htmlFile.path.substring(0, htmlFile.path.lastIndexOf('/') + 1) + htmlFile.newFileName;
            zip.file(finalPath, finalContent);
        }

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
            setNotification({ message: 'Ошибка при создании ZIP-архива.', type: 'error' });
        } finally {
            setIsLoading(prev => ({ ...prev, zipping: false }));
        }
    };
    
    const handlePlaceholderChange = (fileId: string, placeholder: string, value: string) => {
        setHtmlFiles(prev => prev.map(f => {
            if (f.id === fileId) {
                return { ...f, placeholderValues: { ...f.placeholderValues, [placeholder]: value } };
            }
            return f;
        }));
    };

     const handleLinkPlaceholderChange = (fileId: string, placeholder: string, targetFileId: string) => {
        setHtmlFiles(prev => prev.map(f => {
            if (f.id === fileId) {
                return { ...f, linkPlaceholders: { ...f.linkPlaceholders, [placeholder]: targetFileId } };
            }
            return f;
        }));
    };

    // Fix: Removed handleSaveApiKey function.
    
    const selectedFileData = useMemo(() => htmlFiles.find(f => f.id === selectedFileId), [htmlFiles, selectedFileId]);
    const hasMainPage = useMemo(() => htmlFiles.some(f => f.isMain), [htmlFiles]);

    const notificationColorClasses = {
        success: 'bg-green-900/50 text-green-300',
        info: 'bg-blue-900/50 text-blue-300',
        error: 'bg-red-900/50 text-red-300',
    };

    if (view === 'landing') {
        return (
            <div className="min-h-screen bg-gray-900 text-gray-200">
                <LandingPage onEnter={handleEnterApp} />
            </div>
        );
    }

    if (view === 'pin') {
        return (
            <div className="min-h-screen bg-gray-900 text-gray-200">
                <PinValidation onSuccess={handlePinSuccess} appId={APP_ID} />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900 text-gray-200 p-4 sm:p-6 lg:p-8">
            <div className="max-w-7xl mx-auto">
                <header className="flex justify-between items-center mb-6">
                    <div> <h1 className="text-3xl font-bold text-white">Упаковщик статичных сайтов</h1> <p className="text-gray-400">Для GitHub Pages и Vercel</p> </div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => setIsHelpModalOpen(true)} className="p-2 rounded-full hover:bg-gray-700 transition-colors" aria-label="Open help modal"> <HelpIcon className="w-6 h-6 text-gray-400"/> </button>
                        <button onClick={handleLogout} className="text-sm font-semibold text-gray-300 hover:text-red-400 transition-colors px-4 py-2 rounded-md hover:bg-gray-700"> Выйти </button>
                    </div>
                </header>
                
                {files.length === 0 ? (
                    <div onDragOver={e => { e.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)} onDrop={handleDrop} className={`relative border-2 border-dashed rounded-lg p-12 text-center transition-colors duration-300 ${isDragging ? 'border-cyan-500 bg-gray-800' : 'border-gray-600 hover:border-cyan-400'}`}>
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
                    <main className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-2">
                           {notification && ( <div className={`p-4 rounded-lg mb-4 text-sm ${notificationColorClasses[notification.type]}`}> {notification.message} </div> )}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {htmlFiles.map(file => (
                                    <div key={file.id} className={`bg-gray-800 rounded-lg shadow-lg overflow-hidden transition-all duration-300 ${selectedFileId === file.id ? 'ring-2 ring-cyan-500' : 'ring-1 ring-gray-700'}`}>
                                        <div className="p-4">
                                            <div className="relative aspect-video bg-gray-700 rounded-md overflow-hidden mb-3 group">
                                               {previewUrls[file.id] ? (
                                                    <iframe src={previewUrls[file.id]} className="w-full h-full border-0" sandbox="allow-scripts" title={`Preview of ${file.name}`} />
                                               ) : (
                                                    <div className="w-full h-full flex items-center justify-center"><Spinner className="w-8 h-8 text-gray-500" /></div>
                                               )}
                                                <button onClick={() => previewUrls[file.id] && setFullscreenPreview({file, url: previewUrls[file.id]})} className="absolute top-2 right-2 p-1.5 bg-gray-900/50 rounded-full text-gray-300 hover:bg-gray-900/75 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity" aria-label="Развернуть на весь экран">
                                                    <ExpandIcon className="w-4 h-4" />
                                                </button>
                                            </div>
                                            <input type="text" value={file.newFileName} disabled={file.isMain} onChange={(e) => setHtmlFiles(prev => prev.map(f => f.id === file.id ? {...f, newFileName: e.target.value} : f))} className="w-full bg-gray-700 text-white p-2 rounded-md text-sm border border-gray-600 focus:ring-cyan-500 focus:border-cyan-500" />
                                            <div className="flex justify-between items-center mt-3">
                                                <button onClick={() => setMainPage(file.id)} className={`flex items-center gap-2 text-sm px-3 py-1 rounded-md transition-colors ${file.isMain ? 'text-yellow-300 bg-yellow-900/50' : 'text-gray-300 hover:bg-gray-700'}`}>
                                                    <StarIcon className="w-4 h-4"/> {file.isMain ? 'Главная' : 'Сделать главной'}
                                                </button>
                                                <button onClick={() => setSelectedFileId(file.id)} className="text-sm text-cyan-400 hover:underline"> Настроить </button>
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
                                        (selectedFileData.placeholders.length > 0 || Object.keys(selectedFileData.linkPlaceholders).length > 0) ? (
                                            <form>
                                                {selectedFileData.placeholders.length > 0 && <div className="space-y-4">
                                                    <h3 className="text-lg font-medium text-gray-300 border-b border-gray-700 pb-2">Текстовые поля</h3>
                                                    {selectedFileData.placeholders.map(p => (
                                                        <div key={p}>
                                                            <label htmlFor={p} className="block text-sm font-medium text-gray-300 mb-1">{p}</label>
                                                            <input type="text" id={p} value={selectedFileData.placeholderValues[p] || ''} onChange={(e) => handlePlaceholderChange(selectedFileData.id, p, e.target.value)} className="w-full bg-gray-700 text-white p-2 rounded-md text-sm border border-gray-600 focus:ring-cyan-500 focus:border-cyan-500" />
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
                                        ) : <p className="text-gray-400">На этой странице нет плейсхолдеров.</p>
                                    ) : ( <p className="text-gray-400">Выберите HTML файл для настройки его плейсхолдеров.</p> )}
                                </div>
                                <div className="py-6 border-b border-gray-700">
                                    <h2 className="text-xl font-semibold mb-4 text-white">Глобальные скрипты</h2>
                                    <p className="text-sm text-gray-400 mb-3">Код отсюда (например, Яндекс.Метрика) будет добавлен перед `&lt;/head&gt;` на всех страницах.</p>
                                    <textarea rows={5} value={globalScripts} onChange={(e) => setGlobalScripts(e.target.value)} className="w-full bg-gray-700 text-white p-2 rounded-md text-sm border border-gray-600 focus:ring-cyan-500 focus:border-cyan-500 font-mono" placeholder="<!-- Yandex.Metrika counter -->..." />
                                </div>
                                <div className="mt-6 space-y-3">
                                    <button onClick={handleOptimizeNames} disabled={isLoading.optimizing} className="w-full flex justify-center items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2 px-4 rounded-md transition-colors disabled:bg-indigo-800 disabled:cursor-not-allowed">
                                        {isLoading.optimizing ? <Spinner className="w-5 h-5"/> : <MagicIcon className="w-5 h-5"/>} <span>Оптимизировать имена</span>
                                    </button>
                                    <button onClick={handlePackageZip} disabled={!hasMainPage || isLoading.zipping} className="w-full flex justify-center items-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold py-2 px-4 rounded-md transition-colors disabled:bg-cyan-800 disabled:cursor-not-allowed">
                                        {isLoading.zipping ? <Spinner className="w-5 h-5"/> : <ZipIcon className="w-5 h-5"/>} <span>Подготовить для GitHub</span>
                                    </button>
                                    <button onClick={resetState} className="w-full text-center text-sm text-gray-400 hover:text-red-400 transition-colors mt-2"> Начать заново </button>
                                </div>
                            </div>
                        </aside>
                    </main>
                )}
            </div>
            
            <Modal isOpen={isHelpModalOpen} onClose={() => setIsHelpModalOpen(false)} title="Описание и инструкция"> <HelpContent /> </Modal>

            {/* Fix: Removed API Key Modal */}

            <Modal isOpen={isDeployModalOpen} onClose={() => setIsDeployModalOpen(false)} title="Сайт готов к развертыванию!">
                <div className="space-y-4 text-gray-300 prose prose-invert prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: deploymentInstructions.replace(/`([^`]+)`/g, '<code class="bg-gray-700 text-sm rounded-md px-1.5 py-0.5 font-mono text-cyan-300">$1</code>').replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-cyan-400 hover:underline">$1</a>').replace(/\n/g, '<br />') }} />
            </Modal>
            
            {fullscreenPreview && (
                <Modal isOpen={!!fullscreenPreview} onClose={() => setFullscreenPreview(null)} title={`Предпросмотр: ${fullscreenPreview.file.name}`} size="large">
                    <iframe key={fullscreenPreview.file.id} src={fullscreenPreview.url} className="w-full h-full border-0 rounded-md bg-white" sandbox="allow-scripts" title={`Fullscreen Preview of ${fullscreenPreview.file.name}`} />
                </Modal>
            )}
        </div>
    );
};

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
