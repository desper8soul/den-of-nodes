import { describe, expect, it } from "vitest";
import {
  isValidMacAddress,
  macAddressSchema,
  normalizeMacAddress,
  redactMacAddress,
} from "./index.js";

describe("normalizeMacAddress", () => {
  it("normalizes dashed format", () => {
    expect(normalizeMacAddress("b0-6e-bf-bb-5a-79")).toBe(
      "B0:6E:BF:BB:5A:79",
    );
  });

  it("normalizes colon format", () => {
    expect(normalizeMacAddress("b0:6e:bf:bb:5a:79")).toBe(
      "B0:6E:BF:BB:5A:79",
    );
  });

  it("normalizes compact format", () => {
    expect(normalizeMacAddress("b06ebfbb5a79")).toBe("B0:6E:BF:BB:5A:79");
  });
});

describe("macAddressSchema", () => {
  it("accepts valid MAC", () => {
    expect(macAddressSchema.parse("B0:6E:BF:BB:5A:79")).toBe(
      "B0:6E:BF:BB:5A:79",
    );
  });

  it("rejects invalid MAC", () => {
    expect(() => macAddressSchema.parse("invalid")).toThrow();
  });
});

describe("isValidMacAddress", () => {
  it("validates uppercase colon format", () => {
    expect(isValidMacAddress("B0:6E:BF:BB:5A:79")).toBe(true);
    expect(isValidMacAddress("B0:6E:BF:BB")).toBe(false);
  });
});

describe("redactMacAddress", () => {
  it("redacts middle octets", () => {
    expect(redactMacAddress("B0:6E:BF:BB:5A:79")).toBe(
      "B0:6E:BF:**:**:79",
    );
  });
});
