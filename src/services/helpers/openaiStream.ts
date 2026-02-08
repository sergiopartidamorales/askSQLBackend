// services/helpers/openaiStream.ts
import fetch from "node-fetch";

export async function* streamTokensFromOpenAI(systemPrompt: string, userPrompt: string) {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
            model: "gpt-4o-mini",
            stream: true,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ],
        }),
    });

    if (!response.ok || !response.body) {
        throw new Error(`OpenAI stream failed: ${response.statusText}`);
    }

    // Node.js Readable stream supports async iteration directly
    for await (const chunk of response.body) {
        // chunk is a Buffer
        const text = chunk.toString("utf-8");
        yield text;
    }
}