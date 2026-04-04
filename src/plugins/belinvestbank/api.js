import { Base64 } from 'jshashes'
import { defaultsDeep, flatMap } from 'lodash'
import { stringify } from 'querystring'
import { createDateIntervals as commonCreateDateIntervals } from '../../common/dateUtils'
import { fetchJson } from '../../common/network'
import { generateRandomString } from '../../common/utils'
import { InvalidOtpCodeError, InvalidPreferencesError, TemporaryError } from '../../errors'

const base64 = new Base64()
const loginUrl = 'https://login.belinvestbank.by/app_api'
const dataUrl = 'https://ibank.belinvestbank.by/app_api'

const APP_VERSION = '2.25.0'

function generateUUID () {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
  })
}

export function getDevice () {
  const deviceID = ZenMoney.getData('deviceId', generateUUID())
  ZenMoney.setData('deviceId', deviceID)
  const deviceToken = ZenMoney.getData('token', base64.encode(generateRandomString(203)))
  ZenMoney.setData('token', deviceToken)
  return {
    id: deviceID,
    token: deviceToken
  }
}

async function fetchApiJson (url, options, predicate = () => true, error = (message) => console.assert(false, message)) {
  options = defaultsDeep(
    options,
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Android',
        DEVICE_TOKEN: 123456,
        Connection: 'Keep-Alive',
        'Accept-Encoding': 'gzip'
      },
      sanitizeRequestLog: { headers: { Cookie: true } },
      sanitizeResponseLog: { headers: { 'set-cookie': true } },
      stringify
    }
  )
  if (options.headers && options.headers.Cookie) {
    options.headers['zp-cookie'] = options.headers.Cookie
  }

  const response = await fetchJson(url, options)
  if (predicate) {
    validateResponse(response, response => predicate(response), error)
  }

  if (response.body.status && (response.body.status === 'ER' || response.body.status === 'SE') && response.body.message && !response.body.isNeedConfirmSessionKey) {
    const errorDescription = response.body.message
    const errorMessage = 'Ответ банка: ' + errorDescription
    if (errorDescription.indexOf('введены неверно') >= 0) { throw new InvalidPreferencesError(errorMessage) }
    if (errorDescription.indexOf('попытки ввода') >= 0 || errorDescription.indexOf('попыток ввода') >= 0 || errorDescription.indexOf('сеансового ключа') >= 0) { throw new InvalidOtpCodeError(errorMessage) }
    if (errorDescription.indexOf('Отвяжите устройство') >= 0) { throw new TemporaryError(errorMessage) }
    console.assert(false, 'unexpected response', response)
  }

  return response
}

function validateResponse (response, predicate, error) {
  if (!predicate || !predicate(response)) {
    error('non-successful response')
  }
}

function cookies (response) {
  if (response.headers) {
    const setCookie = response.headers['set-cookie']
    if (setCookie) {
      const matches = setCookie.match(/PHPSESSID=[^;,\s]+/g)
      if (matches) return matches[matches.length - 1] + ';'
    }
  }
  return ''
}

