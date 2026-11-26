import { Component, type ReactNode } from 'react'
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    if (this.state.failed) return <main className="mx-auto max-w-md p-8"><h1 className="text-2xl font-semibold">Không thể hiển thị trang</h1><p className="my-4 text-gray-600">Vui lòng tải lại trang. Các dữ liệu đã lưu vẫn được giữ nguyên.</p><button className="rounded-lg bg-emerald-900 px-4 py-2 text-white" onClick={() => window.location.reload()}>Tải lại</button></main>
    return this.props.children
  }
}
