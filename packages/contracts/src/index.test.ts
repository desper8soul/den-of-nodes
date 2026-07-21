import { describe, expect, it } from "vitest";
import {
  isValidMacAddress,
  macAddressSchema,
  normalizeMacAddress,
  redactMacAddress,
} from "./index.js";

describe("normalizeMacAddress", () => {
  it("normalizes dashed format", () => {
    expect(normalizeMacAddress("aa-bb-cc-dd-ee-ff")).toBe(
      "AA:BB:CC:DD:EE:FF",
    );
  });

  it("normalizes colon format", () => {
    expect(normalizeMacAddress("aa:bb:cc:dd:ee:ff")).toBe(
      "AA:BB:CC:DD:EE:FF",
    );
  });

  it("normalizes compact format", () => {
    expect(normalizeMacAddress("aabbccddeeff")).toBe("AA:BB:CC:DD:EE:FF");
  });
});

describe("macAddressSchema", () => {
  it("accepts valid MAC", () => {
    expect(macAddressSchema.parse("AA:BB:CC:DD:EE:FF")).toBe(
      "AA:BB:CC:DD:EE:FF",
    );
  });

  it("rejects invalid MAC", () => {
    expect(() => macAddressSchema.parse("invalid")).toThrow();
  });
});

describe("isValidMacAddress", () => {
  it("validates uppercase colon format", () => {
    expect(isValidMacAddress("AA:BB:CC:DD:EE:FF")).toBe(true);
    expect(isValidMacAddress("B0:6E:BF:BB")).toBe(false);
  });
});

describe("redactMacAddress", () => {
  it("redacts middle octets", () => {
    expect(redactMacAddress("AA:BB:CC:DD:EE:FF")).toBe(
      "AA:BB:CC:**:**:FF",
    );
  });
});
