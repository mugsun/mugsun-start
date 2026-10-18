import { createApp } from 'vue'
// Element Plus 组件与样式由 unplugin-vue-components 按需引入；命令式 API 的样式需手动引入
import 'element-plus/es/components/message/style/css'
import 'element-plus/theme-chalk/dark/css-vars.css'
import './styles/theme.css'
import App from './App.vue'
import { i18n } from './i18n'

createApp(App).use(i18n).mount('#app')
