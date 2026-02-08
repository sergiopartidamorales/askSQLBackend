# Startup Planning Prompt System

A comprehensive system for generating startup planning documentation including PRDs, Epics, and User Stories.

## Overview

This system helps aspiring founders quickly plan their startup ideas by generating:
1. **PRD** (Product Requirements Document) - Strategic product vision and requirements
2. **Epics** - High-level development areas derived from the PRD
3. **User Stories** - Detailed, actionable implementation units

## Architecture

### Type System (`src/Types/index.ts`)

```typescript
PRD → Contains product vision, features, goals, metrics, personas
Epic → Major development area with business value
UserStory → "As a [user], I want [action] so that [benefit]"
StartupPlan → { prd: PRD, epics: Epic[] }
```

### Prompt Builder (`src/services/helpers/startupPromptBuilder.ts`)

Provides two generation strategies:

#### 1. Comprehensive (Single-Pass) - **RECOMMENDED for .new domain**
- Generates everything in one prompt
- Faster response time
- Better for instant value delivery
- Use: `generateStartupPlanStream()`

```typescript
const systemPrompt = StartupPromptBuilder.buildComprehensiveSystemPrompt();
const userPrompt = StartupPromptBuilder.buildComprehensiveUserPrompt(startupIdea);
```

#### 2. Staged (Multi-Step)
- Generates PRD → Epics → User Stories sequentially
- More granular feedback
- Better quality control
- Use: `generateStartupPlanStaged()`

### Service (`src/services/startupLaunchPadService.ts`)

Two main methods:

#### `generateStartupPlanStream(startupIdea, sendEvent)`
- **Best for production** - Fast, single-pass generation
- Streams content in real-time
- Returns complete `StartupPlan`

#### `generateStartupPlanStaged(startupIdea, sendEvent)`
- Stage-by-stage generation with detailed progress
- Better for complex ideas requiring refinement

## Usage Example

```typescript
import StartupLaunchPadService from './services/startupLaunchPadService';

const service = new StartupLaunchPadService();

// Define SSE callback for real-time updates
const sendEvent = (event: string, data: any) => {
    console.log(`[${event}]`, data);
    // In Express: res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
};

// Generate startup plan
const startupIdea = "A food delivery app for busy professionals";
const plan = await service.generateStartupPlanStream(startupIdea, sendEvent);

// Result structure:
// {
//   prd: {
//     productName: "QuickEats",
//     vision: "...",
//     keyFeatures: [...],
//     ...
//   },
//   epics: [
//     {
//       id: "EPIC-001",
//       title: "User Ordering System",
//       userStories: [
//         {
//           story: "As a user, I want to browse restaurants...",
//           acceptanceCriteria: [...],
//           priority: "High",
//           estimatedEffort: "2-3 days"
//         }
//       ]
//     }
//   ]
// }
```

## Streaming Events

The system emits various events during generation:

### Comprehensive Mode Events:
- `status` - Progress updates with step numbers
- `content-chunk` - Streaming content as it's generated
- `complete` - Final summary with counts

### Staged Mode Events:
- `stage` - Current generation stage (prd/epics/user-stories)
- `prd-chunk` - PRD content streaming
- `prd-complete` - Complete PRD object
- `epics-chunk` - Epics content streaming
- `epics-complete` - Epic generation finished
- `epic-progress` - Progress through individual epics
- `stories-chunk` - User stories streaming
- `complete` - Everything finished

## Integration with Controllers

Example controller method:

```typescript
async generatePlan(req: Request, res: Response) {
    const { startupIdea } = req.body;
    
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    const sendEvent = (event: string, data: any) => {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };
    
    try {
        const plan = await this.service.generateStartupPlanStream(startupIdea, sendEvent);
        sendEvent('result', plan);
        res.end();
    } catch (error) {
        sendEvent('error', { message: error.message });
        res.end();
    }
}
```

## Export/Integration Features

The generated `StartupPlan` is a pure JSON object that can be:

1. **Exported as JSON** - Direct download
2. **Exported as Markdown** - Formatted documentation
3. **Integrated with Jira/Linear** - Via their APIs
4. **Exported to CSV** - For spreadsheets
5. **Copied to clipboard** - Quick sharing

Example markdown export:

```typescript
function exportToMarkdown(plan: StartupPlan): string {
    let md = `# ${plan.prd.productName}\n\n`;
    md += `## Vision\n${plan.prd.vision}\n\n`;
    // ... add all sections
    
    plan.epics.forEach(epic => {
        md += `## Epic: ${epic.title}\n`;
        md += `${epic.description}\n\n`;
        epic.userStories.forEach(story => {
            md += `- ${story.story}\n`;
        });
    });
    
    return md;
}
```

## Prompt Engineering Highlights

### Quality Assurance Built Into Prompts:
- **INVEST criteria** for user stories
- **Specific output formats** (JSON schemas)
- **Real-world constraints** (MVP focus, time estimates)
- **Multi-perspective thinking** (users, business, technical)
- **Structured sections** ensure completeness

### Context Preservation:
- PRD context flows into Epic generation
- Epic + PRD context flows into User Story generation
- Maintains consistency across hierarchy

## Performance Optimization

For .new domain requirements (instant value):

1. Use `generateStartupPlanStream()` for fastest response
2. Stream chunks to show immediate progress
3. Parse JSON incrementally if needed
4. Cache common patterns (optional)

## Next Steps

Recommended enhancements:
- [ ] Add refinement prompts (iterate on specific sections)
- [ ] Add validation (check for completeness)
- [ ] Add templates for different industries
- [ ] Add competitive analysis section
- [ ] Add budget/resource estimation
- [ ] Add risk assessment

## Example Ideas to Test

1. "A tool to help remote teams build better work relationships"
2. "An app that connects freelance chefs with people hosting dinner parties"
3. "A platform for students to trade study notes and resources"
4. "A marketplace for local sustainable products"
5. "An AI-powered personal finance coach for Gen Z"

---

Built with ❤️ for aspiring founders
