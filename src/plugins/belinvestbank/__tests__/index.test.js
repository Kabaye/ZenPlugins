import fetchMock from 'fetch-mock'
import _ from 'lodash'
import { stringify } from 'querystring'
import { scrape } from '..'
import { makePluginDataApi } from '../../../ZPAPI.pluginData'

describe('scrape', () => {
  it('should hit the mocks and return results', async () => {
    mockZenMoney()
    mockApiLoginAndPass()
    mockApiCloseLastSession()
    mockApiSmsCode()
    mockApiAuthCallback()
    mockApiSaveDevice()
    mockApiFetchAccounts()
    mockApiFetchTransactions()

    const result = await scrape(
      {
        preferences: { login: '123456789', password: 'pass' },
        fromDate: new Date(2025, 11, 27),
        toDate: new Date(2026, 0, 2)
      }
    )

    expect(result.accounts).toEqual([
      {
        id: '30848200',
        type: 'card',
        title: 'Безымянная*1111',
        instrument: 'BYN',
        balance: 1213.84,
        creditLimit: 0,
        syncID: ['1111']
      }
    ])

    expect(result.transactions).toEqual([
      {
        hold: false,
        date: new Date('2026-01-01T10:12:13+03:00'),
        movements: [
          {
            id: null,
            invoice: null,
            account: { id: '30848200' },
            sum: 10.13,
            fee: 0
          }
        ],
        merchant: null,
        comment: null
      }
    ])
  })
})

function mockApiLoginAndPass () {
  let signinCallCount = 0
  const signinMatcher = (url, { body }) => url === 'https://login.belinvestbank.by/app_api' && _.isEqual(body, stringify({
    section: 'account',
    method: 'signin',
    login: '123456789',
    password: 'pass',
    deviceId: 'device id',
    versionApp: '2.25.0',
    deviceName: 'Samsung SM-S926B',
    os: 'Android',
    AndroidVersion: '34',
    device_token: 'device token',
    device_token_type: 'ANDROID',
    typeSessionKey: '0'
  }))

  // First signin: session conflict
  fetchMock.once({
    method: 'POST',
    matcher: (url, opts) => signinCallCount === 0 && signinMatcher(url, opts),
    response: () => {
      signinCallCount++
      return {
        status: 200,
        body: {
          isNeedConfirmSessionKey: '1',
          message: 'System already running',
          status: 'ER',
          textMessage: 'Session conflict'
        }
      }
    }
  })

  // Second signin after closing old session: success, SMS needed
  fetchMock.once({
    method: 'POST',
    matcher: (url, opts) => signinCallCount === 1 && signinMatcher(url, opts),
    response: () => {
      signinCallCount++
      return {
        status: 200,
        body: {
          status: 'OK',
          values: {
            clientName: 'Vasiliy',
            greetingPartDay: 'Good day',
            _appName: 'simple'
          }
        }
      }
    }
  })
}

function mockApiCloseLastSession () {
  fetchMock.once({
    method: 'POST',
    matcher: (url, { body }) => url === 'https://login.belinvestbank.by/app_api' && _.isEqual(body, stringify({
      section: 'account',
      method: 'confirmationCloseSession'
    })),
    response: {
      status: 200,
      body: {
        status: 'OK',
        values: { _appName: 'simple' }
      }
    }
  })
}

function mockApiSmsCode () {
  fetchMock.once({
    method: 'POST',
    matcher: (url, { body }) => url === 'https://login.belinvestbank.by/app_api' && _.isEqual(body, stringify({
      section: 'account',
      method: 'signin2',
      action: 1,
      key: '1234',
      device_token: 'device token',
      device_token_type: 'ANDROID'
    })),
    response: {
      status: 200,
      body: {
        status: 'OK',
        values: {
          authCode: 'auth code',
          _appName: 'simple'
        }
      }
    }
  })
}

function mockApiAuthCallback () {
  fetchMock.once({
    method: 'POST',
    matcher: (url, { body }) => url === 'https://ibank.belinvestbank.by/app_api' && _.isEqual(body, stringify({
      section: 'account',
      method: 'authCallback',
      auth_code: 'auth code'
    })),
    response: {
      status: 200,
      headers: { 'set-cookie': 'PHPSESSID=ibanksession;' },
      body: {
        status: 'OK',
        values: {
          enableCorp: '1',
          enableSimple: '1',
          showMenuBlock: true,
          siteArea: 'physicist',
          _appName: 'simple'
        }
      }
    }
  })
}

function mockApiSaveDevice () {
  fetchMock.once({
    method: 'POST',
    headers: { Cookie: 'PHPSESSID=ibanksession;' },
    matcher: (url, { body }) => url === 'https://ibank.belinvestbank.by/simple/mobile-api/v1/mobile/setDeviceId' && _.isEqual(body, stringify({
      deviceId: 'device id',
      os: 'Android'
    })),
    response: {
      status: 200,
      body: {
        status: 'OK',
        values: {
          info: 'SMS sent for device binding',
          _appName: 'simple'
        }
      }
    }
  })

  fetchMock.once({
    method: 'POST',
    headers: { Cookie: 'PHPSESSID=ibanksession;' },
    matcher: (url, { body }) => url === 'https://ibank.belinvestbank.by/simple/mobile-api/v1/mobile/setDevice' && _.isEqual(body, stringify({
      deviceId: 'device id',
      code: '5678'
    })),
    response: {
      status: 200,
      body: {
        status: 'OK',
        values: {
          info: 'Device registered',
          _appName: 'simple'
        }
      }
    }
  })
}

