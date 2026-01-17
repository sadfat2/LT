<script setup lang="ts">
import { onLaunch, onShow, onHide } from '@dcloudio/uni-app'
import { useUserStore } from './store/user'
import { useSocketStore } from './store/socket'
import { useCallStore } from './store/call'

onLaunch(() => {
  console.log('App Launch')
  // 检查登录状态
  const userStore = useUserStore()
  userStore.checkAuth()

  // 初始化通话事件监听（全局只初始化一次）
  const callStore = useCallStore()
  callStore.initCallListeners()
})

onShow(() => {
  console.log('App Show')
})

onHide(() => {
  console.log('App Hide')
})
</script>

<style>
/* ================================================
   NEBULA Design System - 深邃星空设计系统
   ================================================ */

/* 引入 Google Fonts */
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

/* CSS 变量定义 */
page {
  /* === 色彩系统 === */

  /* 背景色 */
  --bg-deep: #0a0a0f;
  --bg-primary: #0d0d14;
  --bg-secondary: #12121a;
  --bg-elevated: #1a1a24;
  --bg-glass: rgba(255, 255, 255, 0.03);
  --bg-glass-hover: rgba(255, 255, 255, 0.06);
  --bg-glass-active: rgba(255, 255, 255, 0.08);

  /* 主题渐变 */
  --gradient-primary: linear-gradient(135deg, #a855f7 0%, #ec4899 100%);
  --gradient-secondary: linear-gradient(135deg, #22d3ee 0%, #a855f7 100%);
  --gradient-aurora: linear-gradient(135deg, #0ea5e9 0%, #a855f7 50%, #ec4899 100%);
  --gradient-subtle: linear-gradient(180deg, rgba(168, 85, 247, 0.1) 0%, rgba(236, 72, 153, 0.05) 100%);
  --gradient-card: linear-gradient(145deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.02) 100%);

  /* 强调色 */
  --accent-primary: #a855f7;
  --accent-secondary: #ec4899;
  --accent-tertiary: #22d3ee;
  --accent-success: #10b981;
  --accent-warning: #f59e0b;
  --accent-danger: #ef4444;

  /* 文字颜色 */
  --text-primary: #f8fafc;
  --text-secondary: rgba(248, 250, 252, 0.7);
  --text-tertiary: rgba(248, 250, 252, 0.5);
  --text-muted: rgba(248, 250, 252, 0.3);

  /* 边框 */
  --border-subtle: rgba(255, 255, 255, 0.06);
  --border-default: rgba(255, 255, 255, 0.1);
  --border-accent: rgba(168, 85, 247, 0.3);
  --border-glow: rgba(168, 85, 247, 0.5);

  /* 阴影 */
  --shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 16px rgba(0, 0, 0, 0.4);
  --shadow-lg: 0 8px 32px rgba(0, 0, 0, 0.5);
  --shadow-glow: 0 0 20px rgba(168, 85, 247, 0.2);
  --shadow-glow-accent: 0 0 30px rgba(168, 85, 247, 0.3);

  /* 模糊效果 */
  --blur-sm: blur(8px);
  --blur-md: blur(16px);
  --blur-lg: blur(24px);

  /* === 排版系统 === */
  --font-primary: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-mono: 'JetBrains Mono', 'SF Mono', Consolas, monospace;

  /* 字号 */
  --text-xs: 22rpx;
  --text-sm: 24rpx;
  --text-base: 28rpx;
  --text-md: 30rpx;
  --text-lg: 32rpx;
  --text-xl: 36rpx;
  --text-2xl: 42rpx;
  --text-3xl: 52rpx;
  --text-4xl: 64rpx;

  /* 行高 */
  --leading-tight: 1.25;
  --leading-normal: 1.5;
  --leading-relaxed: 1.75;

  /* 字重 */
  --font-light: 300;
  --font-normal: 400;
  --font-medium: 500;
  --font-semibold: 600;
  --font-bold: 700;

  /* === 间距系统 === */
  --space-xs: 8rpx;
  --space-sm: 12rpx;
  --space-md: 16rpx;
  --space-lg: 24rpx;
  --space-xl: 32rpx;
  --space-2xl: 48rpx;
  --space-3xl: 64rpx;

  /* === 圆角系统 === */
  --radius-sm: 8rpx;
  --radius-md: 12rpx;
  --radius-lg: 16rpx;
  --radius-xl: 24rpx;
  --radius-2xl: 32rpx;
  --radius-full: 9999rpx;

  /* === 动画系统 === */
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);

  --duration-fast: 150ms;
  --duration-normal: 250ms;
  --duration-slow: 400ms;

  /* 页面基础样式 */
  background: var(--bg-deep);
  font-family: var(--font-primary);
  font-size: var(--text-base);
  color: var(--text-primary);
  line-height: var(--leading-normal);
  min-height: 100vh;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* ================================================
   全局通用样式
   ================================================ */

/* 容器 */
.container {
  padding: var(--space-xl);
}

/* Flex 布局工具 */
.flex {
  display: flex;
}

.flex-center {
  display: flex;
  align-items: center;
  justify-content: center;
}

.flex-between {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.flex-1 {
  flex: 1;
}

.flex-col {
  display: flex;
  flex-direction: column;
}

/* ================================================
   玻璃拟态卡片
   ================================================ */

.glass-card {
  background: var(--bg-glass);
  backdrop-filter: var(--blur-md);
  -webkit-backdrop-filter: var(--blur-md);
  border: 1rpx solid var(--border-subtle);
  border-radius: var(--radius-xl);
}

.glass-card-elevated {
  background: var(--gradient-card);
  backdrop-filter: var(--blur-lg);
  -webkit-backdrop-filter: var(--blur-lg);
  border: 1rpx solid var(--border-default);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-md);
}

/* ================================================
   按钮系统
   ================================================ */

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-lg) var(--space-2xl);
  font-size: var(--text-md);
  font-weight: var(--font-semibold);
  font-family: var(--font-primary);
  border-radius: var(--radius-lg);
  border: none;
  cursor: pointer;
  transition: all var(--duration-normal) var(--ease-out);
  position: relative;
  overflow: hidden;
}

