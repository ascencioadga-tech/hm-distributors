// Netlify Serverless Function — Send Quote Emails via Resend
//
// Uses Resend's batch endpoint (up to 100 emails per request). Sending one
// request per recipient ran past the account's 10-requests-per-second limit
// and Resend refused the overflow, so some customers never got the quote.
const BATCH_SIZE = 100;
const MAX_ATTEMPTS = 4;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function sendBatch(apiKey, emails) {
    for (let attempt = 1; ; attempt++) {
        const res = await fetch('https://api.resend.com/emails/batch', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(emails)
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) return { ok: true, ids: (data.data || []).map(d => d.id) };
        if (res.status === 429 && attempt < MAX_ATTEMPTS) {
            await sleep(1000 * attempt);
            continue;
        }
        return { ok: false, error: data.message || `Send failed (${res.status})` };
    }
}

exports.handler = async (event) => {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                'Access-Control-Allow-Methods': 'POST, OPTIONS'
            },
            body: ''
        };
    }

    // Only allow POST
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    // CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Content-Type': 'application/json'
    };

    try {
        const { recipients, subject, htmlBody } = JSON.parse(event.body);

        if (!recipients || !recipients.length) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'No recipients provided' }) };
        }
        if (!htmlBody) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'No email body provided' }) };
        }

        const RESEND_API_KEY = process.env.RESEND_API_KEY;
        if (!RESEND_API_KEY) {
            return { statusCode: 500, headers, body: JSON.stringify({ error: 'Email service not configured' }) };
        }

        const results = [];
        const errors = [];

        // One invalid address fails a whole Resend batch, so screen them out first
        const seen = new Set();
        const valid = [];
        for (const r of recipients) {
            const email = String(r.email || '').trim();
            const key = email.toLowerCase();
            if (!EMAIL_RE.test(email)) { errors.push({ name: r.name, email, error: 'Invalid email address' }); continue; }
            if (seen.has(key)) continue;
            seen.add(key);
            valid.push({ name: r.name, email });
        }

        for (let i = 0; i < valid.length; i += BATCH_SIZE) {
            const chunk = valid.slice(i, i + BATCH_SIZE);
            const emails = chunk.map(recipient => ({
                from: 'HM Distributors <quotes@hmdistributors.com>',
                reply_to: 'bertm@hmdistinc.com',
                to: [recipient.email],
                subject,
                // Personalized greeting
                html: htmlBody.replace(
                    /Good morning, <strong[^>]*>.*?<\/strong>/,
                    `Good morning, <strong style="color:#073015">${recipient.name}</strong>`
                )
            }));
            const out = await sendBatch(RESEND_API_KEY, emails);
            chunk.forEach((recipient, j) => {
                if (out.ok) results.push({ name: recipient.name, email: recipient.email, id: out.ids[j], status: 'sent' });
                else errors.push({ name: recipient.name, email: recipient.email, error: out.error });
            });
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                sent: results.length,
                failed: errors.length,
                results,
                errors
            })
        };

    } catch (err) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Server error: ' + err.message })
        };
    }
};
