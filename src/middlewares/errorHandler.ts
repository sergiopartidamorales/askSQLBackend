import { Request, Response, NextFunction } from "express";
import { AxiosError } from "axios";

export const errorHandler = (
    err: unknown,
    req: Request,
    res: Response,
    next: NextFunction
) => {
    console.error(err); // log for debugging

    let status = 500;
    let message = "Internal Server Error";

    // Axios error
    if ((err as AxiosError).isAxiosError) {
        const axiosErr = err as AxiosError<{ error: string }>;
        status = axiosErr.response?.status ?? 500;
        message = axiosErr.response?.data?.error ?? axiosErr.message;
    }
    // JS Error
    else if (err instanceof Error) {
        message = err.message;
    }

    res.status(status).json({ error: message });
};

 