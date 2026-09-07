/** User-configured Q-Pay credentials. */
export interface Preferences {
  email: string
  password: string
}

/** Bearer session persisted between synchronizations. */
export interface Session {
  email: string
  accessToken: string
}

/** Return a normalized email for authentication and persisted-session matching. */
export function normalizeEmail (email: string): string {
  return email.trim()
}

/** Validate untrusted session data loaded from ZenMoney storage. */
export function isSessionFor (value: unknown, email: string): value is Session {
  if (value == null || typeof value !== 'object') {
    return false
  }
  const session = value as Partial<Session>
  return typeof session.email === 'string' &&
    normalizeEmail(session.email).toLowerCase() === normalizeEmail(email).toLowerCase() &&
    typeof session.accessToken === 'string' &&
    session.accessToken !== ''
}

export interface QPayWalletBalance {
  asset?: string | null
  value?: string | number | null
}

export interface QPayWallet {
  address?: string | null
  network?: string | null
  balances?: QPayWalletBalance[] | null
}

export interface QPayUser {
  wallets: QPayWallet[]
}

export interface QPayCard {
  id?: string | null
  status?: string | null
  is_revoked?: boolean | null
}

export interface QPayCardBalance {
  available_balance?: string | number | null
  card_currency?: string | null
}

export interface QPayCardWithBalance {
  card: QPayCard
  balance: QPayCardBalance
}

export const QPAY_BASE_URL = 'https://pay.quantera.pro/api'

export const QPAY_ENDPOINTS = {
  login: '/v1/web/auth/login',
  currentUser: '/v1/web/users/self',
  cards: '/v1/miniapp/cards'
}
