import { executeQuery } from "../data/sqlserver/mssql";
import { LLMClient } from "./helpers/llmClient";
import { getDatabaseSchema, getRelevantTables } from "./helpers/SQL/schema.service";
import { SqlPromptBuilder } from "./helpers/SQL/sqlPromptBuilder";
import { assertSafeSql, cleanSQL, enforceTopLimit } from "./helpers/SQL/sqlUtils";

type SSECallback = (event: string, data: any) => void;
const UNKNOWN_TABLE_OR_COLUMN_ERROR = "ERROR: Unknown table or column";

class QueryBuilderService {
    private llmClient: LLMClient;

    constructor() {
        this.llmClient = new LLMClient();
    }

    getDataTableStream = async (prompt: string, sendEvent: SSECallback): Promise<void> => {
        if (!prompt) {
            throw new Error("Prompt parameter is required");
        }

        sendEvent('status', { message: 'Starting query generation...', step: 1 }); 

         // 1. Build Schema.
        const relevantTables = await getRelevantTables(prompt);
        if (relevantTables.length === 0) {
            sendEvent('complete', {
                query: '',
                data: [],
                message: 'Unknown table or column'
            });
            sendEvent('status', { message: 'Query generation completed', step: 4 });
            return;
        }
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
  
        const cleanedSQL = cleanSQL(generatedSQL);
        if (cleanedSQL.trim().toUpperCase() === UNKNOWN_TABLE_OR_COLUMN_ERROR.toUpperCase()) {
            sendEvent('complete', {
                query: '',
                data: [],
                message: 'Unknown table or column'
            });
            sendEvent('status', { message: 'Query generation completed', step: 4 });
            return;
        }

        assertSafeSql(cleanedSQL);
        const limitedSQL = enforceTopLimit(cleanedSQL, 30);

        // 4. Execute query
        sendEvent('status', { message: 'Executing query...', step: 3 });
        const result = await executeQuery(limitedSQL);

        if (!result) {
            throw new Error("Query execution returned no results");
        }
    
        sendEvent('complete', {
            query: limitedSQL,
            data: result,
            message: 'Query executed successfully'
        });

        // 5. Final status update
        sendEvent('status', { message: 'Query execution completed', step: 4 });
    } 
}

export default QueryBuilderService;
