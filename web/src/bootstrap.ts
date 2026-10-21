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

export function showBootError(root: HTMLElement, err: unknown): void {
  // 外层 flex 居中；提示框左右各留 16px，窄屏（390）不贴边，宽屏最大 640px
  const wrap = document.createElement('div')
  wrap.style.cssText = 'display:flex;justify-content:center'
  const box = document.createElement('div')
  box.setAttribute('role', 'alert')
  box.style.cssText =
    'box-sizing:border-box;flex:0 1 640px;max-width:640px;min-width:0;margin:48px 16px;padding:16px 20px;border:1px solid #f56c6c;border-radius:8px;' +
    'background:#fef0f0;color:#a8071a;font:14px/1.6 system-ui,-apple-system,sans-serif;' +
    'white-space:pre-line;word-break:break-word'
  // 只用 textContent，不用 innerHTML
  box.textContent = err instanceof Error ? err.message : String(err)
  wrap.append(box)
  root.replaceChildren(wrap)
}
