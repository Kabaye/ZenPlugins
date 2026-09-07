import { ScrapeFunc } from '../../types/zenmoney'
import { scrapeQPay } from './api'
import { Preferences } from './models'

/** Q-Pay plugin entrypoint: balances only, intentionally no transaction history. */
export const scrape: ScrapeFunc<Preferences> = async ({ preferences }) => {
  const { accounts, transactions, session } = await scrapeQPay(
    preferences,
    ZenMoney.getData('session')
  )
  ZenMoney.setData('session', session)
  ZenMoney.saveData()
  return { accounts, transactions }
}
