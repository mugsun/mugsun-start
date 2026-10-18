export const GROUP_RE = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/
export const ARTIFACT_RE = /^[a-z][a-z0-9-]*$/
const JAVA_KEYWORDS = new Set(
  'abstract assert boolean break byte case catch char class const continue default do double else enum extends final finally float for goto if implements import instanceof int interface long native new package private protected public return short static strictfp super switch synchronized this throw throws transient try void volatile while true false null var record yield'.split(' ')
)

export function isValidGroup(v: string) { return GROUP_RE.test(v) }
export function isValidArtifact(v: string) { return ARTIFACT_RE.test(v) && v.length <= 50 }
export function isValidPackage(v: string) {
  if (!v) return false
  return v.split('.').every((s) => /^[a-z_][a-z0-9_]*$/.test(s) && !JAVA_KEYWORDS.has(s))
}
/** 包名 = Group + "." + Artifact（去掉连字符） */
export function derivePackage(group: string, artifact: string) {
  const a = artifact.replace(/-/g, '')
  return [group, a].filter(Boolean).join('.')
}
