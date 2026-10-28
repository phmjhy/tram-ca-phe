export function configuration(env = process.env) {
  const origin = env.APP_ORIGIN || (env.VERCEL_URL ? `https://${env.VERCEL_URL}` : '');
  if (!env.DATABASE_URL || !env.BETTER_AUTH_SECRET || env.BETTER_AUTH_SECRET.length < 32 || !origin) {
    throw Object.assign(new Error('Backend chưa được cấu hình. Cần DATABASE_URL, BETTER_AUTH_SECRET (ít nhất 32 ký tự) và APP_ORIGIN hoặc VERCEL_URL ở server.'), { status: 503 });
  }
  const url = new URL(origin);
  if (url.origin !== origin || (!['localhost', '127.0.0.1'].includes(url.hostname) && url.protocol !== 'https:')) throw new Error('APP_ORIGIN không hợp lệ.');
  return { databaseUrl: env.DATABASE_URL, secret: env.BETTER_AUTH_SECRET, origin };
}
