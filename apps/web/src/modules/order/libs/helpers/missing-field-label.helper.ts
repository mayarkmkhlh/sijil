import type { Copy } from "../../../../hooks/use-language/copy.js";
import { askFieldKeys, type AskField } from "./missing-ask.helper.js";

const itemPath =
  /^items\.(\d+)\.(name|qty|unit_price|variant|variant\.size|variant\.colour|variant\.text)$/;

export function missingFieldLabel(path: string, copy: Copy): string {
  if ((askFieldKeys as readonly string[]).includes(path)) return copy.fields[path as AskField];
  if (path === "currency") return copy.currency;
  if (path === "items") return copy.itemsMissing;
  const match = itemPath.exec(path);
  if (!match) return path;
  const index = Number(match[1]) + 1;
  const key = match[2] as keyof Copy["itemGap"];
  return copy.itemGap[key](index);
}
