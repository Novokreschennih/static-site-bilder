
import { GoogleGenAI } from "@google/genai";

export const optimizeFileName = async (htmlContent: string, apiKey: string): Promise<string> => {
    if (!apiKey) throw new Error("API-ключ не предоставлен.");
    const ai = new GoogleGenAI({ apiKey });

    // Truncate content to avoid exceeding token limits, focusing on meaningful tags.
    const bodyMatch = htmlContent.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    const contentToAnalyze = bodyMatch ? bodyMatch[1] : htmlContent;
    const truncatedContent = contentToAnalyze.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                                             .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                                             .replace(/<[^>]+>/g, ' ')
                                             .replace(/\s+/g, ' ')
                                             .trim()
                                             .substring(0, 4000);

    const prompt = `Based on the following HTML content, suggest a short, semantic, and SEO-friendly filename in Russian, transliterated to kebab-case (e.g., 'o-nas'). Do not include the '.html' extension. Return ONLY the filename.

HTML Content:
${truncatedContent}`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });

        const text = response.text.trim().toLowerCase().replace(/\.html$/, '');
        if (/^[a-z0-9-]+$/.test(text)) {
            return text;
        }
        return "optimized-page";

    } catch (error) {
        console.error("Error optimizing filename with Gemini API:", error);
        if (error instanceof Error && (error.message.includes('API key not valid') || error.message.includes('permission denied') || error.message.includes('API_KEY_INVALID'))) {
            throw new Error("API-ключ недействителен. Пожалуйста, проверьте его в настройках.");
       }
        throw new Error("Не удалось оптимизировать имя файла из-за ошибки API.");
    }
};

export const analyzeHtmlContent = async (htmlContent: string, apiKey: string): Promise<string> => {
    if (!apiKey) throw new Error("API-ключ не предоставлен.");
    const ai = new GoogleGenAI({ apiKey });

    // Truncate content, but KEEP the HTML structure for analysis.
    // Remove only scripts and styles which are not relevant for this analysis.
    const truncatedContent = htmlContent.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                                          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                                          .substring(0, 15000);

    const prompt = `Проанализируй следующий HTML-код на предмет улучшения SEO, доступности (accessibility), семантики и общей структуры.
Предоставь отчет в формате Markdown.
Отчет должен быть структурирован следующим образом:

### Отчет по анализу HTML-кода

#### SEO-Анализ
- **Тег \`<title>\`**: [анализ и рекомендации]
- **Тег \`<meta name="description">\`**: [анализ и рекомендации]
- **Заголовки (\`<h1>\`-\`<h6>\`)**: [анализ и рекомендации по иерархии]
- **Атрибуты \`alt\` для изображений**: [анализ и рекомендации]

#### Анализ Доступности (Accessibility)
- **Контрастность**: [общие рекомендации, если применимо]
- **Семантические теги**: [анализ использования \`<nav>\`, \`<main>\`, \`<header>\`, \`<footer>\` и т.д.]
- **ARIA-атрибуты**: [рекомендации, если необходимы]

#### Общие рекомендации
- [Любые другие важные замечания по улучшению кода]

Если серьезных проблем не найдено, напиши краткий отчет, подтверждающий это.
Предоставь конкретные примеры из кода, если это необходимо для иллюстрации проблемы.
Ответ должен быть ТОЛЬКО в формате Markdown. Не добавляй никаких вступлений или заключений вне этого формата.

HTML для анализа:
\`\`\`html
${truncatedContent}
\`\`\`
`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });
        return response.text.trim();
    } catch (error) {
        console.error("Error analyzing content with Gemini API:", error);
        if (error instanceof Error && (error.message.includes('API key not valid') || error.message.includes('permission denied') || error.message.includes('API_KEY_INVALID'))) {
            throw new Error("API-ключ недействителен. Пожалуйста, проверьте его в настройках.");
        }
        throw new Error("Не удалось проанализировать контент из-за ошибки API.");
    }
};

export const applyAnalysisFixes = async (htmlContent: string, apiKey: string): Promise<string> => {
    if (!apiKey) throw new Error("API-ключ не предоставлен.");
    const ai = new GoogleGenAI({ apiKey });

    const prompt = `На основе следующего HTML-кода, примени лучшие практики для SEO, доступности и семантики.
Исправь следующие потенциальные проблемы:
1.  Убедись, что есть осмысленный тег \`<title>\`.
2.  Добавь или улучши тег \`<meta name="description">\`.
3.  Проверь иерархию заголовков (\`<h1>\` должен быть один).
4.  Добавь осмысленные \`alt\` атрибуты ко всем тегам \`<img>\`, у которых их нет.
5.  Используй семантические теги (\`<header>\`, \`<main>\`, \`<footer>\`, \`<nav>\`), где это уместно.
6.  Сохрани существующий контент и стили. Не меняй классы CSS или встроенные стили.
7.  Не удаляй существующие скрипты или ссылки на стили.

Верни ТОЛЬКО полный, исправленный HTML-код. Не добавляй никаких объяснений, комментариев или Markdown-форматирования. Ответ должен быть валидным HTML, начиная с \`<!DOCTYPE html>\`.

Оригинальный HTML:
\`\`\`html
${htmlContent}
\`\`\`
`;
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });

        let fixedHtml = response.text.trim();
        
        // Clean up the response to ensure it's just HTML
        const htmlMatch = fixedHtml.match(/```html\s*([\s\S]*?)```/);
        if (htmlMatch && htmlMatch[1]) {
            fixedHtml = htmlMatch[1];
        } else {
             if (fixedHtml.startsWith('```') && fixedHtml.endsWith('```')) {
               fixedHtml = fixedHtml.substring(3, fixedHtml.length - 3).trim();
            }
        }

        if (fixedHtml.toLowerCase().includes('<!doctype html>')) {
            return fixedHtml;
        }
        
        throw new Error("ИИ вернул некорректный HTML-код. Пожалуйста, попробуйте снова.");

    } catch (error) {
        console.error("Error applying fixes with Gemini API:", error);
        if (error instanceof Error && (error.message.includes('API key not valid') || error.message.includes('permission denied') || error.message.includes('API_KEY_INVALID'))) {
            throw new Error("API-ключ недействителен. Пожалуйста, проверьте его в настройках.");
        }
        throw new Error("Не удалось применить исправления из-за ошибки API.");
    }
};
