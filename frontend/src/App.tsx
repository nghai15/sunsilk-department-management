import { Route, Routes } from 'react-router-dom'
import { InstallPrompt } from './components/InstallPrompt'
import LoginPage from './features/auth/LoginPage'
import { RequireAuth } from './features/auth/RequireAuth'
import { useAuth } from './features/auth/useAuth'

function TrangChu() {
  const { user, signOut } = useAuth()
  return (
    <div className="p-6 space-y-2">
    <InstallPrompt />
      <p>Xin chào {user?.hoTen} ({user?.vaiTro})</p>
      <button onClick={signOut} className="border rounded px-3 py-1">Đăng xuất</button>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/dang-nhap" element={<LoginPage />} />
      <Route path="/khong-co-quyen" element={<p className="p-6">Bạn không có quyền truy cập trang này.</p>} />
      <Route element={<RequireAuth />}>
        <Route path="/" element={<TrangChu />} />
      </Route>
      <Route element={<RequireAuth roles={['chu_tro', 'quan_ly', 'quan_tri']} />}>
        <Route path="/quan-ly" element={<p className="p-6">Khu vực quản lý</p>} />
      </Route>
    </Routes>
  )
}