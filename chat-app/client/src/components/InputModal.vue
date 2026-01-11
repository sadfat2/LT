<template>
  <view v-if="visible" class="modal-overlay" @click="handleOverlayClick">
    <view class="modal-container" @click.stop>
      <!-- 背景光效 -->
      <view class="modal-glow"></view>

      <!-- 弹窗内容 -->
      <view class="modal-content">
        <!-- 标题 -->
        <view class="modal-header">
          <text class="modal-title">{{ title }}</text>
        </view>

        <!-- 输入区域 -->
        <view class="input-section">
          <view class="input-wrapper" :class="{ focus: isFocus }">
            <input
              ref="inputRef"
              v-model="inputValue"
              class="modal-input"
              :type="inputType"
              :placeholder="placeholder"
              :maxlength="maxlength"
              :focus="visible"
              @focus="isFocus = true"
              @blur="isFocus = false"
              @confirm="handleConfirm"
            />
            <view v-if="inputValue && showClear" class="input-clear" @click="inputValue = ''">
              <text>×</text>
            </view>
          </view>
          <view v-if="maxlength" class="char-count">
            <text :class="{ warning: inputValue.length >= maxlength }">
              {{ inputValue.length }}/{{ maxlength }}
            </text>
          </view>
        </view>

        <!-- 按钮区域 -->
        <view class="modal-actions">
          <view class="action-btn cancel" @click="handleCancel">
            <text>取消</text>
          </view>
          <view class="action-btn confirm" :class="{ disabled: !canConfirm }" @click="handleConfirm">
            <text>确定</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'

const props = withDefaults(defineProps<{
  visible: boolean
  title: string
  value?: string
  placeholder?: string
  maxlength?: number
  inputType?: 'text' | 'number'
  required?: boolean
  showClear?: boolean
}>(), {
  value: '',
  placeholder: '请输入',
  maxlength: 50,
  inputType: 'text',
  required: false,
  showClear: true
})

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'confirm', value: string): void
  (e: 'cancel'): void
}>()

const inputValue = ref(props.value)
const isFocus = ref(false)

const canConfirm = computed(() => {
  if (props.required) {
    return inputValue.value.trim().length > 0
  }
  return true
})

// 监听 visible 变化，重置输入值
watch(() => props.visible, (val) => {
  if (val) {
    inputValue.value = props.value
  }
})

// 监听外部 value 变化
watch(() => props.value, (val) => {
  inputValue.value = val
})

const handleOverlayClick = () => {
  handleCancel()
}

const handleCancel = () => {
  emit('update:visible', false)
  emit('cancel')
}

const handleConfirm = () => {
  if (!canConfirm.value) return
  emit('confirm', inputValue.value.trim())
  emit('update:visible', false)
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.modal-container {
  position: relative;
  width: 600rpx;
  animation: slideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(40rpx) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.modal-glow {
  position: absolute;
  inset: -40rpx;
  background: radial-gradient(
    ellipse at center,
    rgba(168, 85, 247, 0.15) 0%,
    transparent 70%
  );
  filter: blur(40rpx);
  pointer-events: none;
}

.modal-content {
  position: relative;
  background: linear-gradient(
    180deg,
    rgba(30, 30, 40, 0.95) 0%,
    rgba(20, 20, 28, 0.98) 100%
  );
  border: 1rpx solid rgba(255, 255, 255, 0.1);
  border-radius: 32rpx;
  padding: 48rpx 40rpx;
  box-shadow:
    0 20rpx 60rpx rgba(0, 0, 0, 0.4),
    0 0 0 1rpx rgba(255, 255, 255, 0.05) inset;
}

.modal-header {
  text-align: center;
  margin-bottom: 40rpx;
}

.modal-title {
  font-size: 36rpx;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.95);
  letter-spacing: 2rpx;
}

.input-section {
  margin-bottom: 40rpx;
}

.input-wrapper {
  display: flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.05);
  border: 1rpx solid rgba(255, 255, 255, 0.1);
  border-radius: 20rpx;
  padding: 0 24rpx;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.input-wrapper.focus {
  border-color: rgba(168, 85, 247, 0.6);
  background: rgba(168, 85, 247, 0.08);
  box-shadow: 0 0 0 4rpx rgba(168, 85, 247, 0.15);
}

.modal-input {
  flex: 1;
  height: 96rpx;
  font-size: 32rpx;
  color: rgba(255, 255, 255, 0.95);
  background: transparent;
}

.modal-input::placeholder {
  color: rgba(255, 255, 255, 0.3);
}

.input-clear {
  width: 48rpx;
  height: 48rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 36rpx;
  color: rgba(255, 255, 255, 0.3);
  transition: color 0.2s;
}

.input-clear:active {
  color: rgba(255, 255, 255, 0.6);
}

.char-count {
  text-align: right;
  margin-top: 12rpx;
  padding-right: 8rpx;
}

.char-count text {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.3);
}

.char-count text.warning {
  color: rgba(236, 72, 153, 0.8);
}

.modal-actions {
  display: flex;
  gap: 24rpx;
}

.action-btn {
  flex: 1;
  height: 88rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 20rpx;
  font-size: 30rpx;
  font-weight: 500;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.action-btn:active {
  transform: scale(0.97);
}

.action-btn.cancel {
  background: rgba(255, 255, 255, 0.08);
  border: 1rpx solid rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.6);
}

.action-btn.cancel:active {
  background: rgba(255, 255, 255, 0.12);
}

.action-btn.confirm {
  background: linear-gradient(135deg, #a855f7 0%, #ec4899 100%);
  color: #fff;
  box-shadow: 0 8rpx 24rpx rgba(168, 85, 247, 0.3);
}

.action-btn.confirm:active {
  box-shadow: 0 4rpx 16rpx rgba(168, 85, 247, 0.4);
}

.action-btn.confirm.disabled {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.3);
  box-shadow: none;
}
</style>
