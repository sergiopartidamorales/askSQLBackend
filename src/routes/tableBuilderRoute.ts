import dotenv from "dotenv"
dotenv.config();
import { Router, Request, Response } from "express";
const tableBuilderRoute = Router();

 import { tableBuilderController } from "../controllers/tableBuilderController";

tableBuilderRoute.post("/table-builder", tableBuilderController().getData);

export default tableBuilderRoute;