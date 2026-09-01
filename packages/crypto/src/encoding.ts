import { concatBytes, uint32BE, uint64BE, utf8ToBytes } from "./bytes.js";

export type EncodableField =
  | { readonly kind: "string"; readonly value: string }
  | { readonly kind: "uint64"; readonly value: number | bigint };

export function stringField(value: string): EncodableField {
  return { kind: "string", value };
}

export function uint64Field(value: number | bigint): EncodableField {
  return { kind: "uint64", value };
}

// Length-prefixes every field so distinct field boundaries can never collide
// once concatenated (e.g. roomId="a"+epoch=11 vs roomId="a1"+epoch=1).
export function encodeFields(fields: readonly EncodableField[]): Uint8Array {
  const parts: Uint8Array[] = [];
  for (const field of fields) {
    const content =
      field.kind === "string" ? utf8ToBytes(field.value) : uint64BE(BigInt(field.value));
    parts.push(uint32BE(content.length), content);
  }
  return concatBytes(...parts);
}
