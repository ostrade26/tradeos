/** Login-page notice after auth redirect (e.g. historical kick for device limit). */
export const LOGIN_NOTICE_KEY = 'tradeal-login-notice'

export type LoginNoticeCode = 'session_replaced'

export const LOGIN_NOTICE_COPY: Record<LoginNoticeCode, { title: string; body: string }> = {
  session_replaced: {
    title: 'Signed out on this device',
    body:
      'This account was used to sign in somewhere else. You can stay signed in on up to 2 devices (for example phone and computer). If that was not you, change your password.',
  },
}

export function setLoginNotice(code: LoginNoticeCode) {
  try {
    sessionStorage.setItem(LOGIN_NOTICE_KEY, code)
  } catch {
    // ignore
  }
}

export function consumeLoginNotice(): LoginNoticeCode | null {
  try {
    const raw = sessionStorage.getItem(LOGIN_NOTICE_KEY)
    sessionStorage.removeItem(LOGIN_NOTICE_KEY)
    if (raw === 'session_replaced') return raw
    return null
  } catch {
    return null
  }
}
