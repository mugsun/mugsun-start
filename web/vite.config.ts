import { defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import { resolveApiMode } from './src/api/mode'

export default defineConfig(({ command, mode }) => {
  // 生产构建在构建期就检查接口地址：没设 VITE_API_BASE 也没显式 VITE_USE_MOCK=1 时直接失败（错误信息含修复方法）
  if (command === 'build' && mode === 'production') {
    // loadEnv 会合并 .env* 文件（web/ 目录，pnpm 脚本在此运行）与同前缀的进程环境变量（后者优先）
    const env = loadEnv(mode, '.', 'VITE_')
    resolveApiMode({ production: true, apiBase: env.VITE_API_BASE, useMock: env.VITE_USE_MOCK })
  }
  return {
    plugins: [
      vue(),
      // Element Plus 按需引入（组件 + 对应 CSS）；主题覆盖见 styles/theme.css 的选择器优先级说明
      Components({ resolvers: [ElementPlusResolver({ importStyle: 'css' })], dts: 'src/components.d.ts' })
    ],
    resolve: { alias: { '@': '/src' } },
    server: { port: 3093, strictPort: true },
    // 预构建常用依赖，避免按需引入时首次打开页面触发二次依赖优化和整页刷新
    optimizeDeps: { include: ['vue', 'vue-i18n', '@vueuse/core', '@element-plus/icons-vue', 'element-plus/es'] },
    test: { environment: 'node', include: ['src/**/*.test.ts'], css: true, server: { deps: { inline: ['element-plus'] } } }
  }
})
