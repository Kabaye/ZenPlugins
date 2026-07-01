import { AccountType } from '../../../../types/zenmoney'

const mockFetchDepositAccountStatement = jest.fn()
const mockFetchMiniCardStatement = jest.fn()
const DAY_MS = 24 * 60 * 60 * 1000

const getRecentNoonTimestamp = (daysAgo: number): number => {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() - daysAgo)
  date.setUTCHours(12, 0, 0, 0)
  return date.getTime()
}

jest.mock('../../fetchApi', () => ({
  ...jest.requireActual('../../fetchApi'),
  fetchDepositAccountStatement: mockFetchDepositAccountStatement,
  fetchMiniCardStatement: mockFetchMiniCardStatement
}))

describe('getTransactions', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { getTransactions } = require('../../api') as typeof import('../../api')

  afterEach(() => {
    mockFetchDepositAccountStatement.mockReset()
    mockFetchMiniCardStatement.mockReset()
  })

  it('treats missing deposit operations as an empty statement', async () => {
    mockFetchDepositAccountStatement.mockResolvedValue({
      errorInfo: {
        error: '0',
        errorText: null,
        errorDescription: null
      }
    })

    await expect(getTransactions({
      sessionToken: 'session-token',
      fromDate: new Date('2026-05-01T00:00:00.000Z'),
      toDate: new Date('2026-05-31T23:59:59.000Z')
    }, {
      id: 'deposit-account',
      type: AccountType.deposit,
      title: 'Тестовый вклад',
      balance: 1000,
      instrument: 'RUB',
      syncIds: ['TEST-DEPOSIT-IBAN'],
      startDate: new Date('2026-01-01T00:00:00.000Z'),
      startBalance: 1000,
      capitalization: true,
      percent: 12,
      endDateOffsetInterval: 'month',
      endDateOffset: 12,
      payoffInterval: 'month',
      payoffStep: 1,
      _meta: {
        productKind: 'deposit',
        statementInternalAccountId: '6431251001260',
        statementCardHash: null
      }
    })).resolves.toEqual([])
  })

  it('prefers posted mini card operation over matching hold duplicate', async () => {
    const operationDate = getRecentNoonTimestamp(1)

    mockFetchMiniCardStatement.mockResolvedValue({
      errorInfo: {
        error: '0',
        errorText: null,
        errorDescription: null
      },
      statement: [
        {
          operationDate,
          operationDescription: 'Авторизация',
          operationAmount: 10,
          operationCurrency: '933',
          operationPlace: 'STORE',
          operationState: 0,
          transactionAmount: 10,
          transactionCurrency: '933',
          transactionAuthCode: '999'
        },
        {
          operationDate,
          operationDescription: 'Покупка',
          operationAmount: 10,
          operationCurrency: '933',
          operationPlace: 'STORE',
          operationState: 1,
          transactionAmount: 10,
          transactionCurrency: '933',
          transactionAuthCode: '999'
        }
      ]
    })

    await expect(getTransactions({
      sessionToken: 'session-token',
      fromDate: new Date(operationDate - DAY_MS),
      toDate: new Date(operationDate + DAY_MS)
    }, {
      id: 'card-account',
      type: AccountType.ccard,
      title: 'Тестовая карта',
      balance: 1000,
      instrument: 'BYN',
      syncIds: ['TEST-CARD-IBAN'],
      _meta: {
        productKind: 'card',
        statementInternalAccountId: 'account-id',
        statementCardHash: 'card-hash'
      }
    })).resolves.toMatchObject([
      {
        hold: false,
        comment: 'Покупка\nSTORE',
        movements: [
          {
            id: `card-account:auth:${operationDate}:999`,
            sum: 10
          }
        ]
      }
    ])
  })

  it('keeps repeated mini card auth codes distinct across operation dates', async () => {
    const firstOperationDate = getRecentNoonTimestamp(2)
    const secondOperationDate = firstOperationDate + DAY_MS

    mockFetchMiniCardStatement.mockResolvedValue({
      errorInfo: {
        error: '0',
        errorText: null,
        errorDescription: null
      },
      statement: [
        {
          operationDate: firstOperationDate,
          operationDescription: 'Покупка',
          operationAmount: 10,
          operationCurrency: '933',
          operationPlace: 'STORE',
          operationState: 1,
          transactionAmount: 10,
          transactionCurrency: '933',
          transactionAuthCode: '999'
        },
        {
          operationDate: secondOperationDate,
          operationDescription: 'Покупка',
          operationAmount: 10,
          operationCurrency: '933',
          operationPlace: 'STORE',
          operationState: 1,
          transactionAmount: 10,
          transactionCurrency: '933',
          transactionAuthCode: '999'
        }
      ]
    })

    await expect(getTransactions({
      sessionToken: 'session-token',
      fromDate: new Date(firstOperationDate - DAY_MS),
      toDate: new Date(secondOperationDate + DAY_MS)
    }, {
      id: 'card-account',
      type: AccountType.ccard,
      title: 'Тестовая карта',
      balance: 1000,
      instrument: 'BYN',
      syncIds: ['TEST-CARD-IBAN'],
      _meta: {
        productKind: 'card',
        statementInternalAccountId: 'account-id',
        statementCardHash: 'card-hash'
      }
    })).resolves.toHaveLength(2)
  })
})