.btn-primary {
  background: var(--gradient-primary);
  color: var(--text-primary);
  box-shadow: var(--shadow-glow);
}

.btn-primary:active {
  transform: scale(0.98);
  box-shadow: var(--shadow-glow-accent);
}

.btn-primary[disabled] {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  background: var(--bg-glass);
  color: var(--text-primary);
  border: 1rpx solid var(--border-default);
  backdrop-filter: var(--blur-sm);
}

.btn-secondary:active {
  background: var(--bg-glass-active);
}

.btn-ghost {
  background: transparent;
  color: var(--text-secondary);
}

.btn-ghost:active {
  color: var(--text-primary);
  background: var(--bg-glass);
}

.btn-danger {
  background: rgba(239, 68, 68, 0.15);
  color: var(--accent-danger);
  border: 1rpx solid rgba(239, 68, 68, 0.3);
}

.btn-danger:active {
  background: rgba(239, 68, 68, 0.25);
}

/* ================================================
   输入框系统
   ================================================ */

.input {
  width: 100%;
  padding: var(--space-lg) var(--space-xl);
  font-size: var(--text-md);
  font-family: var(--font-primary);
  color: var(--text-primary);
  background: var(--bg-glass);
  border: 1rpx solid var(--border-subtle);
  border-radius: var(--radius-lg);
  transition: all var(--duration-normal) var(--ease-out);
  backdrop-filter: var(--blur-sm);
}

.input::placeholder {
  color: var(--text-muted);
}

.input:focus {
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 3rpx rgba(168, 85, 247, 0.15);
  background: var(--bg-glass-hover);
}

/* ================================================
   列表项样式
   ================================================ */

.list-item {
  display: flex;
  align-items: center;
  padding: var(--space-lg) var(--space-xl);
  background: var(--bg-glass);
  border-bottom: 1rpx solid var(--border-subtle);
  transition: all var(--duration-fast) var(--ease-out);
}

.list-item:active {
  background: var(--bg-glass-active);
}

.list-item:first-child {
  border-radius: var(--radius-xl) var(--radius-xl) 0 0;
}

.list-item:last-child {
  border-bottom: none;
  border-radius: 0 0 var(--radius-xl) var(--radius-xl);
}

.list-item:only-child {
  border-radius: var(--radius-xl);
}

/* ================================================
   头像系统
   ================================================ */

.avatar {
  width: 88rpx;
  height: 88rpx;
  border-radius: var(--radius-lg);
  background: var(--bg-elevated);
  border: 2rpx solid var(--border-subtle);
  object-fit: cover;
}

.avatar-sm {
  width: 64rpx;
  height: 64rpx;
  border-radius: var(--radius-md);
}

