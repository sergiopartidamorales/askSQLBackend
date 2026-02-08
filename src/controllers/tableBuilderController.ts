import { Request, Response } from 'express';
import TableBuilderService from "../services/tableBuilderService";
import { asyncHandler } from '../middlewares/asyncHandler';
const tableBuilderService = new TableBuilderService();

const tableBuilderController = () => ({

    getData: asyncHandler(async (req: Request, res: Response) => {
        const { prompt } = req.body;
        if (!prompt || typeof prompt !== "string") {
            res.status(400).json({ message: 'Prompt parameter is required' });
            return;
        }
        if (prompt.length > 2000) {
            res.status(413).json({ message: "Prompt is too long" });
            return;
        }

        // Set up SSE headers
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
        res.flushHeaders();

        const sendEvent = (event: string, data: any) => {
            res.write(`event: ${event}\n`);
            res.write(`data: ${JSON.stringify(data)}\n\n`);
        };

        try {
            await tableBuilderService.getDataTableStream(prompt, sendEvent);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            sendEvent("error", { message: errorMessage });
        } finally {
            res.end();
        }
    })
});

export { tableBuilderController };
