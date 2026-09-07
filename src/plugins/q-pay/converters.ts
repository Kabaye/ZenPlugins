import { Account, AccountOrCard, AccountType } from '../../types/zenmoney'
import { QPayCard, QPayCardWithBalance, QPayWallet } from './models'

const USD_STABLECOINS = new Set(['USDT', 'USDC'])

const NETWORK_TITLES: Record<string, string> = {
  'evm:1': 'Ethereum',
  'evm:56': 'BNB Smart Chain',
  'tron:mainnet': 'TRON'
}

function finiteNumberOrNull (value: string | number | null | undefined): number | null {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeInstrument (asset: string): string {
  const normalized = asset.trim().toUpperCase()
  return USD_STABLECOINS.has(normalized) ? 'USD' : normalized
}

function walletAccountId (network: string, address: string, asset: string): string {
  return `q-pay:wallet:${network}:${address}:${asset}`
}

/** Convert every opened Q-Pay network/asset balance into a distinct ZenMoney account. */
export function convertWallets (wallets: QPayWallet[]): Account[] {
  const accounts = new Map<string, AccountOrCard>()

  for (const wallet of wallets) {
    const network = wallet.network?.trim().toLowerCase()
    const address = wallet.address?.trim()
    // A network can gain more than one wallet. Its address is therefore part of the
    // persistent identity; without it two genuine open wallets would overwrite each other.
    if (network == null || network === '' || address == null || address === '' || !Array.isArray(wallet.balances)) {
      continue
    }

    for (const walletBalance of wallet.balances) {
      const asset = walletBalance.asset?.trim().toUpperCase()
      if (asset == null || asset === '') {
        continue
      }
      const id = walletAccountId(network, address, asset)
      const networkTitle = NETWORK_TITLES[network] ?? network
      accounts.set(id, {
        id,
        type: AccountType.checking,
        title: `Q-Pay ${asset} · ${networkTitle}`,
        instrument: normalizeInstrument(asset),
        balance: finiteNumberOrNull(walletBalance.value),
        syncIds: [id],
        savings: false
      })
    }
  }

  return [...accounts.values()]
}

/** True only for cards that Q-Pay explicitly reports as currently active and not revoked. */
export function isOpenCard (card: QPayCard): card is QPayCard & { id: string } {
  return typeof card.id === 'string' && card.id.trim() !== '' &&
    card.status?.trim().toUpperCase() === 'ACTIVE' &&
    card.is_revoked === false
}

/** Convert an active Q-Pay card and its available balance into a ZenMoney card account. */
export function convertCard ({ card, balance }: QPayCardWithBalance): AccountOrCard | null {
  const cardId = card.id?.trim()
  if (cardId == null || cardId === '') {
    return null
  }
  const instrument = normalizeInstrument(balance.card_currency ?? 'USD')
  const available = finiteNumberOrNull(balance.available_balance)
  const id = `q-pay:card:${cardId}`

  return {
    id,
    type: AccountType.ccard,
    title: 'Q-Pay Card',
    instrument,
    balance: available,
    available,
    creditLimit: 0,
    syncIds: [id, cardId],
    savings: false
  }
}

/** Convert active Q-Pay cards, dropping malformed entries without a stable card id. */
export function convertCards (cards: QPayCardWithBalance[]): Account[] {
  return cards.map(convertCard).filter((account): account is AccountOrCard => account != null)
}
