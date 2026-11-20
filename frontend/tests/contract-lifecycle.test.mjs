import assert from 'node:assert/strict';
import { expiryDays,sixMonthsAfter } from '../src/features/contracts/contractDates.ts';
assert.equal(sixMonthsAfter('2026-11-19'),'2027-05-19');
assert.equal(sixMonthsAfter('2026-08-31'),'2027-02-28');
for(const [day,expected] of [['2026-11-19',11],['2026-11-20',10],['2026-11-30',0],['2026-12-01',-1]]) assert.equal(expiryDays('2026-11-30',day),expected);
console.log('PASS: mốc 10 ngày, ngày hết hạn, qua hạn và cộng 6 tháng cuối tháng.');
