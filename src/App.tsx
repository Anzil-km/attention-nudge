import { useState, useEffect, useCallback, useRef } from 'react'
import { Bell, BellOff, Send, User } from 'lucide-react'
import './App.css'

// Standard Role detection
const getRole = () => {
  const params = new URLSearchParams(window.location.search);
  return params.get('role') === 'friend' ? 'friend' : 'admin';
};

function App() {
  const role = getRole();
  const targetRole = role === 'admin' ? 'friend' : 'admin';

  const [permission, setPermission] = useState<NotificationPermission>(Notification.permission)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [friendStatus, setFriendStatus] = useState({
    isOnline: false,
    isVisible: false,
    lastActive: 0,
    notificationsOn: false
  });

  const subscriptionRef = useRef<any>(null);

  // Heartbeat to server
  const sendHeartbeat = useCallback(async () => {
    try {
      await fetch('/.netlify/functions/push/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role,
          isVisible: !document.hidden,
          subscription: subscriptionRef.current
        })
      });
    } catch (e) {
      console.error('Heartbeat failed', e);
    }
  }, [role]);

  // Poll for friend status
  const fetchFriendStatus = useCallback(async () => {
    try {
      const resp = await fetch(`/.netlify/functions/push/get-status?watch=${targetRole}`);
      if (resp.ok) {
        const data = await resp.json();
        setFriendStatus(data);
      }
    } catch (e) {
      console.error('Status fetch failed', e);
    }
  }, [targetRole]);

  // 0. Recover existing subscription and start loops
  useEffect(() => {
    async function initSubscription() {
      if (Notification.permission === 'granted') {
        try {
          const registration = await navigator.serviceWorker.ready;
          const sub = await registration.pushManager.getSubscription();
          if (sub) {
            subscriptionRef.current = sub.toJSON(); // Convert to JSON
            sendHeartbeat();
          }
        } catch (e) {
          console.error('Subscription recovery failed', e);
        }
      }
    }
    initSubscription();

    const hInterval = setInterval(sendHeartbeat, 15000);
    const sInterval = setInterval(fetchFriendStatus, 5000);

    const handleVisibility = () => sendHeartbeat();
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('online', () => setIsOnline(true));
    window.addEventListener('offline', () => setIsOnline(false));

    return () => {
      clearInterval(hInterval);
      clearInterval(sInterval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [sendHeartbeat, fetchFriendStatus]);

  const toggleNotifications = async () => {
    if (permission === 'granted' && subscriptionRef.current) {
      // Try to unsubscribe
      try {
        const { unsubscribeUserFromPush } = await import('./pushService')
        await unsubscribeUserFromPush()
        subscriptionRef.current = null
        sendHeartbeat() // Notify server we're off
        setPermission(Notification.permission)
      } catch (err) {
        console.error('Unsubscribe error', err)
      }
    } else {
      // Subscribe
      const result = await Notification.requestPermission()
      setPermission(result)
      if (result === 'granted') {
        try {
          const { subscribeUserToPush } = await import('./pushService')
          const sub = await subscribeUserToPush()
          subscriptionRef.current = sub
          sendHeartbeat()
        } catch (err) {
          console.error('Push registration error', err)
        }
      } else if (result === 'denied') {
        alert('Notifications are blocked by your browser. Please reset permissions in your browser settings to enable.')
      }
    }
  }

  const sendNudge = async () => {
    try {
      const response = await fetch('/.netlify/functions/push/nudge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetRole })
      });
      if (!response.ok) alert('Push failed. Make sure your keys are in Netlify settings.');
    } catch (e) {
      alert('Network error.');
    }
  };

  if (role === 'friend') {
    return (
      <div className="glass-card friend-interface">
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
          <div className="status-badge" style={{ margin: 0 }}>
            <div className={`status-dot ${isOnline ? 'active' : 'inactive'}`} />
            <span> {isOnline ? 'Connected' : 'Offline'}</span>
          </div>
        </div>

        <h1>Connect with Friend</h1>
        <p className="info-text" style={{ fontSize: '1.1rem', color: '#fff', marginBottom: '2rem' }}>
          Allow notifications to receive gentle nudges when your friend wants your attention.
          You don't need to keep this site open once allowed.
        </p>

        <div className="permission-toggle" onClick={toggleNotifications} style={{ background: subscriptionRef.current ? 'rgba(99, 102, 241, 0.1)' : 'rgba(255,255,255,0.03)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {subscriptionRef.current ? <Bell className="text-indigo-400" /> : <BellOff className="text-slate-500" />}
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontWeight: '600' }}>Notifications</div>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                {subscriptionRef.current ? 'Enabled (Ready)' : 'Tap to Enable'}
              </div>
            </div>
          </div>
          <div className={`toggle-switch ${subscriptionRef.current ? 'on' : ''}`} />
        </div>

        <p className="info-text" style={{ marginTop: '2rem' }}>
          This app respects your privacy. No tracking. Just attention.
        </p>
      </div>
    );
  }

  return (
    <div className="glass-card admin-interface">
      <div className="status-badge">
        <User size={14} style={{ color: '#6366f1' }} />
        <span style={{ fontWeight: 600 }}>My Dashboard</span>
      </div>

      <h1>Attention Nudge</h1>

      <div className="friend-card" style={{ marginTop: '2rem', background: 'rgba(255,255,255,0.03)', borderRadius: '20px', padding: '1.5rem', border: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div style={{ textAlign: 'left' }}>
            <div style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Friend's Status</div>
            <div style={{ fontSize: '1.2rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {friendStatus.isOnline ? 'Online' : 'Offline'}
              <div className={`status-dot ${friendStatus.isOnline ? (friendStatus.isVisible ? 'active' : 'away') : 'inactive'}`} />
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Notifications</div>
            <div style={{ fontWeight: '600', color: friendStatus.notificationsOn ? '#22c55e' : '#64748b' }}>
              {friendStatus.notificationsOn ? 'Active' : 'Off'}
            </div>
          </div>
        </div>

        <div style={{ textAlign: 'left', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '12px' }}>
          <div style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Last Activity</div>
          <div style={{ fontSize: '0.9rem' }}>
            {friendStatus.lastActive ? new Date(friendStatus.lastActive).toLocaleTimeString() : 'Unknown'}
          </div>
        </div>
      </div>

      <button
        className="btn-primary"
        onClick={sendNudge}
        disabled={!friendStatus.notificationsOn}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
          <Send size={20} />
          Send Alert
        </div>
      </button>

      {!friendStatus.notificationsOn && (
        <p className="info-text" style={{ color: '#f87171' }}>
          Friend needs to allow notifications first.
        </p>
      )}

      <div style={{ marginTop: '2rem', padding: '1rem', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '12px' }}>
        <div style={{ color: '#94a3b8', fontSize: '0.8rem', marginBottom: '0.5rem' }}>Invite your partner</div>
        <div
          onClick={() => {
            const url = new URL(window.location.href);
            url.searchParams.set('role', 'friend');
            navigator.clipboard.writeText(url.toString());
            alert('Link copied!');
          }}
          style={{ cursor: 'pointer', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', color: '#6366f1', fontSize: '0.8rem' }}
        >
          {window.location.origin}/?role=friend
        </div>
      </div>
    </div>
  );
}

export default App
