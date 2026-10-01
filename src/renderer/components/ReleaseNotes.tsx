type ReleaseNotesProps = {
  text: string
  limit?: number
}

type Line = { kind: 'heading' | 'item' | 'text'; text: string }

function clean(text: string): string {
  return text
    .replace(/!\[[^\]]*]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/[*_`]{1,3}([^*_`]+)[*_`]{1,3}/g, '$1')
    .trim()
}

export function noteLines(text: string, limit: number): Line[] {
  const lines: Line[] = []
  for (const raw of text.split(/\r?\n/)) {
    if (lines.length >= limit) break
    const line = raw.trim()
    if (!line || /^[-=*_]{3,}$/.test(line)) continue
    const heading = line.match(/^#{1,6}\s+(.*)$/)
    const item = line.match(/^(?:[-*+]|\d+\.)\s+(.*)$/)
    const value = clean(heading?.[1] ?? item?.[1] ?? line)
    if (!value) continue
    lines.push({ kind: heading ? 'heading' : item ? 'item' : 'text', text: value })
  }
  return lines
}

export function ReleaseNotes({ text, limit = 14 }: ReleaseNotesProps) {
  const lines = noteLines(text, limit)
  if (lines.length === 0) return <p className="muted-copy">No notes for this version.</p>
  return (
    <div className="notes">
      {lines.map((line, index) =>
        line.kind === 'heading' ? (
          <h4 key={index}>{line.text}</h4>
        ) : line.kind === 'item' ? (
          <p key={index} className="note-item">
            {line.text}
          </p>
        ) : (
          <p key={index}>{line.text}</p>
        )
      )}
    </div>
  )
}
