import 'element-plus/dist/index.css'
import './styles/theme.scss'
import 'highlight.js/styles/github.css'
import './styles/index.scss'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { setupElementPlus } from '@/config/element'
import App from './App.vue'
import router from './router'

const app = createApp(App)
app.use(createPinia())
app.use(router)
setupElementPlus(app)
app.mount('#app')
