/**
 * 应用启动：用动态 import 加载应用，模块求值期的错误（如 src/api/index.ts 缺 VITE_API_BASE 时抛出的
 * API_BASE_MISSING_MESSAGE）也能被捕获，并以纯文本显示到挂载点，避免白屏。
 */
export async function bootstrap(root: HTMLElement | null, mount: () => Promise<void>): Promise<void> {
  try {
    await mount()
  } catch (err) {
    console.error(err)
    if (root) showBootError(root, err)
  }
}

const STYLE_ID = 'boot-error-style'
/**
 * 配色用带 media query 的 <style>（兼容性优于 light-dark()），文案仍只走 textContent。
 * 对比度（WCAG）：亮色 #a8071a/#fef0f0 = 6.99:1；暗色 #ffa39e/#2b1d1d = 8.47:1（均 ≥ AA 4.5:1）；
 * 边框（图形 ≥ 3:1）：亮色 #e04f4f/#fef0f0 = 3.51:1；暗色 #b35656/#2b1d1d = 3.38:1。
 */
export const BOOT_ERROR_CSS =
  '.boot-error{background:#fef0f0;color:#a8071a;border:1px solid #e04f4f}' +
  '@media (prefers-color-scheme: dark){' +
  // 暗色下外层 wrap 自带暗底并铺满视口：只影响自己的 wrap，不改全局 body（index.html 的 body 本身没有底色）
  '.boot-error-wrap{background:#141414;min-height:100vh}' +
  '.boot-error{background:#2b1d1d;color:#ffa39e;border-color:#b35656}}'

function ensureStyle(): void {
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = BOOT_ERROR_CSS
  document.head.append(style)
}

export function showBootError(root: HTMLElement, err: unknown): void {
  // 外层 flex 居中；提示框左右各留 16px，窄屏（390）不贴边，宽屏最大 640px
  const wrap = document.createElement('div')
  wrap.className = 'boot-error-wrap'
  wrap.style.cssText = 'display:flex;justify-content:center;align-items:flex-start'
  ensureStyle()
  const box = document.createElement('div')
  box.className = 'boot-error'
  box.setAttribute('role', 'alert')
  box.style.cssText =
    'box-sizing:border-box;flex:0 1 640px;max-width:640px;min-width:0;margin:48px 16px;padding:16px 20px;border-radius:8px;' +
    'font:14px/1.6 system-ui,-apple-system,sans-serif;' +
    'white-space:pre-line;word-break:break-word'
  // 只用 textContent，不用 innerHTML
  box.textContent = err instanceof Error ? err.message : String(err)
  wrap.append(box)
  root.replaceChildren(wrap)
}
