try {
  const pg = require('pg');
  pg.defaults.ssl = { require: true, rejectUnauthorized: false };
} catch (_) {}

process.env.PGSSLMODE = process.env.PGSSLMODE || 'require';
