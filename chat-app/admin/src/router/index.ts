import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/',
    component: () => import('@/components/Layout/MainLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        redirect: '/dashboard'
      },
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/views/Dashboard/index.vue'),
        meta: { title: '仪表盘' }
      },
      {
        path: 'users',
        name: 'Users',
        component: () => import('@/views/Users/List.vue'),
        meta: { title: '用户管理' }
      },
      {
        path: 'users/:id',
        name: 'UserDetail',
        component: () => import('@/views/Users/Detail.vue'),
        meta: { title: '用户详情' }
      },
      {
        path: 'users/:id/messages',
        name: 'UserMessages',
        component: () => import('@/views/Users/Messages.vue'),
        meta: { title: '聊天记录' }
      },
      {
        path: 'referrals',
        name: 'Referrals',
        component: () => import('@/views/Referrals/List.vue'),
        meta: { title: '推荐链接' }
      },
      {
        path: 'admins',
        name: 'Admins',
        component: () => import('@/views/Admins/List.vue'),
        meta: { title: '管理员管理' }
      }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// 路由守卫
router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('admin_token')

  if (to.meta.requiresAuth !== false && !token) {
    next('/login')
  } else if (to.path === '/login' && token) {
    next('/dashboard')
  } else {
    next()
  }
})

export default router
