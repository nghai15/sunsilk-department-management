export interface NavItem { key: string; label: string; icon: string }

// Các mục điều hướng chung. Khi cả nhóm thêm màn mới, chỉ cần thêm vào đây.
export const NAV_ITEMS: NavItem[] = [
  { key: 'rooms', label: 'Phòng', icon: '🏠' },
  { key: 'billing', label: 'Hóa đơn', icon: '🧾' },
  { key: 'issues', label: 'Sự cố', icon: '🔧' },
  { key: 'notifications', label: 'Thông báo', icon: '🔔' },
  { key: 'dashboard', label: 'Tổng quan', icon: '📊' },
];
