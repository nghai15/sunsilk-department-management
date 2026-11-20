import { Link, Route, Routes } from 'react-router-dom'
import IssueManagementPage from './features/issues/IssueManagementPage'
import IssueReportPage from './features/issues/IssueReportPage'
import LoginPage from './features/auth/LoginPage'
import { RequireAuth } from './features/auth/RequireAuth'
import { AppLayout } from './components/AppLayout'
import DashboardPage from './features/dashboard/DashboardPage'
import TenantBillingPage from './features/billing/TenantBillingPage'
import BillingPage from './features/billing/BillingPage'
import TenantsPage from './features/tenants/TenantsPage'
import ForgotPasswordPage from './features/auth/ForgotPasswordPage'
import PropertiesPage from './features/properties/PropertiesPage'
import ContractsPage from './features/contracts/ContractsPage'
import NotificationsPage from './features/notifications/NotificationsPage'
import StaffAccountsPage from './features/staff/StaffAccountsPage'
import AssignmentsPage from './features/staff/AssignmentsPage'
import AccountPage from './features/auth/AccountPage'
import TenantIssuesPage from './features/issues/TenantIssuesPage'

export default function App() {
  return (
    <Routes>
      <Route path="/dang-nhap" element={<LoginPage />} />
      <Route path="/quen-mat-khau" element={<ForgotPasswordPage />} />
      <Route path="/khong-co-quyen" element={<p className="p-6">Bạn không có quyền truy cập trang này.</p>} />
      <Route element={<RequireAuth />}>
        <Route element={<AppLayout wide />}>
          <Route element={<RequireAuth roles={['chu_tro', 'quan_tri']} />}>
            <Route path="/nguoi-thue" element={<TenantsPage />} />
            <Route path="/nhan-su" element={<StaffAccountsPage />} />
            <Route path="/phan-cong" element={<AssignmentsPage />} />
          </Route>
          <Route element={<RequireAuth roles={['chu_tro', 'quan_tri', 'quan_ly']} />}>
            <Route path="/khu-phong" element={<PropertiesPage />} />
            <Route path="/issue-management" element={<IssueManagementPage />} />
          </Route>
          <Route path="/hop-dong" element={<ContractsPage />} />
          <Route path="/thong_bao" element={<NotificationsPage />} />
          <Route path="/tai-khoan" element={<AccountPage />} />
          <Route path="/issues" element={<TenantIssuesPage />} />
          <Route path="/issues/:issueId" element={<TenantIssuesPage />} />
          <Route path="/billing" element={<BillingPage />} />
          <Route element={<RequireAuth roles={['nguoi_thue']} />}>
            <Route path="/billing/chi-so" element={<TenantBillingPage />} />
            <Route path="/issues/new" element={<IssueReportPage />} />
          </Route>
          <Route path="/billing/:billId" element={<BillingPage />} />
        </Route>
      </Route>
      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<DashboardPage />} />
        </Route>
      </Route>
      <Route path="*" element={<main className="p-10 text-center"><h1 className="text-2xl font-semibold">Không tìm thấy trang</h1><Link className="mt-4 inline-block underline" to="/">Về tổng quan</Link></main>} />
    </Routes>
  )
}
