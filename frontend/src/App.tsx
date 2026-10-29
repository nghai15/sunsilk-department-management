import React from 'react';

export const App: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-bold text-blue-600">Quản Lý Nhà Trọ PWA</h1>
        <div className="text-sm bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full font-medium">
          Chủ trọ
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4 max-w-lg mx-auto w-full space-y-4">
        {/* Dashboard Overview Cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
            <span className="text-xs text-slate-500 font-medium">Phòng trống</span>
            <div className="text-2xl font-bold text-slate-800 mt-1">2 / 12</div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
            <span className="text-xs text-slate-500 font-medium">Chưa thu tiền</span>
            <div className="text-2xl font-bold text-amber-600 mt-1">4 phòng</div>
          </div>
        </div>

        {/* Action List */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 space-y-3">
          <h2 className="text-sm font-semibold text-slate-700">Tác vụ nhanh</h2>
          <div className="grid grid-cols-2 gap-2">
            <button className="flex items-center justify-center p-3 text-sm font-medium bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition">
              ⚡ Chốt điện nước
            </button>
            <button className="flex items-center justify-center p-3 text-sm font-medium bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition">
              💳 Tạo VietQR
            </button>
          </div>
        </div>
      </main>

      {/* Bottom Navigation */}
      <nav className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-2 flex justify-around text-xs text-slate-500">
        <button className="flex flex-col items-center text-blue-600 font-medium">
          <span>🏠</span>
          <span>Tổng quan</span>
        </button>
        <button className="flex flex-col items-center">
          <span>🚪</span>
          <span>Phòng trọ</span>
        </button>
        <button className="flex flex-col items-center">
          <span>🧾</span>
          <span>Hóa đơn</span>
        </button>
        <button className="flex flex-col items-center">
          <span>🔔</span>
          <span>Thông báo</span>
        </button>
      </nav>
    </div>
  );
};

export default App;
