import { useState, useEffect, useCallback } from 'react';
import { SiteFile, HtmlFile } from '../types';

// Helper to convert ArrayBuffer to Base64
const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
};

// Helper to convert Base64 to ArrayBuffer
const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
    const binary_string = window.atob(base64);
    const len = binary_string.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binary_string.charCodeAt(i);
    }
    return bytes.buffer;
};


interface StoredFile {
    id: string;
    path: string;
    name: string;
    content: string; // Always string (text or base64 for binary)
    type: string;
    isBinary: boolean;
}

interface StoredHtmlFile extends StoredFile {
    isMain: boolean;
    newFileName: string;
    placeholders: string[];
    placeholderValues: Record<string, string>;
    linkPlaceholders: Record<string, string>;
}

interface ProjectState {
    files: SiteFile[];
    htmlFiles: HtmlFile[];
    globalScripts: string;
}

const PROJECT_STATE_KEY = 'static-site-packager-project-state';

const useProjectState = (): [ProjectState, (newState: Partial<ProjectState>) => void, () => void] => {
    const [projectState, setProjectState] = useState<ProjectState>({
        files: [],
        htmlFiles: [],
        globalScripts: '',
    });

    // Rehydrate state from localStorage on initial load
    useEffect(() => {
        try {
            const item = window.localStorage.getItem(PROJECT_STATE_KEY);
            const storedState = item ? JSON.parse(item) : null;
            
            if (storedState) {
                const rehydratedFiles: SiteFile[] = storedState.files.map((sf: StoredFile) => {
                    const content = sf.isBinary ? base64ToArrayBuffer(sf.content) : sf.content;
                    const objectUrl = URL.createObjectURL(new Blob([content], { type: sf.type }));
                    return { ...sf, content, objectUrl };
                });

                const rehydratedHtmlFiles: HtmlFile[] = storedState.htmlFiles.map((shf: StoredHtmlFile) => {
                    return {
                        ...shf,
                        content: shf.content, // HTML content is always text
                    };
                });
                
                setProjectState({
                    files: rehydratedFiles,
                    htmlFiles: rehydratedHtmlFiles,
                    globalScripts: storedState.globalScripts || '',
                });
            }
        } catch (e) {
            console.error("Failed to rehydrate project state:", e);
            window.localStorage.removeItem(PROJECT_STATE_KEY); // Clear corrupted state
        }
    }, []);

    // Persist state to localStorage whenever it changes
    const persistState = useCallback((stateToPersist: ProjectState) => {
        try {
            const serializableFiles: StoredFile[] = stateToPersist.files.map(file => {
                const isBinary = file.content instanceof ArrayBuffer;
                return {
                    id: file.id,
                    path: file.path,
                    name: file.name,
                    type: file.type,
                    isBinary,
                    content: isBinary ? arrayBufferToBase64(file.content as ArrayBuffer) : file.content as string,
                };
            });
            
            const serializableHtmlFiles: StoredHtmlFile[] = stateToPersist.htmlFiles.map(hf => ({
                id: hf.id, path: hf.path, name: hf.name, content: hf.content, type: hf.type, isBinary: false,
                isMain: hf.isMain, newFileName: hf.newFileName, placeholders: hf.placeholders,
                placeholderValues: hf.placeholderValues, linkPlaceholders: hf.linkPlaceholders,
            }));
            
            const stateToStore = {
                files: serializableFiles,
                htmlFiles: serializableHtmlFiles,
                globalScripts: stateToPersist.globalScripts,
            };
            window.localStorage.setItem(PROJECT_STATE_KEY, JSON.stringify(stateToStore));
        } catch (e) {
            console.error("Failed to persist project state:", e);
        }
    }, []);
    
    // Update and persist state
    const updateProjectState = (newState: Partial<ProjectState>) => {
        setProjectState(prevState => {
            const updatedState = { ...prevState, ...newState };
            persistState(updatedState);
            return updatedState;
        });
    };

    // Clear state
    const clearProjectState = () => {
        projectState.files.forEach(file => file.objectUrl && URL.revokeObjectURL(file.objectUrl));
        const clearedState = { files: [], htmlFiles: [], globalScripts: '' };
        setProjectState(clearedState);
        window.localStorage.removeItem(PROJECT_STATE_KEY);
    };
    
    return [projectState, updateProjectState, clearProjectState];
};

export default useProjectState;
