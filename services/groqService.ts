const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

interface GroqChatResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

const getGroqApiKey = () => import.meta.env.VITE_GROQ_API_KEY?.trim();

const getGroqModel = () =>
  import.meta.env.VITE_GROQ_MODEL?.trim() || 'llama-3.1-8b-instant';

export const optimizeImagePromptWithGroq = async (rawPrompt: string): Promise<string> => {
  const prompt = rawPrompt.trim();
  if (!prompt) return '';

  const apiKey = getGroqApiKey();
  if (!apiKey) {
    return prompt;
  }

  try {
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: getGroqModel(),
        temperature: 0.2,
        max_tokens: 180,
        messages: [
          {
            role: 'system',
            content:
              'You optimize image-edit prompts. Keep intent, style, and subject clear. Return only one concise prompt.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Groq request failed (${response.status})`);
    }

    const data = (await response.json()) as GroqChatResponse;
    const optimized = data.choices?.[0]?.message?.content?.trim();
    return optimized || prompt;
  } catch (error) {
    console.warn('Groq optimize prompt fallback to raw prompt:', error);
    return prompt;
  }
};
