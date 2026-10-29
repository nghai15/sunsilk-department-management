-- Seed data: Dữ liệu mẫu phục vụ phát triển & test

INSERT INTO properties (id, name, address, total_floors, electricity_rate, water_rate, internet_rate)
VALUES 
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Nhà trọ Bình An', '123 Đường Số 5, Phường Linh Trung, TP. Thủ Đức', 3, 3500.00, 20000.00, 100000.00);

INSERT INTO rooms (id, property_id, room_number, floor, base_price, deposit_amount, status, area_sqm)
VALUES 
('b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'P101', 1, 3200000.00, 3200000.00, 'occupied', 25.0),
('b2eebc99-9c0b-4ef8-bb6d-6bb9bd380a23', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'P102', 1, 3000000.00, 3000000.00, 'available', 22.0),
('b3eebc99-9c0b-4ef8-bb6d-6bb9bd380a24', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'P201', 2, 3500000.00, 3500000.00, 'occupied', 28.0);

INSERT INTO users (id, phone, full_name, identity_card, role)
VALUES 
('c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a31', '0901234567', 'Nguyễn Văn Chủ Nhà', '079090001122', 'landlord'),
('c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a32', '0987654321', 'Trần Thị Thuê', '079092003344', 'tenant');
