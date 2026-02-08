import { Request, Response, NextFunction } from "express";

// Wrap async route handlers
export const asyncHandler = (fn: Function) => 
    (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };