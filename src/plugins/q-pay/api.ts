import { TemporaryError } from '../../errors'
import { Account, Transaction } from '../../types/zenmoney'
import { convertCards, convertWallets, isOpenCard } from './converters'
import {
  fetchCardBalance,
  fetchCards,
  fetchCurrentUser,
  login,
  SessionExpiredError
} from './fetchApi'
import { isSessionFor, Preferences, QPayCardWithBalance, Session } from './models'

export interface ScrapeOutput {
  accounts: Account[]
  transactions: Transaction[]
  session: Session
}

async function loadAccounts (session: Session): Promise<Account[]> {
  const [user, cards] = await Promise.all([
    fetchCurrentUser(session),
    fetchCards(session)
  ])
  const openCards = cards.filter(isOpenCard)
  const cardsWithBalances: QPayCardWithBalance[] = await Promise.all(openCards.map(async card => ({
    card,
    balance: await fetchCardBalance(session, card.id)
  })))
  return [
    ...convertWallets(user.wallets),
    ...convertCards(cardsWithBalances)
  ]
}

/** Load Q-Pay accounts, re-authenticating once when a persisted session has expired. */
export async function scrapeQPay (
  preferences: Preferences,
  storedSession: unknown
): Promise<ScrapeOutput> {
  let session = isSessionFor(storedSession, preferences.email)
    ? storedSession
    : await login(preferences)

  let accounts: Account[]
  try {
    accounts = await loadAccounts(session)
  } catch (error) {
    if (!(error instanceof SessionExpiredError)) {
      throw error
    }
    session = await login(preferences)
    try {
      accounts = await loadAccounts(session)
    } catch (retryError) {
      if (retryError instanceof SessionExpiredError) {
        throw new TemporaryError('Q-Pay отклонил новую сессию; повторите синхронизацию позже')
      }
      throw retryError
    }
  }

  return { accounts, transactions: [], session }
}
