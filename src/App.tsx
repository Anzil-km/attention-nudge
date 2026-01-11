import { useState, useEffect, useCallback } from 'react'
import { Bell, BellOff, Wifi, WifiOff, Eye, EyeOff, Send } from 'lucide-react'
import './App.css'

function App() {
  const [permission, setPermission] = useState<NotificationPermission>(Notification.permission)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [isVisible, setIsVisible] = useState(!document.hidden)
  const [lastActive, setLastActive] = useState<string>(localStorage.getItem('lastActive') || 'Never')

  // Update activity
  const updateActivity = useCallback(() => {
    const now = new Date().toLocaleTimeString()
    setLastActive(now)
    localStorage.setItem('lastActive', now)
  }, [])

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    const handleVisibilityChange = () => {
      setIsVisible(!document.hidden)
      if (!document.hidden) updateActivity()
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    // Track user interaction
    const handleInteraction = () => updateActivity()
    window.addEventListener('mousedown', handleInteraction)
    window.addEventListener('keydown', handleInteraction)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('mousedown', handleInteraction)
      window.removeEventListener('keydown', handleInteraction)
    }
  }, [updateActivity])

  const [room, setRoom] = useState<string>(window.location.hash.slice(1) || 'default')

  useEffect(() => {
    if (!window.location.hash) {
      const newRoom = Math.random().toString(36).substring(7)
      window.location.hash = newRoom
      setRoom(newRoom)
    }
  }, [])

  const requestPermission = async () => {
    const result = await Notification.requestPermission()
    setPermission(result)
    if (result === 'granted') {
      try {
        const { subscribeUserToPush } = await import('./pushService')
        const subscription = await subscribeUserToPush()

        // Register with server
        await fetch('/.netlify/functions/push/register', {
          method: 'POST',
          body: JSON.stringify({ room, subscription }),
          headers: { 'Content-Type': 'application/json' }
        })

        console.log('Push subscription successful.')
      } catch (err) {
        console.error('Failed to subscribe to push:', err)
      }
    }
  }

  const sendAlert = async () => {
    if (permission !== 'granted') {
      await requestPermission()
      if (Notification.permission !== 'granted') return
    }

    try {
      const response = await fetch('/.netlify/functions/push/nudge', {
        method: 'POST',
        body: JSON.stringify({ room }),
        headers: { 'Content-Type': 'application/json' }
      })

      if (response.ok) {
        updateActivity()
      } else {
        throw new Error('Failed to send nudge')
      }
    } catch (error) {
      console.error('Error sending notification:', error)
      // Fallback for demo
      new Notification('Attention Nudge', {
        body: 'A friendly nudge from the app (locally)!',
        icon: '/vite.svg'
      })
    }
  }

  return (
    <div className="glass-card">
      <div className="status-badge">
        <div className={`status-dot ${isOnline && isVisible ? 'active' : isOnline ? 'away' : 'inactive'}`} />
        <span>{isOnline ? (isVisible ? 'Online & Active' : 'Online (Background)') : 'Offline'}</span>
      </div>

      <h1>Attention Nudge</h1>
      <p className="info-text" style={{ marginBottom: '2rem' }}>
        Invite attention with a single tap. Minimal, private, and respectful.
      </p>

      <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', textAlign: 'left' }}>
        <div className="stat-item" style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '12px' }}>
          <div style={{ color: '#94a3b8', fontSize: '0.8rem', marginBottom: '0.25rem' }}>Connection</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {isOnline ? <Wifi size={16} className="text-green-400" /> : <WifiOff size={16} className="text-slate-500" />}
            {isOnline ? 'Connected' : 'Disconnected'}
          </div>
        </div>
        <div className="stat-item" style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '12px' }}>
          <div style={{ color: '#94a3b8', fontSize: '0.8rem', marginBottom: '0.25rem' }}>Visibility</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {isVisible ? <Eye size={16} className="text-blue-400" /> : <EyeOff size={16} className="text-slate-500" />}
            {isVisible ? 'Active' : 'Background'}
          </div>
        </div>
      </div>

      <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', textAlign: 'left' }}>
        <div style={{ color: '#94a3b8', fontSize: '0.8rem', marginBottom: '0.25rem' }}>Last Active</div>
        <div style={{ fontSize: '1.1rem', fontWeight: '500' }}>{lastActive}</div>
      </div>

      <div className="permission-toggle" onClick={requestPermission}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {permission === 'granted' ? <Bell className="text-indigo-400" /> : <BellOff className="text-slate-500" />}
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontWeight: '600' }}>Notifications</div>
            <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
              {permission === 'granted' ? 'Enabled' : 'Disabled'}
            </div>
          </div>
        </div>
        <div className={`toggle-switch ${permission === 'granted' ? 'on' : ''}`} />
      </div>

      <button
        className="btn-primary"
        onClick={sendAlert}
        disabled={!isOnline}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
          <Send size={20} />
          Send Alert
        </div>
      </button>

      <div style={{ marginTop: '1.5rem', padding: '1rem', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '12px' }}>
        <div style={{ color: '#94a3b8', fontSize: '0.8rem', marginBottom: '0.5rem', textAlign: 'left' }}>Share link to pairing</div>
        <div
          onClick={() => {
            navigator.clipboard.writeText(window.location.href);
            alert('Link copied!');
          }}
          style={{ cursor: 'pointer', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', color: '#6366f1', textAlign: 'left', fontSize: '0.8rem' }}
        >
          {window.location.href}
        </div>
      </div>

      <p className="info-text">
        Notifications work even when the site is closed.
        Only one permission is requested. No tracking.
      </p>
    </div>
  )
}

export default App
