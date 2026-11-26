import assert from 'node:assert/strict'
import { contractTerm } from '../src/features/contracts/contractTerm.ts'
assert.equal(contractTerm('hieu_luc','2026-12-18','2026-11-18').label,'Còn 30 ngày đến hạn')
assert.equal(contractTerm('hieu_luc','2026-11-18','2026-11-18').label,'Hết hạn hôm nay')
assert.equal(contractTerm('hieu_luc','2026-11-17','2026-11-18').label,'Đã hết hạn 1 ngày')
assert.equal(contractTerm('hieu_luc',null,'2026-11-18').label,'Không xác định thời hạn')
assert.equal(contractTerm('cham_dut','2026-12-18','2026-11-18').label,'Hợp đồng đã kết thúc')
assert.equal(contractTerm('hieu_luc','2028-03-01','2028-02-28').label,'Còn 2 ngày đến hạn')
console.log('PASS: thời hạn, hết hạn hôm nay, quá hạn, không thời hạn, kết thúc và năm nhuận.')


