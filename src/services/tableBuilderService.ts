import { executeQuery } from "../mssql";
import { LLMClient } from "./helpers/llmClient";
import { getDatabaseSchema, getRelevantTables } from "./helpers/schema.service";
import { SqlPromptBuilder } from "./helpers/sqlPromptBuilder";

type SSECallback = (event: string, data: any) => void;

class QueryBuilderService {
    private llmClient: LLMClient;

    constructor() {
        this.llmClient = new LLMClient();
    }

    private cleanSQL(sql: string): string {
        // Remove markdown code blocks (```sql or ```)
        let cleaned = sql.replace(/```sql\n?/gi, '').replace(/```\n?/g, '');
        // Remove backticks
        cleaned = cleaned.replace(/`/g, '');
        // Remove any leading/trailing whitespace
        cleaned = cleaned.trim();
        return cleaned;
    }

    private assertSafeSql(sql: string): void {
        const normalized = sql.trim();
        if (!/^\s*select\b/i.test(normalized)) {
            throw new Error("Only SELECT queries are allowed");
        }
        if (/[;]+/.test(normalized.replace(/\s*;?\s*$/, ""))) {
            throw new Error("Multiple statements are not allowed");
        }
        if (/\b(insert|update|delete|drop|alter|create|truncate|merge|exec|execute|grant|revoke)\b/i.test(normalized)) {
            throw new Error("Only SELECT queries are allowed");
        }
    }

    getDataTableStream = async (prompt: string, sendEvent: SSECallback): Promise<void> => {
        if (!prompt) {
            throw new Error("Prompt parameter is required");
        }

        sendEvent('status', { message: 'Starting query generation...', step: 1 }); 

         // 1. Build Schema.
        const relevantTables = await getRelevantTables(prompt);
        const schema = await getDatabaseSchema(relevantTables, prompt);          

        // 2. Build prompts
        const systemPrompt = SqlPromptBuilder.buildSystemPrompt(schema);
        const userPrompt = `Generate SQL for: ${prompt}`;

        // 3. Generate SQL using LLM with streaming
        sendEvent('status', { message: 'Generating SQL query...', step: 2 });
        let generatedSQL = '';
        for await (const chunk of this.llmClient.generateCompletionStream(systemPrompt, userPrompt)) {
            generatedSQL += chunk;
            sendEvent('sql-chunk', { chunk });
        }            
  
        const cleanedSQL = this.cleanSQL(generatedSQL);
        this.assertSafeSql(cleanedSQL);

        // 4. Execute query
        sendEvent('status', { message: 'Executing query...', step: 3 });
        const result = await executeQuery(cleanedSQL);

        if (!result) {
            throw new Error("Query execution returned no results");
        }
    
        sendEvent('complete', {
            query: cleanedSQL,
            data: result,
            message: 'Query executed successfully'
        });

        // 5. Final status update
        sendEvent('status', { message: 'Query execution completed', step: 4 });
    } 
}

export default QueryBuilderService;
