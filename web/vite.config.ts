import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'

export default defineConfig({
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
})
