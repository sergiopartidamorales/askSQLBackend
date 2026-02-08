# AskSQL Backend - Interview Documentation

## Project Overview

**AskSQL** is a real-time SQL query generation system that converts natural language prompts into executable SQL queries using AI and streaming technology. The backend provides SSE (Server-Sent Events) streaming to deliver real-time progress updates to clients.

**Tech Stack:**
- Node.js + TypeScript + Express
- OpenAI GPT-4o-mini (LLM)
- Microsoft SQL Server
- Server-Sent Events (SSE) for streaming
- Async/Await patterns for concurrency

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      Express Server                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Route Handler: POST /table-builder                  │   │
│  └──────────────────────────────────────────────────────┘   │
│                          ↓                                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Controller (asyncHandler middleware)                │   │
│  │  - Parse prompt from request                         │   │
│  │  - Set SSE headers                                   │   │
│  │  - Handle streaming response                         │   │
│  └──────────────────────────────────────────────────────┘   │
│                          ↓                                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Service Layer (QueryBuilderService)                 │   │
│  │  - Orchestrate the entire workflow                   │   │
│  │  - Manage SSE event emissions                        │   │
│  └──────────────────────────────────────────────────────┘   │
│                          ↓                                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Helper Services                                     │   │
│  │  ├─ Schema Service                                   │   │
│  │  ├─ LLM Client (OpenAI Integration)                  │   │
│  │  └─ SQL Prompt Builder                               │   │
│  └──────────────────────────────────────────────────────┘   │
│                          ↓                                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  MSSQL Execution                                     │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Error Handling Middleware                           │   │
│  │  - Catch all errors from async operations           │   │
│  │  - Format error responses                            │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
         ↓
    ┌─────────────┐
    │   Client    │
    │  (UI App)   │
    └─────────────┘
```

---

## System Design & Workflow

### 1. **Request Flow**

```
User Input (Natural Language Prompt)
         ↓
POST /table-builder
         ↓
Controller receives prompt
         ↓
Sets SSE Response Headers
         ↓
Service.getDataTableStream()
         ↓
[Real-time SSE Events]
         ↓
