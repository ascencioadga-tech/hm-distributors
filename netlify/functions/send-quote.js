// Netlify Serverless Function — Send Quote Emails via Resend
exports.handler = async (event) => {
    // Only allow POST
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    // CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
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

        // Send to each recipient individually (personalized greeting)
        for (const recipient of recipients) {
            try {
                // Replace the greeting with personalized name
                const personalizedHtml = htmlBody.replace(
                    /Good morning, <strong[^>]*>.*?<\/strong>/,
                    `Good morning, <strong style="color:#073015">${recipient.name}</strong>`
                );

                const res = await fetch('https://api.resend.com/emails', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${RESEND_API_KEY}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        from: 'HM Distributors <quotes@hmdistributors.com>',
                        reply_to: 'renem@hmdistinc.com',
                        to: [recipient.email],
                        subject: subject,
                        html: personalizedHtml
                    })
                });

                const data = await res.json();

                if (res.ok) {
                    results.push({ name: recipient.name, email: recipient.email, id: data.id, status: 'sent' });
                } else {
                    errors.push({ name: recipient.name, email: recipient.email, error: data.message || 'Send failed' });
                }
            } catch (err) {
                errors.push({ name: recipient.name, email: recipient.email, error: err.message });
            }
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
