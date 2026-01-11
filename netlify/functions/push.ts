import { Handler } from '@netlify/functions';
import webpush from 'web-push';

const PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BEI_Cnmy5UkJOnT2dMcDstwoHkaKcQEDvhDbo-v9qoIyB_9yTOHu-nuUOdCy7NnBBS8AI0oGYaxNQMtYLQLq9Je4';
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'zpUDevBFx7pL81cCVtSX30-LqsYONupCNhKTHVNKhYw';

webpush.setVapidDetails(
    'mailto:example@yourdomain.com',
    PUBLIC_KEY,
    PRIVATE_KEY
);

// Simple in-memory registry (clears on function restart)
const registry: Record<string, any[]> = {};

export const handler: Handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers: { 'Access-Control-Allow-Origin': '*' } };
    }

    const path = event.path.split('/').pop();

    if (event.httpMethod === 'POST' && path === 'register') {
        const { room, subscription } = JSON.parse(event.body || '{}');
        if (!room || !subscription) return { statusCode: 400, body: 'Missing room or subscription' };

        if (!registry[room]) registry[room] = [];
        // Check if already registered
        const exists = registry[room].find(s => s.endpoint === subscription.endpoint);
        if (!exists) registry[room].push(subscription);

        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Registered' }),
            headers: { 'Content-Type': 'application/json' }
        };
    }

    if (event.httpMethod === 'POST' && path === 'nudge') {
        const { room } = JSON.parse(event.body || '{}');
        if (!room || !registry[room]) return { statusCode: 404, body: 'Room not found' };

        const notifications = registry[room].map(sub =>
            webpush.sendNotification(sub, JSON.stringify({
                title: 'Attention Nudge',
                body: 'Someone is inviting your attention!'
            })).catch(err => {
                console.error('Failed to send to', sub.endpoint, err);
                // Remove dead subscription
                registry[room] = registry[room].filter(s => s.endpoint !== sub.endpoint);
            })
        );

        await Promise.all(notifications);

        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Nudges sent' }),
            headers: { 'Content-Type': 'application/json' }
        };
    }

    return { statusCode: 404, body: 'Not Found' };
};
