export interface TreeNode { id: string; label: string; isFile: boolean; children?: TreeNode[] }

export interface TreeInput {
  artifact: string
  packageName: string
  fullstack: boolean
  /** 已选的可选模块，短 id：gis / track / ai */
  modules: string[]
}

function pascal(s: string) {
  const p = s.split(/[^a-zA-Z0-9]+/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join('')
  return p || 'Demo'
}

/** 把路径列表转成树；目录在前、文件在后，各自按字母排序 */
export function pathsToTree(paths: string[]): TreeNode[] {
  const root: TreeNode = { id: '', label: '', isFile: false, children: [] }
  for (const p of paths) {
    const parts = p.split('/')
    let cur = root
    parts.forEach((part, i) => {
      const id = parts.slice(0, i + 1).join('/')
      const isFile = i === parts.length - 1
      let next = cur.children!.find((c) => c.label === part)
      if (!next) {
        next = { id, label: part, isFile, ...(isFile ? {} : { children: [] }) }
        cur.children!.push(next)
      }
      cur = next
    })
  }
  const sort = (n: TreeNode[]) => {
    n.sort((a, b) => (a.isFile === b.isFile ? a.label.localeCompare(b.label) : a.isFile ? 1 : -1))
    n.forEach((c) => c.children && sort(c.children))
  }
  sort(root.children!)
  return root.children!
}

/** 依据选项生成预览路径（一期为示意，最终以后端生成结果为准） */
export function buildPaths(o: TreeInput): string[] {
  const a = o.artifact || 'demo'
  const pkg = (o.packageName || 'com.example.demo').replace(/\./g, '/')
  const app = `${pascal(a)}Application`
  const r = `${a}/`
  const paths = [
    'README.md', 'pom.xml', 'mvnw', 'mvnw.cmd', 'docker-compose.yml', '.gitignore',
    '.mvn/wrapper/maven-wrapper.properties',
    `src/main/java/${pkg}/${app}.java`,
    'src/main/resources/application.yml',
    'src/main/resources/application-dev.yml',
    `src/test/java/${pkg}/${app}Tests.java`
  ].map((p) => r + p)
  for (const m of o.modules) paths.push(`${r}src/main/resources/config/mugsun-${m}.yml`)
  if (o.fullstack) {
    const pc = `${r}${a}-pc/`
    paths.push(
      ...['package.json', 'index.html', 'vite.config.ts', 'tsconfig.json', '.env', '.env.production',
        'src/main.ts', 'src/App.vue', 'src/router/index.ts', 'src/router/modules/system.ts',
        'src/views/system/user/index.vue', 'src/views/system/role/index.vue', 'src/views/system/menu/index.vue',
        'src/views/system/flow-def/index.vue', 'src/views/system/gen/index.vue', 'src/locales/zh.json', 'src/locales/en.json'
      ].map((p) => pc + p)
    )
    for (const m of o.modules) paths.push(...['routes.ts', 'api.ts', 'views/index.vue'].map((p) => `${pc}src/modules/${m}/${p}`))
  }
  return paths
}

export function buildTree(o: TreeInput) { return pathsToTree(buildPaths(o)) }

export function countFiles(nodes: TreeNode[]): number {
  return nodes.reduce((n, c) => n + (c.isFile ? 1 : countFiles(c.children ?? [])), 0)
}

export function allIds(nodes: TreeNode[], out: string[] = []): string[] {
  for (const n of nodes) { out.push(n.id); if (n.children) allIds(n.children, out) }
  return out
}

/** 前两层目录的 id，用于默认展开 */
export function topDirIds(nodes: TreeNode[], depth = 2): string[] {
  if (depth <= 0) return []
  return nodes.filter((n) => !n.isFile).flatMap((n) => [n.id, ...topDirIds(n.children ?? [], depth - 1)])
}