export async function login (login, password) {
  if (ZenMoney.trustCertificates) {
    ZenMoney.trustCertificates([
      `-----BEGIN CERTIFICATE-----
MIIJOTCCCCGgAwIBAgIMSqLONbKaZMW658uzMA0GCSqGSIb3DQEBCwUAMGIxCzAJ
BgNVBAYTAkJFMRkwFwYDVQQKExBHbG9iYWxTaWduIG52LXNhMTgwNgYDVQQDEy9H
bG9iYWxTaWduIEV4dGVuZGVkIFZhbGlkYXRpb24gQ0EgLSBTSEEyNTYgLSBHMzAe
Fw0yNTA0MDExMzU2MTRaFw0yNjA1MDMxMzU2MTNaMIIBFTEdMBsGA1UEDwwUUHJp
dmF0ZSBPcmdhbml6YXRpb24xEjAQBgNVBAUTCTgwNzAwMDAyODETMBEGCysGAQQB
gjc8AgEDEwJCWTELMAkGA1UEBhMCQlkxEzARBgNVBAgMCtCc0LjQvdGB0LoxEzAR
BgNVBAcMCtCc0LjQvdGB0LoxeTB3BgNVBAoMcNCe0JDQniDQkdC10LvQvtGA0YPR
gdGB0LrQuNC5INCx0LDQvdC6INGA0LDQt9Cy0LjRgtC40Y8g0Lgg0YDQtdC60L7Q
vdGB0YLRgNGD0LrRhtC40Lgg0JHQtdC70LjQvdCy0LXRgdGC0LHQsNC60LoxGTAX
BgNVBAMTEGJlbGludmVzdGJhbmsuYnkwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAw
ggEKAoIBAQDLufFqw1FAFl6i3OLxtrxIAwG9j5BF9sox625iSIpd0SysM+8gEqHX
b3pP2LsMmypQOeS8G1VbkKLpMVSQWGlBWUCyiXcxQmgWKnEhdJu2/zwlMkDPcKIv
6NPi0fZc6uA9GAa14RLntiQY/AyVrsFsP07NkabUxRcDYQFV8QZV2iF6+leT5/UK
HHVNL8iltn22uib9nAUWg7qq7xMnGGxM9/YD5/dxFwBHtdW+71oaqERcLh+wiULn
ot/LYM5QWGk+IiAjyYMmqmQFJ1H1fq38ZH+ucufyPL1V8PJtbyjt4bmtBCoxgyG0
pyJKlY3DqecSFBeQGXAtnQTrn1vAeQAZAgMBAAGjggU4MIIFNDAOBgNVHQ8BAf8E
BAMCBaAwDAYDVR0TAQH/BAIwADCBlgYIKwYBBQUHAQEEgYkwgYYwRwYIKwYBBQUH
MAKGO2h0dHA6Ly9zZWN1cmUuZ2xvYmFsc2lnbi5jb20vY2FjZXJ0L2dzZXh0ZW5k
dmFsc2hhMmczcjMuY3J0MDsGCCsGAQUFBzABhi9odHRwOi8vb2NzcDIuZ2xvYmFs
c2lnbi5jb20vZ3NleHRlbmR2YWxzaGEyZzNyMzBVBgNVHSAETjBMMEEGCSsGAQQB
oDIBATA0MDIGCCsGAQUFBwIBFiZodHRwczovL3d3dy5nbG9iYWxzaWduLmNvbS9y
ZXBvc2l0b3J5LzAHBgVngQwBATBFBgNVHR8EPjA8MDqgOKA2hjRodHRwOi8vY3Js
Lmdsb2JhbHNpZ24uY29tL2dzL2dzZXh0ZW5kdmFsc2hhMmczcjMuY3JsMIIB+QYD
VR0RBIIB8DCCAeyCEGJlbGludmVzdGJhbmsuYnmCHnhuLS04MGFiYWRvYnR1ZHZl
OWJuLnhuLS05MGFpc4IgeG4tLTgwYWJhZG9iMWJkc2U1Ym05dy54bi0tOTBhaXOC
FmliYW5rLmJlbGludmVzdGJhbmsuYnmCFHBvcy5iZWxpbnZlc3RiYW5rLmJ5ghRi
aXouYmVsaW52ZXN0YmFuay5ieYIWbG9naW4uYmVsaW52ZXN0YmFuay5ieYIVbmNt
cy5iZWxpbnZlc3RiYW5rLmJ5ghdjYW1wdXMuYmVsaW52ZXN0YmFuay5ieYIdd2Vi
LXBhcnRuZXJzLmJlbGludmVzdGJhbmsuYnmCFm5jd2ViLmJlbGludmVzdGJhbmsu
YnmCFHd3dy5iZWxpbnZlc3RiYW5rLmJ5ghdpYmtzZ24uYmVsaW52ZXN0YmFuay5i
eYIUdGliLmJlbGludmVzdGJhbmsuYnmCGGFwaS1iaXouYmVsaW52ZXN0YmFuay5i
eYIaYXBpLWliYW5rLmJlbGludmVzdGJhbmsuYnmCFHJjcC5iZWxpbnZlc3RiYW5r
LmJ5ghVyY3AyLmJlbGludmVzdGJhbmsuYnmCFHJjcy5iZWxpbnZlc3RiYW5rLmJ5
ghVyY3MyLmJlbGludmVzdGJhbmsuYnkwHQYDVR0lBBYwFAYIKwYBBQUHAwEGCCsG
AQUFBwMCMB8GA1UdIwQYMBaAFN2z522oLujFTm7PdOZ1PJQVzugdMB0GA1UdDgQW
BBRmWcQ/cVoityc+wUcnRnG6MvmSbTCCAX8GCisGAQQB1nkCBAIEggFvBIIBawFp
AHYAZBHEbKQS7KeJHKICLgC8q08oB9QeNSer6v7VA8l9zfAAAAGV8aOFnwAABAMA
RzBFAiA3ZW0iMS3Rp0Sp1p0cpGYeAJtkpLLav5OMRIF4ceCJBQIhAOFiWG0/8av6
cCj2LVy0E+F2Qap22SRxaUrfqcgXeumaAHcADleUvPOuqT4zGyyZB7P3kN+bwj1x
MiXdIaklrGHFTiEAAAGV8aOFkgAABAMASDBGAiEAxjnAR5Ye2sjJ6HU++fIITiKG
/AHZtdrjyoZcoBDWb/UCIQCahbvOBSOeSWL1ufoYd2Om4zhI22WO/B7ztM5XletJ
HQB2ACUvlMIrKelun0EacgcraVxbUv+XqQ0lQLv83FHsTe4LAAABlfGjhesAAAQD
AEcwRQIhAMvHswDtFbv9nLFPDew9HIiD0cF139Ufp2Iiis0A7URZAiATL2zWm6Sk
biMchT5R/wnsKytq2Xraj4WJKskkbbQO6DANBgkqhkiG9w0BAQsFAAOCAQEAPtKU
bJbyhPN2VSzCZsHYKOuyrNv1bu8frTtxABbfNurnQJEhnZQEfIe9WQ1ShX9z6AzM
CSPub+NgdZ4m65qDovlx9ytW83+ULwtGHWkcmFzgnv1hYuNvbSWSvHbv5So1/+6I
iTrKM/IuEcn+4m2ZxhnLxOKl/ofgw2LpV1T1s5oxClzW1uU35HvZLwInReYmP6yF
rr9+sx5lWZ5CJPJgBmgN9M3I86qHJTZiO2skkWQVohpGyuBr17SUgDcmjGA+seMN
RcKU18IVYcmzCkZymo7An3zD68Pq38TGn1QcYieV8vdE18uLGUkRnFN1bqodNFu5
9FjOp+7y/TY6Iv819Q==
-----END CERTIFICATE-----`
    ])
  }

  // Reuse saved session
  const savedCookies = ZenMoney.getData('sessionCookies', null)
  if (savedCookies) {
    try {
      const testRes = await fetchApiJson(dataUrl, {
        method: 'POST',
        headers: { Cookie: savedCookies },
        body: { section: 'payments', method: 'index' }
      }, response => response.ok && response.body?.status === 'OK',
      () => { throw new Error('Session invalid') })
      if (testRes.body.status === 'OK') {
        return savedCookies
      }
    } catch (e) {
      ZenMoney.setData('sessionCookies', null)
    }
  }

  // App API login
  const device = getDevice()
  ZenMoney.saveData()
  console.log('[LOGIN] deviceId:', device.id)

  let res = (await fetchApiJson(loginUrl, {
    method: 'POST',
    body: {
      section: 'account',
      method: 'signin',
      login,
      password,
      deviceId: device.id,
      versionApp: APP_VERSION,
      deviceName: 'Samsung SM-S926B',
      os: 'Android',
      AndroidVersion: '34',
      device_token: device.token,
      device_token_type: 'ANDROID',
      typeSessionKey: '0'
    },
    sanitizeRequestLog: { body: { login: true, password: true } }
  }, response => response.ok, message => new InvalidPreferencesError('Неверный логин или пароль')))
  let sessionCookies = cookies(res)

  console.log('[LOGIN] signin response:', JSON.stringify(res.body))
  console.log('[LOGIN] isNeedConfirmSessionKey:', res.body.isNeedConfirmSessionKey)

  if (res.body.isNeedConfirmSessionKey) {
    console.log('[LOGIN] Confirming close session...')
    res = (await fetchApiJson(loginUrl, {
      method: 'POST',
      headers: { Cookie: sessionCookies },
      body: {
        section: 'account',
        method: 'confirmationCloseSession'
      }
    }, response => response.ok, message => new InvalidPreferencesError('bad request')))
    console.log('[LOGIN] confirmationCloseSession response:', JSON.stringify(res.body))
    const newCookies = cookies(res)
    if (newCookies) {
      sessionCookies = newCookies
      console.log('[LOGIN] Updated cookies after confirmationCloseSession')
    }
  }

  let isNeededSaveDevice = false
  console.log('[LOGIN] values:', JSON.stringify(res.body.values))
  console.log('[LOGIN] authCode:', res.body.values?.authCode)
  if (res.body.values && !res.body.values.authCode) {
    console.log('[LOGIN] No authCode, SMS needed. Waiting for user input...')
    const code = await ZenMoney.readLine('Введите код из СМС для входа в Белинвестбанк (первый полученный код!)', {
      time: 120000,
      inputType: 'number'
    })
    if (!code || !code.trim()) {
      throw new InvalidOtpCodeError()
    }
    console.log('[LOGIN] User entered code, sending signin2...')

    res = (await fetchApiJson(loginUrl, {
      method: 'POST',
      headers: { Cookie: sessionCookies },
      body: {
        section: 'account',
        method: 'signin2',
        action: 1,
        key: code.trim(),
        device_token: device.token,
        device_token_type: 'ANDROID'
      }
    }, response => response.ok && response.body.status && response.body.status === 'OK', message => new InvalidPreferencesError('bad request')))
    console.log('[LOGIN] signin2 response:', JSON.stringify(res.body))

    isNeededSaveDevice = true
  }

  res = (await fetchApiJson(dataUrl, {
    method: 'POST',
    body: {
      section: 'account',
      method: 'authCallback',
      auth_code: res.body.values.authCode
    }
  }, response => response.ok && response.body.status && response.body.status === 'OK', message => new InvalidPreferencesError('bad request')))
  sessionCookies = cookies(res)

  if (isNeededSaveDevice) {
    const mobileApiUrl = 'https://ibank.belinvestbank.by/simple/mobile-api/v1/mobile'

    console.log('[LOGIN] Step 1: setDeviceId (triggering binding SMS)...')
    try {
      const setDeviceIdRes = await fetchJson(mobileApiUrl + '/setDeviceId', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Android',
          Cookie: sessionCookies,
          'zp-cookie': sessionCookies
        },
        body: {
          deviceId: device.id,
          os: 'Android'
        },
        stringify,
        sanitizeRequestLog: { headers: { Cookie: true } },
        sanitizeResponseLog: { headers: { 'set-cookie': true } }
      })
      console.log('[LOGIN] setDeviceId response:', JSON.stringify(setDeviceIdRes.body))
    } catch (e) {
      console.log('[LOGIN] setDeviceId error (non-fatal):', e.message)
    }

    try {
      console.log('[LOGIN] Step 2: Waiting for device binding SMS code...')
      const bindingCode = await ZenMoney.readLine('Введите код привязки устройства из СМС (код для привязки мобильного приложения)', {
        time: 120000,
        inputType: 'number'
      })
      if (!bindingCode || !bindingCode.trim()) {
        console.log('[LOGIN] No binding code entered, device not registered')
      } else {
        console.log('[LOGIN] Step 3: setDevice with binding code...')
        const setDeviceRes = await fetchJson(mobileApiUrl + '/setDevice', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'Android',
            Cookie: sessionCookies,
            'zp-cookie': sessionCookies
          },
          body: {
            deviceId: device.id,
            code: bindingCode.trim()
          },
          stringify,
          sanitizeRequestLog: { headers: { Cookie: true } },
          sanitizeResponseLog: { headers: { 'set-cookie': true } }
        })
        console.log('[LOGIN] setDevice response:', JSON.stringify(setDeviceRes.body))
        console.log('Device registered successfully')
      }
    } catch (e) {
      console.log('[LOGIN] Device binding failed (non-fatal):', e.message)
    }
  }

  ZenMoney.setData('sessionCookies', sessionCookies)
  ZenMoney.saveData()
  return sessionCookies
}