Client receives streaming updates
```

Data flow (end-to-end):
Client POST /api/table-builder with { prompt }
Controller validates prompt, sets SSE headers
Service
finds relevant tables
loads schema
builds system + user prompts
LLM streams SQL tokens
emits sql-chunk events
Service cleans SQL
DB executes SQL
SSE sends complete with query + results
Client renders streaming progress + final data

### 2. **Step-by-Step Processing**

#### Step 1: Schema Analysis
- **Function**: `getRelevantTables(prompt)` + `getDatabaseSchema(tables, prompt)`
- **Purpose**: Identify which database tables are relevant to the user's query
- **Benefit**: Reduces hallucination by providing only relevant schema to LLM
- **SSE Event**: `status` - "Analyzing database schema..."

#### Step 2: Prompt Engineering
- **Function**: `SqlPromptBuilder.buildSystemPrompt(schema)`
- **System Prompt Content**:
  - Database schema context
  - SQL Server-specific rules
  - Column name case sensitivity
  - No table aliases requirement
  - TOP 30 limit by default
  - **Critical**: Explicit instruction to NOT use markdown code blocks
- **SSE Event**: None (silent preparation)

#### Step 3: LLM Stream Generation
- **Function**: `LLMClient.generateCompletionStream()`
- **Model**: `gpt-4o-mini` (cost-effective, fast)
- **Streaming**: Yes - enables real-time token delivery
- **Retry Logic**: 3 attempts with 1-second delays
- **Key Feature**: Yields tokens as they arrive from OpenAI
- **SSE Events**: 
  - `status` - "Generating SQL query..."
  - `sql-chunk` - Individual token chunks

#### Step 4: SQL Cleaning
- **Function**: `cleanSQL(generatedSQL)`
- **Removes**:
  - Markdown code blocks (`\`\`\`sql\`\`\``)
  - Backticks (`)
  - Leading/trailing whitespace
- **Why**: LLMs sometimes wrap SQL in markdown despite instructions
- **SSE Event**: `sql-complete` - Full cleaned SQL query

#### Step 5: Query Execution
- **Function**: `executeQuery(cleanedSQL)`
- **Database**: Microsoft SQL Server
- **Connection Pool**: Managed via MSSQL driver
- **Error Handling**: Throws if query fails
- **SSE Event**: `status` - "Executing query..."

#### Step 6: Response
- **SSE Event**: `complete` - Final result with:
  - Formatted SQL query
  - Result data
  - Success message
- **Error Handling**: `error` event if anything fails

---

## Key Components

### 1. Controller (`tableBuilderController.ts`)

```typescript
getData: asyncHandler(async (req, res) => {
    // SSE Headers Setup
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();
    
    // Call service with SSE callback
    await tableBuilderService.getDataTableStream(prompt, (event, data) => {
        res.write(`event: ${event}\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    });
})
```

**Responsibilities**:
- Validate input
- Set proper SSE headers for streaming
- Call service layer
- Format and send SSE events
- Handle final response closure

**Headers Explained**:
- `text/event-stream` - Browser recognizes as SSE
- `no-cache` - Prevents caching of streamed data
- `keep-alive` - Maintains connection for streaming
- `X-Accel-Buffering: no` - Disables nginx buffering (production)

---

### 2. Service Layer (`tableBuilderService.ts`)

```typescript
getDataTableStream = async (prompt: string, sendEvent: SSECallback) => {
    // 1. Get relevant schema
    const relevantTables = await getRelevantTables(prompt);
    const schema = await getDatabaseSchema(relevantTables, prompt);
    
    // 2. Build prompts
    const systemPrompt = SqlPromptBuilder.buildSystemPrompt(schema);
    const userPrompt = `Generate SQL for: ${prompt}`;
    
    // 3. Stream SQL generation
    let generatedSQL = '';
    for await (const chunk of this.llmClient.generateCompletionStream(...)) {
        generatedSQL += chunk;
        sendEvent('sql-chunk', { chunk });
    }
    
    // 4. Clean SQL
    const cleanedSQL = this.cleanSQL(generatedSQL);
    
    // 5. Execute query
    const result = await executeQuery(cleanedSQL);
    
    // 6. Send final result
    sendEvent('complete', { query, data: result, message });
}
```

**Key Design Decisions**:
- **No try-catch**: Errors thrown here are caught by `asyncHandler` middleware
- **Callback pattern**: `sendEvent()` allows flexible event handling
- **Generator consumption**: Uses `for await...of` for streaming chunks
- **Orchestration**: Service manages the entire workflow

---

### 3. LLM Client (`llmClient.ts`)

```typescript
async *generateCompletionStream(
    systemPrompt: string, 
    userPrompt: string
): AsyncGenerator<string, void, unknown> {
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
            return; // Success, exit retry loop
            
        } catch (error) {
            lastError = error;
            console.error(`Streaming attempt ${attempt} failed:`, error.message);
            
            if (attempt < this.maxRetries) {
                await new Promise(r => setTimeout(r, 1000)); // 1 second delay
            }
        }
    }
    
    throw new Error(`Streaming failed after ${this.maxRetries} attempts: ${lastError?.message}`);
}
```

**Key Features**:
- **Generator Function** (`async *`): Returns `AsyncGenerator` for efficient streaming
- **Yield Pattern**: Produces values one at a time
- **Retry Logic**: 3 attempts with exponential-like delay
- **Chunk Processing**: Extracts `delta.content` from OpenAI streaming response
- **Error Handling**: Service-level (not HTTP-level)

**Why Generator Pattern?**:
- Memory efficient (doesn't store entire response)
- Caller controls consumption rate
- Natural for streaming use cases
- Standard Node.js pattern

---

### 4. SQL Prompt Builder (`sqlPromptBuilder.ts`)

```typescript
static buildSystemPrompt(schema: string): string {
    return `
        You are a Microsoft SQL Server query builder.
        
        DATABASE SCHEMA:
        ${schema}
        
        CRITICAL RULES:
        1. Column names are CASE-SENSITIVE.
        2. No table aliases — always use full table names.
        3. Use square brackets [TableName].[ColumnName] only when required.
        4. Use TOP 30 by default unless the user specifies a different limit.
        
        OUTPUT FORMAT:
        - Return ONLY the raw SQL query text.
        - DO NOT wrap the SQL in markdown code blocks or backticks.
        - DO NOT add any explanations, comments, or formatting.
        - Just the plain SQL query string.
    `;
}
```

**Prompt Engineering Strategy**:
- **Specificity**: Explicit about database type (MSSQL)
- **Constraints**: Rules prevent hallucination
- **Context**: Schema provided for grounding
- **Output Format**: Multiple reminders about not using markdown
- **Clear Instructions**: No ambiguity about expected output

---

### 5. Schema Service

**Purpose**: Identify relevant tables and fetch schema

**Process**:
1. `getRelevantTables(prompt)` - Uses AI to find relevant tables
2. `getDatabaseSchema(tables, prompt)` - Fetches schema for those tables

**Benefits**:
- Reduces token usage (smaller schema = cheaper API calls)
- Reduces hallucination (LLM only sees relevant tables)
- Faster processing

---

## Configuration

### Environment Variables (`.env`)

```env
OPENAI_API_KEY=sk-xxx...
DATABASE_CONNECTION_STRING=Server=xxx;Database=xxx;...
NODE_ENV=production
PORT=3000
```

### Key Settings

| Setting | Value | Purpose |
|---------|-------|---------|
| Model | gpt-4o-mini | Cost-effective, fast |
| Stream | true | Real-time token delivery |
| Max Retries | 3 | Resilience to API failures |
| Retry Delay | 1000ms | Give API time to recover |
| TOP Limit | 30 | Prevent massive result sets |

---

## Error Handling Strategy

### Multi-Layer Approach

```
1. Service Level
   └─ Try-catch in business logic (removed - let it bubble)
   
2. Controller Level
   └─ asyncHandler catches all async errors
   └─ Formats as SSE error event
   
3. Middleware Level
   └─ errorHandler middleware (for logging, monitoring)
   └─ Centralized error processing
```

### Error Types & Handling

| Error Type | Source | Handling | Response |
|-----------|--------|----------|----------|
| Invalid Prompt | Controller | Validation check | `400 Bad Request` |
| Schema Error | Service | Throws error | SSE `error` event |
| LLM Failure | LLMClient | Retries 3x, then throws | SSE `error` event |
| SQL Syntax | MSSQL | Throws error | SSE `error` event |

### Why asyncHandler?

```typescript
export const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};
```

- Wraps async controllers
- Catches all promise rejections
- Passes to error middleware
- Prevents unhandled promise rejections

---

## Database Integration

### MSSQL Connection

```typescript
import { ConnectionPool } from 'mssql';

const pool = new ConnectionPool(connectionString);
await pool.connect();

const result = await pool.request()
    .query(sqlQuery);
```

### Query Execution

```typescript
async function executeQuery(query: string): Promise<IRecordSet<any>> {
    const pool = await getConnectionPool();
    const result = await pool.request().query(query);
    return result.recordset;
}
```

**Features**:
- Connection pooling for performance
- Prepared statements for security
- Type-safe result handling

---

## SSE (Server-Sent Events) Implementation

### What are SSE?

HTTP protocol for sending real-time updates from server to client. Unlike WebSockets, it's:
- ✅ Unidirectional (server → client)
- ✅ HTTP-based (works with proxies/firewalls)
- ✅ Simple event format
- ✅ Auto-reconnect capability

#
### SSE Message Format

```
event: status
data: {"message":"Analyzing schema...","step":2}

event: sql-chunk
data: {"chunk":"SELECT"}

event: sql-chunk
data: {"chunk":" * FROM"}

event: complete
data: {"query":"SELECT * FROM users","data":[...],"message":"Success"}
```

### Event Types in AskSQL

| Event | Data | Purpose |
|-------|------|---------|
| `status` | `{message, step}` | Progress updates |
| `sql-chunk` | `{chunk}` | Streaming SQL tokens |
| `complete` | `{query, data, message}` | Final result |
| `error` | `{message}` | Error details |



## Conclusion

AskSQL demonstrates a modern approach to AI-powered SQL generation with:
- **Real-time streaming** for immediate feedback
- **Intelligent schema analysis** to reduce hallucination
- **Robust error handling** with retry logic
- **Clean architecture** with separation of concerns
- **Production-ready** design with security and performance in mind

The system successfully bridges natural language user intent with executable SQL, providing a seamless experience through server-sent events streaming.
