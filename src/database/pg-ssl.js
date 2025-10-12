try {
  const pg = require('pg');
  const url = process.env.DATABASE_URL || '';
  const sslDisabled = String(process.env.PGSSLMODE || '').toLowerCase() === 'disable';
  const isLocal = /(^|@)(localhost|127\.0\.0\.1)(:|\/|$)/.test(url);
  const wantsSsl = !sslDisabled && url && !isLocal;

  if (wantsSsl) {
    pg.defaults.ssl = { require: true, rejectUnauthorized: false };
    process.env.PGSSLMODE = 'require';
  } else {
    try { delete pg.defaults.ssl; } catch (_) {}
    process.env.PGSSLMODE = 'disable';
  }
} catch (_) {}
