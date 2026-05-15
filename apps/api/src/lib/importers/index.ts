import { ImportToolSlug, ParseResult } from './types'
import { parseO2S } from './o2s'
import { parseQuantalys } from './quantalys'
import { parseWealthcome } from './wealthcome'

export * from './types'

export function parseImportFile(tool: ImportToolSlug, buffer: Buffer, filename: string): ParseResult {
  switch (tool) {
    case 'O2S':        return parseO2S(buffer, filename)
    case 'QUANTALYS':  return parseQuantalys(buffer, filename)
    case 'WEALTHCOME': return parseWealthcome(buffer, filename)
  }
}
