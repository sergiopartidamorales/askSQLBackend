import { Request, Response, NextFunction } from 'express';
import TableBuilderService from "../services/tableBuilderService";
import { asyncHandler } from '../middlewares/asyncHandler';
const tableBuilderService = new TableBuilderService();

const tableBuilderController = () => ({

    getData: asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        const { prompt } = req.body;
        if (!prompt || typeof prompt !== "string") {
            throw new Error("Prompt parameter is required"), { statusCode: 400 };
        }
        if (prompt.length > 2000) {
            throw new Error("Prompt is too long"), { statusCode: 413 };
        }

        // Set up SSE headers keep this connection open and I’ll keep streaming data to you over time
        // response is live event stream
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering otherwise will send even in one chunk
    
        res.flushHeaders();

        const sendEvent = (event: string, data: any) => {
            res.write(`event: ${event}\n`);
            res.write(`data: ${JSON.stringify(data)}\n\n`);
        };

        try {
            await tableBuilderService.getDataTableStream(prompt, sendEvent);
        } catch (error) {
            if (res.headersSent) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                sendEvent("error", { message: errorMessage });
            } else {
                next(error);                
            }
        } finally {
            res.end();
        }
    })
});

export { tableBuilderController };
