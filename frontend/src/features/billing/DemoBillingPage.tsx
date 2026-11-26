import { TenantBillingFlow, type BillingConfig } from './TenantBillingFlow'

const config: BillingConfig = {
  room: 'P101', property: 'Nhà trọ Hướng Dương', period: '11/2026', rent: 3500000,
  electricityRate: 3500, waterRate: 20000, previousElectricity: 1250, previousWater: 45,
  bank: 'MB', account: '132465798', accountName: 'LE TRUNG TIN',
}

export function DemoBillingPage() {
  return <TenantBillingFlow config={config} demo onSubmit={async (values) => {
    const electricityUsage = values.electricity - config.previousElectricity
    const waterUsage = values.water - config.previousWater
    const electricity = electricityUsage * config.electricityRate
    const water = waterUsage * config.waterRate
    const total = config.rent + electricity + water
    return { id: 'demo-112026', rent: config.rent, electricity, water, services: 0, total,
      electricityUsage, waterUsage, memo: 'PHONGP101 T11', due: '2026-12-05', remaining: total }
  }} />
}
