import request from "supertest";
import app from "../app";

describe("POST /api/table-builder", () => {
  beforeAll(() => {
    process.env.NODE_ENV = "test";
  });

  it("returns 400 when prompt is missing", async () => {
    const response = await request(app)
      .post("/api/table-builder")
      .send({});

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: "Prompt parameter is required" });
  });
});
