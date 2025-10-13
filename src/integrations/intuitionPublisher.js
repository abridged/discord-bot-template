const axios = require('axios');
const crypto = require('crypto');

function getEnv(name, fallback) {
  const v = process.env[name];
  return v === undefined ? fallback : v;
}

function computeIdempotencyKey(userAddress, communityId, quizId) {
  const input = `${(userAddress || '').toLowerCase()}|${communityId || ''}|${quizId || ''}`;
  return crypto.createHash('sha256').update(input).digest('hex');
}

async function publishQuizCompletion(event) {
  try {
    const enabled = String(getEnv('INTUITION_ENABLED', 'false')).toLowerCase() === 'true';
    if (!enabled) {
      console.log('[IntuitionPublisher] Skipping: INTUITION_ENABLED=false');
      return { skipped: true, reason: 'disabled' };
    }

    const url = getEnv('INTUITION_URL', '').trim();
    const token = getEnv('INTUITION_TOKEN', '').trim();
    if (!url || !token) {
      console.log('[IntuitionPublisher] Skipping: missing config', { hasUrl: !!url, hasToken: !!token });
      return { skipped: true, reason: 'missing_config' };
    }

    const { userAddress, communityId: communityIdRaw, guildId: legacyGuildId, quizId, completedAt } = event || {};
    const communityId = communityIdRaw || legacyGuildId; // backward-compat with guildId
    if (!userAddress || !communityId || !quizId || !completedAt) {
      console.log('[IntuitionPublisher] Skipping: missing required fields', {
        hasUserAddress: !!userAddress,
        hasCommunityId: !!communityId,
        hasQuizId: !!quizId,
        hasCompletedAt: !!completedAt,
      });
      return { skipped: true, reason: 'missing_fields' };
    }

    const idempotencyKey = computeIdempotencyKey(userAddress, communityId, quizId);
    const payload = {
      type: 'quiz_completed',
      userAddress,
      communityId,
      version: '1.0.0',
      metadata: {
        quizId,
        completedAt,
      },
    };

    const headers = {
      'x-api-key': token,
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
      'X-Request-Id': crypto.randomUUID ? crypto.randomUUID() : undefined,
      'X-Agent-Version': getEnv('npm_package_version', 'unknown'),
    };

    // Log the outbound payload (redact token)
    try {
      const safeHeaders = {
        'Idempotency-Key': headers['Idempotency-Key'],
        'X-Request-Id': headers['X-Request-Id'],
        'X-Agent-Version': headers['X-Agent-Version'],
      };
      console.log('[IntuitionPublisher] Sending payload', {
        url,
        headers: safeHeaders,
        payload,
      });
    } catch (_) {}

    await axios.post(url, payload, { headers, validateStatus: () => true })
      .then(res => {
        const info = { status: res.status, data: res.data };
        if (res.status >= 400) {
          console.error('[IntuitionPublisher] Non-2xx response', info);
        } else {
          console.log('[IntuitionPublisher] Consumer response', info);
        }
      })
      .catch(err => {
        if (err.response) {
          console.error('[IntuitionPublisher] Request error with response', {
            status: err.response.status,
            data: err.response.data,
            message: err.message,
          });
        } else {
          console.error('[IntuitionPublisher] Request error', { message: err.message });
        }
      });

    return { ok: true };
  } catch (error) {
    console.error('[IntuitionPublisher] Unexpected error', error);
    return { ok: false, error: error.message };
  }
}

module.exports = { publishQuizCompletion };


