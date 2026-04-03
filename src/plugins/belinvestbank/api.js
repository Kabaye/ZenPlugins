import { defaultsDeep, flatMap } from 'lodash'
import { stringify } from 'querystring'
import { createDateIntervals as commonCreateDateIntervals } from '../../common/dateUtils'
import { fetch, fetchJson } from '../../common/network'
import { InvalidOtpCodeError } from '../../errors'

const dataUrl = 'https://ibank.belinvestbank.by/app_api'
const loginWebUrl = 'https://login.belinvestbank.by'

// Minimal browser fingerprint sent with the web login form
const DEVICE_PRINT = Buffer.from(JSON.stringify({
  'navigator.appCodeName': 'Mozilla',
  'navigator.language': 'ru',
  'navigator.platform': 'Android',
  'screen.height': 1920,
  'screen.width': 1080,
  'screen.colorDepth': 24
})).toString('base64')

const WEB_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'ru-RU,ru;q=0.9'
}

function extractJsData (html) {
  const prefix = html.indexOf('window.jsData = ') >= 0 ? 'window.jsData = ' : 'var jsData = '
  const idx = html.indexOf(prefix)
  if (idx < 0) throw new Error('Cannot find jsData on login page')
  const start = idx + prefix.length
  let depth = 0
  let i = start
  while (i < html.length) {
    if (html[i] === '{') depth++
    else if (html[i] === '}') { depth--; if (depth === 0) break }
    i++
  }
  return JSON.parse(html.slice(start, i + 1))
}

function encryptPassword (password, alphabet) {
  const { lang, keyLang } = alphabet
  return password.split('').map(char => {
    const idx = lang.indexOf(char)
    return idx >= 0 ? String.fromCharCode(keyLang[idx]) : char
  }).join('')
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
vdGB0YLRgNGD0LrRhtC40Lgg0JHQtdC70LjQvdCy0LXRgdGC0LHQsNC90LoxGTAX
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

  // Reuse saved session to avoid repeated authentication
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

  // Step 1: GET login page — get PHPSESSID + alphabet for password encryption
  const loginPageRes = await fetch(loginWebUrl + '/signin', {
    method: 'GET',
    headers: { ...WEB_HEADERS },
    sanitizeResponseLog: { headers: { 'set-cookie': true } }
  })
  let webCookies = cookies(loginPageRes)
  const jsData = extractJsData(loginPageRes.body)
  const encryptedPassword = encryptPassword(password, jsData.alphabet)

  // Step 2: POST credentials to web login form — triggers OTP SMS
  let signinRes = await fetch(loginWebUrl + '/signin', {
    method: 'POST',
    redirect: 'manual',
    headers: {
      ...WEB_HEADERS,
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: webCookies,
      Referer: loginWebUrl + '/signin'
    },
    body: stringify({
      login,
      password: encryptedPassword,
      typeSessionKey: 0,
      devicePrint: DEVICE_PRINT
    }),
    sanitizeRequestLog: { body: { login: true, password: true } },
    sanitizeResponseLog: { headers: { 'set-cookie': true } }
  })
  const newCookies = cookies(signinRes)
  if (newCookies) webCookies = newCookies

  // Handle session conflict: bank redirects back to /signin when another session is active
  const signinLocation = signinRes.headers.location || signinRes.headers.Location || ''
  if (signinLocation.includes('/signin') && !signinLocation.includes('/signin2')) {
    signinRes = await fetch(loginWebUrl + '/confirmationCloseSession', {
      method: 'POST',
      redirect: 'manual',
      headers: {
        ...WEB_HEADERS,
        'Content-Type': 'application/x-www-form-urlencoded',
        Cookie: webCookies,
        Referer: loginWebUrl + '/signin'
      },
      sanitizeResponseLog: { headers: { 'set-cookie': true } }
    })
    const closedCookies = cookies(signinRes)
    if (closedCookies) webCookies = closedCookies
  }

  // Step 3: Ask user for OTP code sent to their phone
  const otpCode = await ZenMoney.readLine('Введите код из СМС для входа в Белинвестбанк', {
    time: 120000,
    inputType: 'number'
  })
  if (!otpCode || !otpCode.trim()) throw new InvalidOtpCodeError()

  // Step 4: Submit OTP — bank redirects to ibank/authCallback?auth_code=XXX
  const signin2Res = await fetch(loginWebUrl + '/signin2', {
    method: 'POST',
    redirect: 'manual',
    headers: {
      ...WEB_HEADERS,
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: webCookies,
      Referer: loginWebUrl + '/signin2'
    },
    body: stringify({ action: 1, key: otpCode.trim() }),
    sanitizeRequestLog: { body: { key: true } },
    sanitizeResponseLog: { headers: { 'set-cookie': true } }
  })

  // Extract auth_code from the redirect Location header
  const authCallbackLocation = signin2Res.headers.location || signin2Res.headers.Location || ''
  const authCodeMatch = authCallbackLocation.match(/auth_code=([^&]+)/)
  if (!authCodeMatch) throw new InvalidOtpCodeError()
  const authCode = authCodeMatch[1]

  // Step 5: Init ibank session and complete auth via authCallback
  const ibankInitRes = await fetchJson(dataUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Android',
      Connection: 'Keep-Alive',
      'Accept-Encoding': 'gzip'
    },
    body: { section: 'account', method: 'signin', login: '', password: '' },
    sanitizeRequestLog: {},
    sanitizeResponseLog: { headers: { 'set-cookie': true } },
    stringify
  })
  const ibankCookies = cookies(ibankInitRes)

  const authCallbackRes = await fetchApiJson(dataUrl, {
    method: 'POST',
    headers: { Cookie: ibankCookies },
    body: { section: 'account', method: 'authCallback', auth_code: authCode }
  }, response => response.success && response.body.status === 'OK',
  () => new InvalidPreferencesError('Ошибка авторизации'))

  const sessionCookies = cookies(authCallbackRes) || ibankCookies
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
  let latestBalanceAmt = null
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
    if (history) {
      operations.push(...flatMap(history, op => op))
      // Track the latest transaction's balanceAmt (OSTATOK = real-time available)
      for (const op of history) {
        if (op.balanceAmt && op.balanceAmt !== '') latestBalanceAmt = op.balanceAmt
      }
    }
  }
  return { history: operations, summaryData, latestBalanceAmt }
}
