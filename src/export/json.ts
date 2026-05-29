import type { ExportDoc } from './types.js'

export function toJson(doc: ExportDoc): string {
  return JSON.stringify(doc, null, 2)
}
