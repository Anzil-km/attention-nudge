const PUBLIC_VAPID_KEY = 'BEI_Cnmy5UkJOnT2dMcDstwoHkaKcQEDvhDbo-v9qoIyB_9yTOHu-nuUOdCy7NnBBS8AI0oGYaxNQMtYLQLq9Je4';

function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

export async function subscribeUserToPush() {
    const registration = await navigator.serviceWorker.ready;

    const subscribeOptions = {
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(PUBLIC_VAPID_KEY)
    };

    const subscription = await registration.pushManager.subscribe(subscribeOptions);
    console.log('Received PushSubscription: ', JSON.stringify(subscription));

    // In a real app, send the subscription to the server
    // await fetch('/.netlify/functions/save-subscription', {
    //   method: 'POST',
    //   body: JSON.stringify(subscription),
    //   headers: { 'Content-Type': 'application/json' }
    // });

    return subscription;
}
