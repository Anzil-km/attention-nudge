// @ts-ignore
import { Handler } from '@netlify/functions';
// @ts-ignore
import webpush from 'web-push';

const PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

if (PUBLIC_KEY && PRIVATE_KEY) {
    webpush.setVapidDetails('mailto:example@yourdomain.com', PUBLIC_KEY, PRIVATE_KEY);
}

interface UserStatus {
    subscription: any | null;
    lastSeen: number;
    isVisible: boolean;
}

const userStore: Record<string, UserStatus> = {
    admin: { subscription: null, lastSeen: 0, isVisible: false },
    friend: { subscription: null, lastSeen: 0, isVisible: false }
};

export const handler: Handler = async (event: any) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers };

    const path = event.path.split('/').pop();

    if (event.httpMethod === 'POST' && path === 'update-status') {
        const { role, subscription, isVisible } = JSON.parse(event.body || '{}');
        if (role !== 'admin' && role !== 'friend') return { statusCode: 400, body: 'Invalid role', headers };

        userStore[role].lastSeen = Date.now();
        userStore[role].isVisible = isVisible;

        // CRITICAL FIX: Ensure subscription has required fields before storing
        if (subscription && (subscription.endpoint || subscription.keys)) {
            userStore[role].subscription = subscription;
        }

        return { statusCode: 200, body: JSON.stringify({ success: true }), headers };
    }

    if (event.httpMethod === 'GET' && path === 'get-status') {
        const roleToWatch = event.queryStringParameters?.watch;
        if (roleToWatch !== 'admin' && roleToWatch !== 'friend') return { statusCode: 400, body: 'Invalid role', headers };

        const status = userStore[roleToWatch];
        const now = Date.now();
        const isOnline = now - status.lastSeen < 30000;

        return {
            statusCode: 200,
            body: JSON.stringify({
                isOnline,
                isVisible: status.isVisible,
                lastActive: status.lastSeen,
                notificationsOn: !!status.subscription
            }),
            headers
        };
    }

    if (event.httpMethod === 'POST' && path === 'nudge') {
        const { targetRole } = JSON.parse(event.body || '{}');
        const target = userStore[targetRole as 'admin' | 'friend'];

        if (!target || !target.subscription) {
            return { statusCode: 404, body: 'Friend has not enabled notifications', headers };
        }

        try {
            await webpush.sendNotification(target.subscription, JSON.stringify({
                title: 'Attention!',
                body: 'Your friend is nudging you.'
            }));
            return { statusCode: 200, body: JSON.stringify({ message: 'Nudge sent' }), headers };
        } catch (err) {
            console.error('Push error:', err);
            return { statusCode: 500, body: 'Push service error', headers };
        }
    }

    return { statusCode: 404, body: 'Not Found', headers };
};
