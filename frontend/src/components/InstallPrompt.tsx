import { useState } from 'react'
import { usePWAInstall } from '../hooks/usePWAInstall'

export function InstallPrompt() {
  const { canInstall, showIOSGuide, install } = usePWAInstall()
  const [showGuide, setShowGuide] = useState(false)

  if (canInstall) {
    return (
      <button onClick={install} className="bg-blue-600 text-white rounded-lg px-4 py-2">
        Cài đặt ứng dụng
      </button>
    )
  }

  if (showIOSGuide) {
    return (
      <>
        <button
          onClick={() => setShowGuide(true)}
          className="bg-blue-600 text-white rounded-lg px-4 py-2"
        >
          Cài đặt ứng dụng
        </button>
        {showGuide && (
          <div className="fixed inset-0 bg-black/50 flex items-end justify-center p-4 z-50">
            <div className="bg-white rounded-xl p-5 w-full max-w-sm space-y-3">
              <h2 className="font-semibold">Cài đặt trên iPhone / iPad</h2>
              <ol className="list-decimal pl-5 text-sm space-y-1">
                <li>Mở trang này bằng <b>Safari</b>.</li>
                <li>Bấm nút <b>Chia sẻ</b> (biểu tượng hình vuông có mũi tên lên).</li>
                <li>Chọn <b>Thêm vào Màn hình chính</b>, rồi bấm <b>Thêm</b>.</li>
              </ol>
              <p className="text-xs text-gray-500">
                Cần cài đặt trước để nhận được thông báo đẩy trên iPhone.
              </p>
              <button onClick={() => setShowGuide(false)} className="w-full border rounded-lg py-2">
                Đã hiểu
              </button>
            </div>
          </div>
        )}
      </>
    )
  }

  return null
}