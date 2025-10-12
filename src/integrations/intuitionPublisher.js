const axios = require('axios');
const crypto = require('crypto');

function getEnv(name, fallback) {
  const v = process.env[name];
  return v === undefined ? fallback : v;
}

function computeIdempotencyKey(userAddress, guildId, quizId) {
  const input = `${(userAddress || '').toLowerCase()}|${guildId || ''}|${quizId || ''}`;
  return crypto.createHash('sha256').update(input).digest('hex');
}

async function publishQuizCompletion(event) {
  try {
    const enabled = String(getEnv('INTUITION_ENABLED', 'false')).toLowerCase() === 'true';
    if (!enabled) return { skipped: true, reason: 'disabled' };

    const url = getEnv('INTUITION_URL', '').trim();
    const token = getEnv('INTUITION_TOKEN', '').trim();
    if (!url || !token) {
      return { skipped: true, reason: 'missing_config' };
    }

    const { userAddress, guildId, quizId, completedAt } = event || {};
    if (!userAddress || !guildId || !quizId || !completedAt) {
      return { skipped: true, reason: 'missing_fields' };
    }

    const idempotencyKey = computeIdempotencyKey(userAddress, guildId, quizId);
    const payload = {
      type: 'quiz_completed',
      userAddress,
      guildId,
      metadata: {
        quizId,
        completedAt,
      },
    };

    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
      'X-Request-Id': crypto.randomUUID ? crypto.randomUUID() : undefined,
      'X-Agent-Version': getEnv('npm_package_version', 'unknown'),
    };

    await axios.post(url, payload, { headers, timeout: 2000, validateStatus: () => true })
      .then(res => {
        if (res.status >= 400) {
          console.error('[IntuitionPublisher] Non-2xx response', {
            status: res.status,
            data: res.data,
          });
        } else {
          console.log('[IntuitionPublisher] Event accepted', { status: res.status });
        }
      })
      .catch(err => {
        console.error('[IntuitionPublisher] Request error', { message: err.message });
      });

    return { ok: true };
  } catch (error) {
    console.error('[IntuitionPublisher] Unexpected error', error);
    return { ok: false, error: error.message };
  }
}

module.exports = { publishQuizCompletion };


