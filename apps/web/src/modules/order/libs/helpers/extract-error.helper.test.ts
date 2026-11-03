import { describe, expect, it } from "vitest";
import { extractErrorMessage } from "./extract-error.helper.js";

const messages = { schema: "schema", model: "model", timeout: "timeout" };

describe("extractErrorMessage", () => {
  it("uses a different sentence for a timeout, 422, and 502", () => {
    expect(extractErrorMessage(408, "slow", messages)).toBe("timeout");
    expect(extractErrorMessage(422, "bad json", messages)).toBe("schema");
    expect(extractErrorMessage(502, "model request failed", messages)).toBe("model");
  });

  it("keeps the detail for any other failure", () => {
    expect(extractErrorMessage(400, "chat is required", messages)).toBe("chat is required");
    expect(extractErrorMessage(0, null, messages)).toBeNull();
  });
});
