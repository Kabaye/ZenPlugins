import { fetchAccounts, fetchTransactions, login } from './api'
import { convertAccount, convertTransaction, patchAccountFromSummary } from './converters'

export async function scrape ({ preferences, fromDate, toDate }) {
  const token = await login(preferences.login, preferences.password)
  const accounts = (await fetchAccounts(token))
    .map(convertAccount)

  const transactions = []
  for (const account of accounts) {
    const { history: apiTransactions, summaryData } = await fetchTransactions(token, account, fromDate, toDate)
    const patchedAccount = patchAccountFromSummary(account, summaryData)
    // Reflect patched balance back so transactions reference correct account
    Object.assign(account, patchedAccount)
    for (const apiTransaction of apiTransactions) {
      const transaction = convertTransaction(apiTransaction, account)
      if (transaction) {
        transactions.push(transaction)
      }
    }
  }
  return {
    accounts,
    transactions
  }
}
