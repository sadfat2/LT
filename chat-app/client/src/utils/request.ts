import type { ApiResponse } from '../types'

const BASE_URL = import.meta.env.DEV ? '' : 'http://localhost:3000'

interface RequestOptions extends UniApp.RequestOptions {
  showLoading?: boolean
  showError?: boolean
}

// 获取 token
const getToken = (): string => {
  return uni.getStorageSync('token') || ''
}

// 请求封装
export const request = <T = any>(options: RequestOptions): Promise<ApiResponse<T>> => {
  return new Promise((resolve, reject) => {
    const token = getToken()

    if (options.showLoading !== false) {
      uni.showLoading({ title: '加载中...' })
    }

    uni.request({
      url: BASE_URL + options.url,
      method: options.method || 'GET',
      data: options.data,
      header: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : '',
        ...options.header
      },
      success: (res) => {
        const data = res.data as ApiResponse<T>

        if (res.statusCode === 200 || res.statusCode === 201) {
          resolve(data)
        } else if (res.statusCode === 401) {
          // 未授权，跳转登录
          uni.removeStorageSync('token')
          uni.removeStorageSync('user')
          uni.reLaunch({ url: '/pages/login/index' })
          reject(new Error('请重新登录'))
        } else {
          if (options.showError !== false) {
            uni.showToast({
              title: data.message || '请求失败',
              icon: 'none'
            })
          }
          reject(new Error(data.message || '请求失败'))
        }
      },
      fail: (err) => {
        if (options.showError !== false) {
          uni.showToast({
            title: '网络错误',
            icon: 'none'
          })
        }
        reject(err)
      },
      complete: () => {
        if (options.showLoading !== false) {
          uni.hideLoading()
        }
      }
    })
  })
}

// GET 请求
export const get = <T = any>(url: string, data?: any, options?: Partial<RequestOptions>) => {
  return request<T>({ url, method: 'GET', data, ...options })
}

// POST 请求
export const post = <T = any>(url: string, data?: any, options?: Partial<RequestOptions>) => {
  return request<T>({ url, method: 'POST', data, ...options })
}

// PUT 请求
export const put = <T = any>(url: string, data?: any, options?: Partial<RequestOptions>) => {
  return request<T>({ url, method: 'PUT', data, ...options })
}

// DELETE 请求
export const del = <T = any>(url: string, data?: any, options?: Partial<RequestOptions>) => {
  return request<T>({ url, method: 'DELETE', data, ...options })
}

// 上传文件
export const uploadFile = (url: string, filePath: string, name = 'file', formData?: any): Promise<ApiResponse> => {
  return new Promise((resolve, reject) => {
    const token = getToken()

    uni.showLoading({ title: '上传中...' })

    uni.uploadFile({
      url: BASE_URL + url,
      filePath,
      name,
      formData,
      header: {
        'Authorization': token ? `Bearer ${token}` : ''
      },
      success: (res) => {
        const data = JSON.parse(res.data) as ApiResponse
        if (res.statusCode === 200) {
          resolve(data)
        } else {
          uni.showToast({ title: data.message || '上传失败', icon: 'none' })
          reject(new Error(data.message || '上传失败'))
        }
      },
      fail: (err) => {
        uni.showToast({ title: '上传失败', icon: 'none' })
        reject(err)
      },
      complete: () => {
        uni.hideLoading()
      }
    })
  })
}
