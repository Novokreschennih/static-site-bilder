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

    // A more focused truncation for analysis
     const truncatedContent = htmlContent.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                                          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                                          .replace(/\s+/g, ' ')
                                          .trim()
                                          .substring(0, 8000);


    const prompt = `Act as a senior frontend developer and SEO specialist. Analyze the following HTML code and provide a concise report in Russian using Markdown formatting. 
Focus on actionable recommendations. Structure your report with the following sections:

### SEO-Анализ
- Check for a descriptive <title> tag.
- Check for a meta description tag.
- Check for a single <h1> tag.
- Verify that all <img> tags have descriptive 'alt' attributes.
- Analyze heading hierarchy (h1, h2, h3).

### Анализ Доступности (Accessibility)
- Point out missing 'alt' attributes on images again if found.
- Check for basic issues like missing <label> tags for form inputs.

### Качество Кода и Рекомендации
- Identify use of deprecated tags or inline styles.
- Suggest general improvements for code cleanliness and best practices.
- Suggest performance improvements like image compression or minifying CSS/JS.

Keep the report brief and to the point. If no issues are found in a section, state that everything looks good.

HTML to analyze:
\`\`\`html
${truncatedContent}
\`\`\`
`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-pro', // Using a more powerful model for analysis
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

    const prompt = `
Act as an expert senior frontend developer. Your task is to analyze and rewrite the provided HTML code to apply improvements based on best practices for SEO, accessibility, and code quality.

Follow these instructions strictly:
1.  Add a descriptive, SEO-friendly <title> tag if it's missing or generic.
2.  Add a meta description tag with a concise summary of the page content.
3.  Ensure there is exactly one <h1> tag, and it's relevant to the page content.
4.  Add descriptive 'alt' attributes to all <img> tags that are missing them.
5.  Correct the heading hierarchy (h1, h2, h3, etc.) for logical document structure.
6.  Remove any inline styles (style="..." attributes) and suggest they be moved to a separate CSS file in a comment if necessary, but do not add a <style> block.
7.  Ensure all form inputs have associated <label> tags.
8.  Clean up any deprecated tags or obvious code quality issues.

Your response MUST be ONLY the full, updated, and valid HTML code. Do not include any explanations, comments, apologies, or markdown formatting (like \`\`\`html) around the code.

Original HTML:
${htmlContent}
`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-pro', // Using pro model for better code manipulation
            contents: prompt,
        });

        // Clean the response to ensure it's just HTML
        let cleanedHtml = response.text.trim();
        if (cleanedHtml.startsWith('```html')) {
            cleanedHtml = cleanedHtml.substring(7);
        }
        if (cleanedHtml.endsWith('```')) {
            cleanedHtml = cleanedHtml.substring(0, cleanedHtml.length - 3);
        }

        return cleanedHtml.trim();

    } catch (error) {
        console.error("Error applying fixes with Gemini API:", error);
        if (error instanceof Error && (error.message.includes('API key not valid') || error.message.includes('permission denied') || error.message.includes('API_KEY_INVALID'))) {
            throw new Error("API-ключ недействителен. Пожалуйста, проверьте его в настройках.");
        }
        throw new Error("Не удалось применить исправления из-за ошибки API.");
    }
};