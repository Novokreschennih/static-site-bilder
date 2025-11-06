import { GoogleGenAI } from "@google/genai";

export const optimizeFileName = async (htmlContent: string, apiKey: string): Promise<string> => {
    if (!apiKey) {
        throw new Error("API-ключ не предоставлен.");
    }
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

    const prompt = `Based on the following HTML content, suggest a short, semantic, and SEO-friendly filename in kebab-case (e.g., 'about-us'). Do not include the '.html' extension. Return only the filename and nothing else.
    
    HTML Content: 
    ${truncatedContent}`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });

        const text = response.text.trim().toLowerCase().replace(/\.html$/, '');
        // Basic validation for filename format
        if (/^[a-z0-9-]+$/.test(text)) {
            return text;
        }
        // Fallback if the model returns something unexpected
        return "optimized-page";

    } catch (error) {
        console.error("Error optimizing filename with Gemini API:", error);
        if (error instanceof Error && (error.message.includes('API key not valid') || error.message.includes('invalid'))) {
             throw new Error("Неверный API ключ. Пожалуйста, проверьте ваш ключ и попробуйте снова.");
        }
        throw new Error("Не удалось оптимизировать имя файла из-за ошибки API.");
    }
};
