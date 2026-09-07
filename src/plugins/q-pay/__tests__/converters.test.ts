import { convertCard, convertWallets, isOpenCard } from '../converters'

describe('Q-Pay account conversion', () => {
  it('keeps each opened network and asset as a separate wallet account', () => {
    expect(convertWallets([
      {
        address: '0x-example',
        network: 'evm:1',
        balances: [
          { asset: 'USDT', value: '12.34' },
          { asset: 'USDC', value: '0' }
        ]
      },
      {
        address: 'T-example',
        network: 'tron:mainnet',
        balances: [{ asset: 'USDT', value: 5 }]
      }
    ])).toEqual([
      {
        id: 'q-pay:wallet:evm:1:0x-example:USDT',
        type: 'checking',
        title: 'Q-Pay USDT · Ethereum',
        instrument: 'USD',
        balance: 12.34,
        syncIds: ['q-pay:wallet:evm:1:0x-example:USDT'],
        savings: false
      },
      {
        id: 'q-pay:wallet:evm:1:0x-example:USDC',
        type: 'checking',
        title: 'Q-Pay USDC · Ethereum',
        instrument: 'USD',
        balance: 0,
        syncIds: ['q-pay:wallet:evm:1:0x-example:USDC'],
        savings: false
      },
      {
        id: 'q-pay:wallet:tron:mainnet:T-example:USDT',
        type: 'checking',
        title: 'Q-Pay USDT · TRON',
        instrument: 'USD',
        balance: 5,
        syncIds: ['q-pay:wallet:tron:mainnet:T-example:USDT'],
        savings: false
      }
    ])
  })

  it('does not invent a zero balance for malformed data', () => {
    expect(convertWallets([
      { address: '0x-example', network: 'evm:56', balances: [{ asset: 'USDT', value: 'not-a-number' }] },
      { network: null, balances: [{ asset: 'USDT', value: '1' }] },
      { address: '0x-other', network: 'evm:1', balances: [{ asset: null, value: '1' }] }
    ])).toEqual([{
      id: 'q-pay:wallet:evm:56:0x-example:USDT',
      type: 'checking',
      title: 'Q-Pay USDT · BNB Smart Chain',
      instrument: 'USD',
      balance: null,
      syncIds: ['q-pay:wallet:evm:56:0x-example:USDT'],
      savings: false
    }])
  })

  it('accepts only active, non-revoked cards', () => {
    expect(isOpenCard({ id: '1', status: 'ACTIVE', is_revoked: false })).toBe(true)
    expect(isOpenCard({ id: '2', status: 'active', is_revoked: false })).toBe(true)
    expect(isOpenCard({ id: '3', status: 'ACTIVE', is_revoked: true })).toBe(false)
    expect(isOpenCard({ id: '4', status: 'CLOSED', is_revoked: false })).toBe(false)
    expect(isOpenCard({ status: 'ACTIVE', is_revoked: false })).toBe(false)
  })

  it('converts an active card balance without importing card details', () => {
    expect(convertCard({
      card: { id: 'card-id', status: 'ACTIVE', is_revoked: false },
      balance: { available_balance: '159.25', card_currency: 'USD' }
    })).toEqual({
      id: 'q-pay:card:card-id',
      type: 'ccard',
      title: 'Q-Pay Card',
      instrument: 'USD',
      balance: 159.25,
      available: 159.25,
      creditLimit: 0,
      syncIds: ['q-pay:card:card-id', 'card-id'],
      savings: false
    })
  })
})
