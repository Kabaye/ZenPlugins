import { InvalidLoginOrPasswordError, TemporaryError } from '../../../errors'

const mockFetchJson = jest.fn()

jest.mock('../../../common/network', () => ({ fetchJson: mockFetchJson }))

const response = (status: number, body: unknown): unknown => ({
  status,
  url: 'https://pay.quantera.pro/api/test',
  headers: {},
  body
})

describe('Q-Pay API', () => {
  // Require after jest.mock: esbuild does not hoist the mock ahead of static imports.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { fetchCards, fetchCurrentUser, login, SessionExpiredError } = require('../fetchApi') as typeof import('../fetchApi')

  beforeEach(() => {
    mockFetchJson.mockReset()
  })

  it('uses the observed multipart login contract and redacts secrets', async () => {
    mockFetchJson.mockResolvedValue(response(200, { access_token: 'secret', intercom_jwt_token: 'other-secret' }))

    await expect(login({ email: ' User@Example.com ', password: 'Password!1' })).resolves.toEqual({
      email: 'User@Example.com',
      accessToken: 'secret'
    })

    const [url, options] = mockFetchJson.mock.calls[0]
    expect(url).toBe('https://pay.quantera.pro/api/v1/web/auth/login')
    expect(options.method).toBe('POST')
    expect(options.headers['Content-Type']).toMatch(/^multipart\/form-data; boundary=/)
    expect(options.body).toContain('name="username"\r\n\r\nUser@Example.com')
    expect(options.body).toContain('name="password"\r\n\r\nPassword!1')
    expect(options.body).toContain('name="utm_last"\r\n\r\n{}')
    expect(options.sanitizeRequestLog).toEqual({ headers: { Authorization: true }, body: true })
    expect(options.sanitizeResponseLog).toEqual({ body: true })
  })

  it('rejects values that could break the observed form contract before making a request', async () => {
    await expect(login({ email: 'user@example.com\r\nX-Evil: 1', password: 'Password!1' }))
      .rejects.toBeInstanceOf(InvalidLoginOrPasswordError)
    expect(mockFetchJson).not.toHaveBeenCalled()
  })

  it('maps rejected credentials to a settings error', async () => {
    mockFetchJson.mockResolvedValue(response(422, { detail: 'rejected' }))
    await expect(login({ email: 'user@example.com', password: 'wrong-pass' }))
      .rejects.toBeInstanceOf(InvalidLoginOrPasswordError)
  })

  it('distinguishes an expired data session from invalid credentials', async () => {
    mockFetchJson.mockResolvedValue(response(401, { detail: 'expired' }))
    await expect(fetchCards({ email: 'user@example.com', accessToken: 'old' }))
      .rejects.toBeInstanceOf(SessionExpiredError)
  })

  it('treats outages as temporary and never exposes the response body in logs', async () => {
    mockFetchJson.mockResolvedValue(response(503, { access_token: 'must-not-be-logged' }))
    await expect(fetchCurrentUser({ email: 'user@example.com', accessToken: 'token' }))
      .rejects.toBeInstanceOf(TemporaryError)
    expect(mockFetchJson.mock.calls[0][1].sanitizeResponseLog).toEqual({ body: true })
    expect(mockFetchJson.mock.calls[0][1].sanitizeRequestLog).toEqual({
      headers: { Authorization: true },
      body: true
    })
  })
})
