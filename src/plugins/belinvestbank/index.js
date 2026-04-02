import { fetchAccounts, fetchTransactions, login } from './api'
import { convertAccount, convertTransaction } from './converters'

export async function scrape ({ preferences, fromDate, toDate }) {
  // Cap lookback to 120 days to avoid hammering the API with years of history
  const maxLookback = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000)
  if (fromDate < maxLookback) fromDate = maxLookback

  const token = await login(preferences.login, preferences.password)
  const accounts = (await fetchAccounts(token))
    .map(convertAccount)

  const transactions = []
  for (const account of accounts) {
    const apiTransactions = await fetchTransactions(token, account, fromDate, toDate)
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
