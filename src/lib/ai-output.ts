export function sanitizeAiOutput(text: string): string {
  if (!text) return ''

  let cleaned = text
    .replace(/\r\n/g, '\n')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/`{1,3}([^`]+)`{1,3}/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\\\*/g, '*')
    .replace(/\*\*/g, '')
    .replace(/__/g, '')

  cleaned = cleaned
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trim()

  return cleaned
}
