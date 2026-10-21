// Element Plus 组件与样式由 unplugin-vue-components 按需引入；命令式 API 的样式需手动引入
import 'element-plus/es/components/message/style/css'
import 'element-plus/theme-chalk/dark/css-vars.css'
import './styles/theme.css'
import { bootstrap } from './bootstrap'

// App / i18n 动态引入：api 模块求值时若抛错（如生产缺 VITE_API_BASE），bootstrap 能捕获并显示到 #app
void bootstrap(document.getElementById('app'), async () => {
  const [{ createApp }, { default: App }, { i18n }] = await Promise.all([
    import('vue'),
    import('./App.vue'),
    import('./i18n')
  ])
  createApp(App).use(i18n).mount('#app')
})
