import { describe, expect, it } from "vitest";

import { bytesToHex } from "./bytes.js";
import { encodeFields, stringField, uint64Field } from "./encoding.js";

describe("encodeFields", () => {
  it("does not collide when naive concatenation would", () => {
    // Naive "a" + "11" and "a1" + "1" both concatenate to "a11".
    const a = encodeFields([stringField("a"), uint64Field(11)]);
    const b = encodeFields([stringField("a1"), uint64Field(1)]);

    expect(bytesToHex(a)).not.toBe(bytesToHex(b));
  });

  it("distinguishes different field orderings", () => {
    const a = encodeFields([stringField("room"), uint64Field(3)]);
    const b = encodeFields([uint64Field(3), stringField("room")]);

    expect(bytesToHex(a)).not.toBe(bytesToHex(b));
  });

  it("is deterministic and round-trips through equal input", () => {
    const fields = [stringField("roomId"), uint64Field(42), stringField("deviceId")];

    expect(bytesToHex(encodeFields(fields))).toBe(bytesToHex(encodeFields(fields)));
  });

  it("lowercases string fields so case cannot smuggle extra distinctness", () => {
    const a = encodeFields([stringField("RoomId")]);
    const b = encodeFields([stringField("roomid")]);

    expect(bytesToHex(a)).toBe(bytesToHex(b));
  });

  it("encodes an empty field list as an empty buffer", () => {
    expect(encodeFields([]).length).toBe(0);
  });
});