function mockApiFetchAccounts () {
  fetchMock.once({
    method: 'POST',
    headers: { Cookie: 'PHPSESSID=ibanksession;' },
    matcher: (url, { body }) => url === 'https://ibank.belinvestbank.by/app_api' && _.isEqual(body, stringify({
      section: 'payments',
      method: 'index'
    })),
    response: {
      status: 200,
      body: {
        status: 'OK',
        values: {
          cards: [
            {
              balance: '1 213.84',
              blocking: '',
              blockingCode: '',
              blockingText: '',
              cardClass: 'type-logo_belcaed-maestro',
              cardClassColor: '_type_blue',
              cardHolder: 'VASILIY PYPKIN',
              cardImage: '/core/assets/redesign3/images/cardsLogo/belcard_mini2.svg',
              cardName: '',
              cardsKey: 30848200,
              commonId: 'ownBankCards_30848200',
              corporative: 0,
              currency: 'BYN',
              expdate: 1711832400,
              finalName: 'Безымянная',
              fixedBalance: 99.9,
              id: '30848200',
              international: 0,
              internet: 1,
              isBelcard: 0,
              isCredit: 0,
              isCurrent: true,
              isDBO: 0,
              isGroupPackage: '0',
              isProlongable: 0,
              isReplaceable: 1,
              isSendPinAllowed: 1,
              isVirtual: '0',
              num: '**** 1111',
              packageName: '',
              availableAmt: '1 213.84',
              overdraftAmt: '0',
              freeAmt: '1 213.84',
              pimpText: '',
              status3D: 0,
              statusLimits: 0,
              statusPimp: 0,
              subTitle: '',
              type: 'БЕЛКАРТ-Maestro',
              widgetContent: []
            }
          ],
          chooseHistoryPeriod: null,
          coursesType: 'cards',
          enableCorp: '1',
          enableSimple: '1',
          showMenuBlock: true,
          siteArea: 'physicist',
          type: 'PAYMENT',
          _appName: 'simple'
        }
      }
    }
  })
}

function mockApiFetchTransactions () {
  fetchMock.once({
    method: 'POST',
    headers: { Cookie: 'PHPSESSID=ibanksession;' },
    matcher: (url, { body }) => url === 'https://ibank.belinvestbank.by/app_api' && _.isEqual(body, stringify({
      section: 'cards',
      method: 'history',
      cardId: 30848200,
      dateFrom: '27.12.2025',
      dateTo: '02.01.2026'
    })),
    response: {
      status: 200,
      body: {
        status: 'OK',
        values: {
          cardId: '30848200',
          cardNum: '**** **** **** 1111',
          cards: [
            {
              balance: '1 213.84',
              blocking: '',
              blockingCode: '',
              blockingText: '',
              cardClass: 'type-logo_belcaed-maestro',
              cardClassColor: '_type_blue',
              cardHolder: 'VASILIY PYPKIN',
              cardImage: '/core/assets/redesign3/images/cardsLogo/belcard_mini2.svg',
              cardName: '',
              cardsKey: 30848200,
              commonId: 'ownBankCards_30848200',
              corporative: 0,
              currency: 'BYN',
              expdate: 1711832400,
              finalName: 'Безымянная',
              fixedBalance: 99.9,
              id: '30848200',
              international: 0,
              internet: 1,
              isBelcard: 0,
              isCredit: 0,
              isCurrent: true,
              isDBO: 0,
              isGroupPackage: '0',
              isProlongable: 0,
              isReplaceable: 1,
              isSendPinAllowed: 1,
              isVirtual: '0',
              num: '**** 1111',
              packageName: '',
              availableAmt: '1 213.84',
              overdraftAmt: '0',
              freeAmt: '1 213.84',
              pimpText: '',
              status3D: 0,
              statusLimits: 0,
              statusPimp: 0,
              subTitle: '',
              type: 'БЕЛКАРТ-Maestro',
              widgetContent: []
            }
          ],
          chooseHistoryPeriod: null,
          history: [
            {
              cardNum: '**** **** **** 1111',
              date: '2026-01-01 10:12:13',
              type: 'ПОПОЛНЕНИЕ',
              accountAmt: '10,13',
              status: 'ПРОВЕДЕНО'
            }
          ],
          coursesType: 'cards',
          currentCard: {
            balance: ' 99,90 BYN',
            cardImage: '/core/assets/redesign3/images/cardsLogo/belcard_mini2.svg',
            cardName: '',
            cardNum: '**** 1111',
            clearBalance: 99.9,
            currency: 'BYN',
            type: 'БЕЛКАРТ-Maestro'
          },
          dateFrom: '27.12.2025',
          dateTo: '02.01.2026',
          emailSubscribed: false,
          enableCorp: '1',
          enableSimple: '1',
          maxPeriodDays: 90,
          showMenuBlock: true,
          siteArea: 'physicist',
          summaryData: {
            availableSum: ' 0,00',
            currencyCode: 'BYN',
            debtSum: '0',
            freeSum: ' 0,00',
            lockedSum: ' 0,00',
            minimumBalance: '0,00',
            overdraftSum: '0'
          },
          timeInterval: null,
          _appName: 'simple'
        }
      }
    }
  })
}

function mockZenMoney () {
  global.ZenMoney = {
    ...makePluginDataApi({
      deviceId: 'device id',
      token: 'device token'
    }).methods
  }
  let readLineCallCount = 0
  ZenMoney.readLine = async () => {
    readLineCallCount++
    return readLineCallCount === 1 ? '1234' : '5678'
  }
}
