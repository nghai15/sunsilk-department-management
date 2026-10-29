-- Migration: 001_initial_schema.sql
-- CSDL Quản lý Nhà Trọ

-- 1. Bảng Khu nhà (Properties)
CREATE TABLE IF NOT EXISTS properties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    address TEXT NOT NULL,
    total_floors INT DEFAULT 1,
    electricity_rate DECIMAL(10, 2) NOT NULL DEFAULT 3500.00,
    water_rate DECIMAL(10, 2) NOT NULL DEFAULT 20000.00,
    internet_rate DECIMAL(10, 2) DEFAULT 100000.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Bảng Phòng trọ (Rooms)
CREATE TABLE IF NOT EXISTS rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    room_number VARCHAR(50) NOT NULL,
    floor INT DEFAULT 1,
    base_price DECIMAL(12, 2) NOT NULL,
    deposit_amount DECIMAL(12, 2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'maintenance')),
    area_sqm DECIMAL(6, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Bảng Người dùng & Khách thuê (Users)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone VARCHAR(20) UNIQUE NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    identity_card VARCHAR(20),
    role VARCHAR(20) DEFAULT 'tenant' CHECK (role IN ('admin', 'landlord', 'tenant', 'manager')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Bảng Hợp đồng (Contracts)
CREATE TABLE IF NOT EXISTS contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID REFERENCES rooms(id) ON DELETE RESTRICT,
    tenant_id UUID REFERENCES users(id) ON DELETE RESTRICT,
    start_date DATE NOT NULL,
    end_date DATE,
    rental_price DECIMAL(12, 2) NOT NULL,
    deposit DECIMAL(12, 2) NOT NULL,
    billing_day INT DEFAULT 5,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'expired', 'terminated')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Bảng Hóa đơn & Tiền phòng (Bills)
CREATE TABLE IF NOT EXISTS bills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID REFERENCES rooms(id) ON DELETE RESTRICT,
    contract_id UUID REFERENCES contracts(id) ON DELETE RESTRICT,
    month_year VARCHAR(7) NOT NULL, -- MM/YYYY
    room_amount DECIMAL(12, 2) NOT NULL,
    prev_electricity_index INT NOT NULL,
    curr_electricity_index INT NOT NULL,
    electricity_cost DECIMAL(12, 2) NOT NULL,
    prev_water_index INT NOT NULL,
    curr_water_index INT NOT NULL,
    water_cost DECIMAL(12, 2) NOT NULL,
    other_fees DECIMAL(12, 2) DEFAULT 0,
    total_amount DECIMAL(12, 2) NOT NULL,
    due_date DATE NOT NULL,
    payment_status VARCHAR(20) DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid', 'partially_paid', 'overdue')),
    vietqr_url TEXT,
    paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Bảng Báo cáo Sự cố (Issues)
CREATE TABLE IF NOT EXISTS issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES users(id) ON DELETE SET NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    image_urls TEXT[],
    repair_cost DECIMAL(12, 2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'resolved', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE
);
