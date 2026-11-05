import { betterAuth } from 'better-auth';
export function createAuth(pool, config, { provisioning = false } = {}) {
  return betterAuth({
    appName: 'Trạm Cà Phê', database: pool, baseURL: config.origin, secret: config.secret,
    trustedOrigins: [config.origin],
    emailAndPassword: { enabled: true, disableSignUp: !provisioning, minPasswordLength: 12, maxPasswordLength: 128 },
    session: { expiresIn: 60 * 60 * 8, updateAge: 60 * 30, cookieCache: { enabled: false } },
    rateLimit: { enabled: true, storage: 'database', window: 60, max: 100, customRules: { '/sign-in/email': { window: 60, max: 10 } } },
    advanced: { useSecureCookies: config.origin.startsWith('https:'), defaultCookieAttributes: { httpOnly: true, sameSite: 'lax' } },
    logger: { disabled: true },
  });
}
