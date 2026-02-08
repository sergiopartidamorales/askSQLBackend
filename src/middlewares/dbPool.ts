import { Request, Response, NextFunction } from "express";
import { getPool } from "../mssql";
import { ConnectionPool } from "mssql";

declare module "express-serve-static-core" {
  interface Request {
    db?: ConnectionPool;
  }
}

export const dbPoolMiddleware = async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  try {
    req.db = await getPool();
    next();
  } catch (error) {
    next(error);
  }
};
