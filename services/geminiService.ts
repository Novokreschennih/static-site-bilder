
import { GoogleGenAI } from "@google/genai";

// Re-add apiKey parameter as users will now provide their own.
export const optimizeFileName = async (htmlContent: string, apiKey: string): Promise<string> => {
    // Initialize GoogleGenAI with the user-provided API key.
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
        // Provide more specific feedback for invalid API keys.
        if (error.toString().includes('API key not valid')) {
            throw new Error("Неверный API-ключ. Проверьте ключ в настройках.");
        }
        throw new Error("Не удалось оптимизировать имя файла из-за ошибки API.");
    }
};
