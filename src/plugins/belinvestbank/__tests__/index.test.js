import fetchMock from 'fetch-mock'
import _ from 'lodash'
import { stringify } from 'querystring'
import { scrape } from '..'
import { makePluginDataApi } from '../../../ZPAPI.pluginData'

const LOGIN_PAGE_HTML = `<html><body>
<script type="text/javascript">
var jsData = {"alphabet":{"lang":["a","b","c","d","e","f","g","h","i","j","k","l","m","n","o","p","q","r","s","t","u","v","w","x","y","z","A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T","U","V","W","X","Y","Z","0","1","2","3","4","5","6","7","8","9"],"keyLang":[97,98,99,100,101,102,103,104,105,106,107,108,109,110,111,112,113,114,115,116,117,118,119,120,121,122,65,66,67,68,69,70,71,72,73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90,48,49,50,51,52,53,54,55,56,57]}};
</script>
</body></html>`

describe('scrape', () => {
  it('should hit the mocks and return results', async () => {
    mockZenMoney()
    mockWebSigninPage()
    mockWebSigninPost()
    mockWebSignin2Post()
    mockApiIbankInit()
    mockApiAuthCallback()
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

function mockWebSigninPage () {
  fetchMock.once({
    method: 'GET',
    matcher: (url) => url === 'https://login.belinvestbank.by/signin',
    response: {
      status: 200,
      headers: { 'set-cookie': 'PHPSESSID=websession;' },
      body: LOGIN_PAGE_HTML
    }
  })
}

function mockWebSigninPost () {
  fetchMock.once({
    method: 'POST',
    matcher: (url) => url === 'https://login.belinvestbank.by/signin',
    response: {
      status: 302,
      headers: { location: 'https://login.belinvestbank.by/signin2' }
    }
  })
}

function mockWebSignin2Post () {
  fetchMock.once({
    method: 'POST',
    matcher: (url) => url === 'https://login.belinvestbank.by/signin2',
    response: {
      status: 302,
      headers: { location: 'https://ibank.belinvestbank.by/authCallback?auth_code=webformcode' }
    }
  })
}

function mockApiIbankInit () {
  fetchMock.once({
    method: 'POST',
    matcher: (url, { body }) => url === 'https://ibank.belinvestbank.by/app_api' && body === stringify({
      section: 'account',
      method: 'signin',
      login: '',
      password: ''
    }),
    response: {
      status: 200,
      headers: { 'set-cookie': 'PHPSESSID=ibanksession;' },
      body: {
        status: 'OK',
        values: { isSignInPage: true }
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
      auth_code: 'webformcode'
    })),
    response: {
      status: 200,
      headers: { 'set-cookie': 'PHPSESSID=ibanksession;' },
      body: {
        status: 'OK',
        values: {
          chooseHistoryPeriod: null,
          coursesType: 'cards',
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
          currencyCourses: [],
          currentCard: {
            balance: ' 99,90 BYN',
            cardImage: '/core/assets/redesign3/images/cardsLogo/belcard_mini2.svg',
            cardName: '',
            cardNum: '**** 1111',
            clearBalance: 99.9,
            currency: 'BYN',
            type: 'БЕЛКАРТ-Maestro'
          },
          currentCourses: [],
          enableCorp: '1',
          enableSimple: '1',
          eripArr: [],
          infMsg: {},
          paymentsTree: [],
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
    ...makePluginDataApi({}).methods
  }
  ZenMoney.readLine = async () => '1234'
}