export async function fetchAccounts (sessionCookies) {
  const accounts = (await fetchApiJson(dataUrl, {
    method: 'POST',
    headers: { Cookie: sessionCookies },
    body: {
      section: 'payments',
      method: 'index'
    }
  }, response => response.ok && response.body?.status === 'OK',
  message => new InvalidPreferencesError('bad request')))
  return accounts.body.values.cards
}

function formatDate (date) {
  return ('0' + date.getDate()).slice(-2) + '.' + ('0' + (date.getMonth() + 1)).slice(-2) + '.' + date.getFullYear()
}

export function createDateIntervals (fromDate, toDate) {
  const interval = 10 * 24 * 60 * 60 * 1000 // 10 days interval for fetching data
  const gapMs = 1
  return commonCreateDateIntervals({
    fromDate,
    toDate,
    addIntervalToDate: date => new Date(date.getTime() + interval - gapMs),
    gapMs
  })
}

export async function fetchTransactions (sessionCookies, account, fromDate, toDate = new Date()) {
  toDate = toDate || new Date()

  const dates = createDateIntervals(fromDate, toDate)
  const operations = []
  let summaryData = null
  let msCardId = null
  for (const [dateFrom, dateTo] of dates) {
    const response = await fetchApiJson(dataUrl, {
      method: 'POST',
      headers: { Cookie: sessionCookies },
      body: {
        section: 'cards',
        method: 'history',
        cardId: account.id,
        dateFrom: formatDate(dateFrom),
        dateTo: formatDate(dateTo)
      }
    }, () => true, () => null).catch(() => null)
    const history = response && response.body && response.body.values && response.body.values.history
    if (response?.body?.values?.summaryData) summaryData = response.body.values.summaryData
    if (!msCardId) {
      const cards = response?.body?.values?.cards
      if (cards && cards.length > 0 && cards[0].msCardId) msCardId = cards[0].msCardId
    }
    if (history) operations.push(...flatMap(history, op => op))
  }
  return { history: operations, summaryData, msCardId }
}

export async function fetchCardBalance (sessionCookies, msCardId) {
  const ibankUrl = 'https://ibank.belinvestbank.by/cards/balance-by-card'
  const response = await fetchApiJson(ibankUrl, {
    method: 'POST',
    headers: { Cookie: sessionCookies },
    body: { msCardId }
  }, () => true, () => null).catch(() => null)
  if (response?.body?.status === 'OK' && response.body.balance != null) {
    return response.body.balance
  }
  return null
}