.avatar-lg {
  width: 120rpx;
  height: 120rpx;
  border-radius: var(--radius-xl);
}

.avatar-xl {
  width: 160rpx;
  height: 160rpx;
  border-radius: var(--radius-2xl);
}

.avatar-round {
  border-radius: var(--radius-full);
}

.avatar-glow {
  box-shadow: 0 0 20rpx rgba(168, 85, 247, 0.3);
  border-color: var(--border-accent);
}

/* ================================================
   徽章系统
   ================================================ */

.badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 36rpx;
  height: 36rpx;
  padding: 0 var(--space-sm);
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  background: var(--gradient-primary);
  border-radius: var(--radius-full);
  box-shadow: 0 0 10rpx rgba(168, 85, 247, 0.4);
}

.badge-dot {
  width: 16rpx;
  height: 16rpx;
  padding: 0;
  min-width: unset;
}

.badge-success {
  background: var(--accent-success);
  box-shadow: 0 0 10rpx rgba(16, 185, 129, 0.4);
}

.badge-warning {
  background: var(--accent-warning);
  box-shadow: 0 0 10rpx rgba(245, 158, 11, 0.4);
}

/* ================================================
   空状态
   ================================================ */

.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-3xl) var(--space-xl);
}

.empty-icon {
  font-size: 100rpx;
  margin-bottom: var(--space-lg);
  opacity: 0.3;
}

.empty-text {
  font-size: var(--text-base);
  color: var(--text-muted);
  text-align: center;
}

/* ================================================
   分割线
   ================================================ */

.divider {
  height: 1rpx;
  background: var(--border-subtle);
  margin: var(--space-lg) 0;
}

.divider-vertical {
  width: 1rpx;
  height: 100%;
  background: var(--border-subtle);
  margin: 0 var(--space-lg);
}

/* ================================================
   渐变文字
   ================================================ */

.text-gradient {
  background: var(--gradient-primary);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.text-gradient-aurora {
  background: var(--gradient-aurora);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* ================================================
   发光边框
   ================================================ */

.glow-border {
  position: relative;
}

.glow-border::before {
  content: '';
  position: absolute;
  inset: -2rpx;
  background: var(--gradient-primary);
  border-radius: inherit;
  z-index: -1;
  opacity: 0.5;
  filter: blur(8rpx);
}

/* ================================================
   动画关键帧
   ================================================ */

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(20rpx);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes fadeInScale {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

@keyframes shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

@keyframes glow {
  0%, 100% {
    box-shadow: 0 0 20rpx rgba(168, 85, 247, 0.3);
  }
  50% {
    box-shadow: 0 0 40rpx rgba(168, 85, 247, 0.5);
  }
}

@keyframes float {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10rpx);
  }
}

@keyframes ripple {
  0% {
    transform: scale(1);
    opacity: 0.4;
  }
  100% {
    transform: scale(2.5);
    opacity: 0;
  }
}

/* 动画工具类 */
.animate-fade-in {
  animation: fadeIn var(--duration-slow) var(--ease-out);
}

.animate-fade-in-scale {
  animation: fadeInScale var(--duration-normal) var(--ease-spring);
}

.animate-pulse {
  animation: pulse 2s var(--ease-in-out) infinite;
}

.animate-glow {
  animation: glow 3s var(--ease-in-out) infinite;
}

.animate-float {
  animation: float 3s var(--ease-in-out) infinite;
}

/* ================================================
   滚动条样式 (仅 H5)
   ================================================ */

::-webkit-scrollbar {
  width: 6rpx;
  height: 6rpx;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: var(--border-default);
  border-radius: var(--radius-full);
}

::-webkit-scrollbar-thumb:hover {
  background: var(--border-accent);
}

/* ================================================
   选择高亮
   ================================================ */

::selection {
  background: rgba(168, 85, 247, 0.3);
  color: var(--text-primary);
}

/* ================================================
   过渡动画类
   ================================================ */

.transition-all {
  transition: all var(--duration-normal) var(--ease-out);
}

.transition-colors {
  transition: color var(--duration-normal) var(--ease-out),
              background-color var(--duration-normal) var(--ease-out),
              border-color var(--duration-normal) var(--ease-out);
}

.transition-transform {
  transition: transform var(--duration-normal) var(--ease-out);
}

.transition-opacity {
  transition: opacity var(--duration-normal) var(--ease-out);
}
</style>
