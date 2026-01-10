import type { ApiResponse } from '../types'

// API 地址配置
// 开发环境：使用 Vite 代理
// 生产环境：使用香港节点（低延迟接入）
const BASE_URL = import.meta.env.DEV ? '' : 'https://chat.yourdomain.com'

// CDN 地址配置（静态资源：图片、语音、头像）
// 生产环境：使用 Cloudflare CDN（日本节点）
const CDN_BASE_URL = import.meta.env.DEV ? '' : 'https://cdn.yourdomain.com'

/**
 * 获取静态资源完整 URL（通过 CDN 加速）
 * @param path 资源路径，如 /uploads/images/xxx.jpg
 * @returns 完整 URL
 */
export function getAssetUrl(path: string): string {
  if (!path) return ''
  // 已经是完整 URL 则直接返回
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  // 开发环境使用本地，生产环境使用 CDN
  return `${CDN_BASE_URL}${path}`
}

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

// H5 平台上传 Blob（用于录音等）
export const uploadBlob = async (
  url: string,
  blob: Blob,
  filename: string,
  formData?: Record<string, any>
): Promise<ApiResponse> => {
  const token = getToken()

  uni.showLoading({ title: '上传中...' })

  try {
    const form = new FormData()
    form.append('file', blob, filename)

    if (formData) {
      Object.entries(formData).forEach(([key, value]) => {
        form.append(key, String(value))
      })
    }

    const response = await fetch(BASE_URL + url, {
      method: 'POST',
      headers: {
        'Authorization': token ? `Bearer ${token}` : ''
      },
      body: form
    })

    const data = await response.json() as ApiResponse

    if (response.ok) {
      return data
    } else {
      uni.showToast({ title: data.message || '上传失败', icon: 'none' })
      throw new Error(data.message || '上传失败')
    }
  } finally {
    uni.hideLoading()
  }
}
