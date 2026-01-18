import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { useUserStore } from '@/store/user'

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/pages/login/index.vue'),
    meta: { requiresAuth: false },
  },
  {
    path: '/',
    name: 'Lobby',
    component: () => import('@/pages/lobby/index.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/room/:id',
    name: 'Room',
    component: () => import('@/pages/room/index.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/game/:id?',
    name: 'Game',
    component: () => import('@/pages/game/index.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/profile',
    name: 'Profile',
    component: () => import('@/pages/profile/index.vue'),
    meta: { requiresAuth: true },
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

// 路由守卫
router.beforeEach((to, _from, next) => {
  const userStore = useUserStore()
  const requiresAuth = to.meta.requiresAuth !== false

  if (requiresAuth && !userStore.isLoggedIn) {
    next({ name: 'Login', query: { redirect: to.fullPath } })
  } else if (to.name === 'Login' && userStore.isLoggedIn) {
    next({ name: 'Lobby' })
  } else {
    next()
  }
})

export default router
