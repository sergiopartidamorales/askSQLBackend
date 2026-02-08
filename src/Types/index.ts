import { IRecordSet } from "mssql";

export type QueryResult = {
    query: string;                // the generated SQL
    data?: IRecordSet<any>;       // result if execution succeeds  
};
