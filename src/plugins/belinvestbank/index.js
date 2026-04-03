import { fetchAccounts, fetchCardBalance, fetchTransactions, login } from './api'
import { convertAccount, convertTransaction, patchAccountFromSummary } from './converters'

export async function scrape ({ preferences, fromDate, toDate }) {
  const token = await login(preferences.login, preferences.password)
  const accounts = (await fetchAccounts(token))
    .map(convertAccount)

  const transactions = []
  for (const account of accounts) {
    const { history: apiTransactions, summaryData, msCardId } = await fetchTransactions(token, account, fromDate, toDate)
    let realTimeBalance = null
    if (msCardId && summaryData && (parseFloat(summaryData.overdraftSum) || 0) > 0) {
      realTimeBalance = await fetchCardBalance(token, msCardId)
    }
    const patchedAccount = patchAccountFromSummary(account, summaryData, realTimeBalance)
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
