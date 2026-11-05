import { useEffect, useState, useSyncExternalStore } from 'react'

// Sự kiện này chưa có trong kiểu TypeScript chuẩn
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

// Trình duyệt có thể bắn sự kiện trước khi React render xong,
// nên bắt ở cấp module rồi cho component đăng ký theo dõi.
let deferredPrompt: BeforeInstallPromptEvent | null = null
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((l) => l())

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault() // chặn thanh gợi ý mặc định, tự hiển thị nút của mình
    deferredPrompt = e as BeforeInstallPromptEvent
    notify()
  })
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    notify()
  })
}

const subscribe = (cb: () => void) => {
  listeners.add(cb)
  return () => listeners.delete(cb)
}
const getSnapshot = () => deferredPrompt

function detectStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

function detectIOS() {
  const ua = navigator.userAgent
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    // iPadOS mới tự nhận là Mac
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

export function usePWAInstall() {
  const prompt = useSyncExternalStore(subscribe, getSnapshot, () => null)
  const [isInstalled, setIsInstalled] = useState(detectStandalone)

  useEffect(() => {
    const onInstalled = () => setIsInstalled(true)
    window.addEventListener('appinstalled', onInstalled)
    return () => window.removeEventListener('appinstalled', onInstalled)
  }, [])

  const isIOS = detectIOS()

  const install = async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
    if (!deferredPrompt) return 'unavailable'
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    deferredPrompt = null // mỗi sự kiện chỉ dùng được một lần
    notify()
    return outcome
  }

  return {
    /** Android/Chrome/Edge: có thể hiện hộp thoại cài đặt */
    canInstall: prompt !== null && !isInstalled,
    isInstalled,
    isIOS,
    /** iPhone/iPad chưa cài: cần hướng dẫn thêm vào Màn hình chính */
    showIOSGuide: isIOS && !isInstalled,
    install,
  }
}