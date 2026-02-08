import QueryBuilderService from "../services/tableBuilderService";
import { executeQuery } from "../mssql";
import { getDatabaseSchema, getRelevantTables } from "../services/helpers/schema.service";

jest.mock("../mssql", () => ({
  executeQuery: jest.fn(),
}));

jest.mock("../services/helpers/schema.service", () => ({
  getDatabaseSchema: jest.fn(),
  getRelevantTables: jest.fn(),
}));

const generateCompletionStreamMock = jest.fn();

jest.mock("../services/helpers/llmClient", () => ({
  LLMClient: jest.fn().mockImplementation(() => ({
    generateCompletionStream: generateCompletionStreamMock,
  })),
}));

const mockStream = async function* () {
  yield "```sql\nSELECT * FROM Orders\n```";
};

describe("QueryBuilderService.getDataTableStream", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("streams SQL, cleans it, and executes query", async () => {
    (getRelevantTables as jest.Mock).mockResolvedValue(["Orders"]);
    (getDatabaseSchema as jest.Mock).mockResolvedValue("schema");
    (executeQuery as jest.Mock).mockResolvedValue([{ id: 1 }]);
    generateCompletionStreamMock.mockImplementation(() => mockStream());

    const service = new QueryBuilderService();
    const events: Array<{ event: string; data: any }> = [];

    await service.getDataTableStream("list users", (event, data) => {
      events.push({ event, data });
    });

    expect(executeQuery).toHaveBeenCalledWith("SELECT * FROM Orders");
    expect(events.some(e => e.event === "sql-chunk")).toBe(true);
    expect(events.some(e => e.event === "complete")).toBe(true);
  });

  it("throws when prompt is missing", async () => {
    const service = new QueryBuilderService();

    await expect(
      service.getDataTableStream("", () => undefined)
    ).rejects.toThrow("Prompt parameter is required");
  });
});
