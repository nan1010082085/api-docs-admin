import { createRouter, createWebHistory } from 'vue-router'
import DocsView from '@/views/DocsView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: DocsView,
    },
    {
      path: '/p/:projectId',
      name: 'project',
      component: DocsView,
    },
    {
      path: '/p/:projectId/:method/:endpointPath(.*)',
      name: 'endpoint',
      component: DocsView,
    },
  ],
})

export default router
