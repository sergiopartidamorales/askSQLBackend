# AskSQL Backend - Interview Documentation

## Overview

AskSQL is a real-time SQL query generation backend that converts natural language prompts into executable Microsoft SQL Server queries using AI and Server-Sent Events (SSE). The API streams status updates and SQL token chunks to the client, then returns the final query and result data.

Tech stack
- Node.js + TypeScript + Express
- OpenAI GPT-4o-mini (LLM)
- Microsoft SQL Server
- Server-Sent Events (SSE)

## Features

- Streaming SQL generation over SSE
- Schema-aware prompt building to reduce hallucinations
- Retry logic for OpenAI streaming
- MSSQL execution with connection pooling
- Centralized error handling

## Architecture Overview

```
+------------------------------+
|        Express Server        |
+------------------------------+
| POST /table-builder          |
|  - Controller (SSE setup)    |
|  - Service orchestration     |
|  - Helper services           |
|    - Schema service          |
|    - LLM client              |
|    - SQL prompt builder      |
|  - MSSQL execution           |
|  - Error middleware          |
+------------------------------+
             |
             v
         Client (UI)
```

## Request Flow

```
User Prompt
  -> POST /table-builder
  -> Controller validates prompt and sets SSE headers
  -> Service loads schema and builds prompts
  -> LLM streams SQL chunks
  -> Service cleans SQL
  -> DB executes SQL
  -> SSE emits complete + status
```

## Endpoint

### POST /table-builder

Request body

```json
{
  "prompt": "List the top 10 customers by total spend"
}
```

Validation
- `prompt` is required and must be a string
- `prompt` length must be <= 2000

SSE events
- `status` with `{ message, step }`
- `sql-chunk` with `{ chunk }`
- `complete` with `{ query, data, message }`
- `error` with `{ message }`

Example SSE stream

```
event: status
data: {"message":"Starting query generation...","step":1}

event: status
data: {"message":"Generating SQL query...","step":2}

event: sql-chunk
data: {"chunk":"SELECT"}

event: status
data: {"message":"Executing query...","step":3}

event: complete
data: {"query":"SELECT ...","data":[...],"message":"Query executed successfully"}

event: status
data: {"message":"Query execution completed","step":4}
```

Sample curl

```bash
curl -N -H "Content-Type: application/json" \
  -d '{"prompt":"Show top 5 orders by total"}' \
  http://localhost:3000/table-builder
```

## System Design Details

### 1) Schema Analysis
- Functions: `getRelevantTables(prompt)` and `getDatabaseSchema(tables, prompt)`
- Purpose: restrict schema context to relevant tables
- SSE: `status` -> "Starting query generation..."

### 2) Prompt Engineering
- Function: `SqlPromptBuilder.buildSystemPrompt(schema)`
- Behavior: includes strict rules and returns `ERROR: Unknown table or column` if the request references missing schema
- Rules enforced
- Column names are case-sensitive
- No table aliases
- Default `TOP 30` if no limit provided
- Output is raw SQL only, no markdown

### 3) LLM Streaming
- Function: `LLMClient.generateCompletionStream()`
- Model: `gpt-4o-mini`
- Retries: 3 attempts, 1 second delay
- Streaming: yields token chunks to the service

### 4) SQL Cleaning
- Function: `cleanSQL()`
- Removes markdown code blocks and backticks
- Trims whitespace

### 5) Query Execution
- Function: `executeQuery()`
- Database: Microsoft SQL Server
- Errors bubble up to controller and are sent as SSE `error`

## Configuration

Environment variables in `.env`

```env
OPENAI_API_KEY=sk-xxx...
DATABASE_CONNECTION_STRING=Server=xxx;Database=xxx;...
NODE_ENV=production
PORT=3000
```

## Error Handling

- Controller validates input and handles SSE error events
- Service throws on invalid prompt, LLM failure, or DB failure
- Async handler middleware catches uncaught rejections

## Local Development

Install dependencies

```bash
npm install
```

Run in dev mode

```bash
npm run dev
```

Run tests

```bash
npm test
```

## Notes

- This service only supports Microsoft SQL Server (MSSQL).
- This service assumes an MSSQL schema and will not generate SQL for unknown tables or columns.
- SSE clients should keep the connection open and handle incremental `sql-chunk` events.

## Required Environment Variables

These must be populated to connect to your SQL Server instance.

```env
DB_CONNECTION_STRING=xxxx
PORT=8080
DATABASE_SERVER=xxxx
DATABASE_PORT=xxx
DATABASE_NAME=xxxx
DATABASE_USER=xxxx
DATABASE_PASSWORD=xxxx
```

These must be populated to connect to your OpenAI
 
OPENAI_API_KEY=xxxx
```env
 