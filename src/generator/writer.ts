import * as fs from 'node:fs';
import * as path from 'node:path';

export const EXPORT_DIR = path.resolve('./exported-project');

export function overwriteFile(filePath: string, content: string) {
  const normalized = filePath.replace(/\\/g, '/');
  fs.mkdirSync(path.dirname(normalized), { recursive: true });
  fs.writeFileSync(normalized, content, 'utf-8');
}
