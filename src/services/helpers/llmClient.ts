import OpenAI from "openai";
import dotenv from "dotenv";
dotenv.config();

export class LLMClient {
    private openai: OpenAI;
    private maxRetries: number = 3;
    private retryDelay: number = 1000; // 1 second

    constructor() {
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });
    }

    async *generateCompletionStream(systemPrompt: string, userPrompt: string): AsyncGenerator<string, void, unknown> {
        let lastError: Error | null = null;

        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                const stream = await this.openai.chat.completions.create({
                    model: "gpt-4o-mini",
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: userPrompt }
                    ],
                    stream: true,
                });

                for await (const chunk of stream) {
                    const content = chunk.choices[0]?.delta?.content;
                    if (content) {
                        yield content;
                    }
                }                
                // If we successfully complete streaming, exit the retry loop
                return;

            } catch (error) {
                lastError = error instanceof Error ? error : new Error("Unknown streaming error");
                console.error(`Streaming attempt ${attempt} failed:`, lastError.message);

                // Don't wait after the last attempt
                if (attempt < this.maxRetries) {
                    console.log(`Retrying streaming in ${this.retryDelay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, this.retryDelay));
                }
            }
        }

        throw new Error(`Streaming failed after ${this.maxRetries} attempts: ${lastError?.message}`);
    }
}
