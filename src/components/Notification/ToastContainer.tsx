import { useNotificationStore } from '../../stores/notification-store'

function ToastContainer() {
  const toasts = useNotificationStore((s) => s.toasts)
  const dismissToast = useNotificationStore((s) => s.dismissToast)

  if (toasts.length === 0) return null

  return (
    <div className="toast-container" role="status" aria-live="polite">
      {toasts.map((t) => (
        <button
          key={t.id}
          type="button"
          className={`toast toast-${t.type}`}
          onClick={() => dismissToast(t.id)}
        >
          <span className="toast-icon" aria-hidden="true">
            {t.type === 'error' ? '✕' : t.type === 'success' ? '✓' : 'ℹ'}
          </span>
          <span className="toast-message">{t.message}</span>
        </button>
      ))}
    </div>
  )
}

export default ToastContainer
