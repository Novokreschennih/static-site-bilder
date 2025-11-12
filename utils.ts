import { HtmlFile, SiteFile } from './types';

// Helper function to escape strings for regex
export function escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// New placeholder substitution logic that handles both text and links
export function substituteAllPlaceholders(
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
export async function createPreviewUrl(htmlContent: string, htmlPath: string, fileMap: Map<string, SiteFile>): Promise<string> {
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


export function getDeploymentInstructions(): string {
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

export function parseMarkdown(markdownText: string): string {
    if (!markdownText) return '';

    const applyInlineFormatting = (text: string) => {
         // Escape HTML tags to prevent rendering them as actual elements
        const escapedText = text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
            
        // Apply markdown formatting
        return escapedText
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/`([^`]+)`/g, '<code class="bg-gray-700 text-sm rounded-md px-1.5 py-0.5 font-mono text-cyan-300">$1</code>');
    };

    const lines = markdownText.split('\n');
    let html = '';
    let inList = false;
    let inCodeBlock = false;
    let codeLang = '';
    let codeContent = '';

    for (const line of lines) {
        // Code blocks
        if (line.trim().startsWith('```')) {
            if (inCodeBlock) {
                html += `<pre class="bg-gray-900 rounded-md p-3 my-2 overflow-x-auto"><code class="language-${codeLang} text-sm">${escapeRegExp(codeContent).trim()}</code></pre>\n`;
                inCodeBlock = false;
                codeContent = '';
            } else {
                if (inList) { html += '</ul>\n'; inList = false; }
                inCodeBlock = true;
                codeLang = line.trim().substring(3);
            }
            continue;
        }

        if (inCodeBlock) {
            codeContent += line + '\n';
            continue;
        }

        const trimmedLine = line.trim();

        if (trimmedLine.startsWith('#### ')) {
            if (inList) { html += '</ul>\n'; inList = false; }
            html += `<h4 class="text-md font-semibold text-gray-100 mt-3 mb-1">${applyInlineFormatting(trimmedLine.substring(5))}</h4>\n`;
        } else if (trimmedLine.startsWith('### ')) {
            if (inList) { html += '</ul>\n'; inList = false; }
            html += `<h3 class="text-lg font-semibold text-white mt-4 mb-2">${applyInlineFormatting(trimmedLine.substring(4))}</h3>\n`;
        } else if (trimmedLine.startsWith('* ') || trimmedLine.startsWith('- ')) {
            if (!inList) {
                html += '<ul class="list-disc list-inside space-y-1">\n';
                inList = true;
            }
            html += `  <li>${applyInlineFormatting(trimmedLine.substring(2))}</li>\n`;
        } else {
            if (inList) {
                html += '</ul>\n';
                inList = false;
            }
            if (trimmedLine) {
                html += `<p>${applyInlineFormatting(trimmedLine)}</p>\n`;
            }
        }
    }

    if (inList) {
        html += '</ul>\n';
    }

    return html;
}