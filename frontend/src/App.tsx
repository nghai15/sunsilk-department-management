import { Route, Routes } from 'react-router-dom'
import LoginPage from './features/auth/LoginPage'
import { RequireAuth } from './features/auth/RequireAuth'
import { AppLayout } from './components/AppLayout'
import DashboardPage from './features/dashboard/DashboardPage'

export default function App() {
  return (
    <Routes>
      <Route path="/dang-nhap" element={<LoginPage />} />
      <Route path="/khong-co-quyen" element={<p className="p-6">Bạn không có quyền truy cập trang này.</p>} />
      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<DashboardPage />} />
          {/* Các trang của TV3-TV5 thêm vào đây */}
        </Route>
      </Route>
    </Routes>
  )
}