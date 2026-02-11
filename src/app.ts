import express, {Application, Request} from "express";
import cors from "cors";
const app : Application = express();
import dotenv from "dotenv"
import tableBuilderRoute from "./routes/tableBuilderRoute";
import { errorHandler } from "./middlewares/errorHandler";


dotenv.config();
app.use(cors({origin: "*"}));

const PORT = process.env.PORT || 8080;
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (req: Request, res) => { res.send("Hello, World!");});
app.use("/api",  tableBuilderRoute); 

app.use(errorHandler);


if (process.env.NODE_ENV !== "test") {
    app.listen(PORT, () => {
        console.log(`Server is running on http://localhost:${PORT}`);
    });
}

export default app;

 