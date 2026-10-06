// Root: owns global state (via useDemoStore) and routes between the three views.
import { Smartphone, Store } from 'lucide-react'
import RestaurantDashboard, { Toast } from './App'
import Auth from './Auth'
import CustomerApp from './Customer'
import { cx } from './format'
import { PitchBar } from './Recovery'
import { PITCH_STEPS, useDemoStore } from './store'

const VIEWS = [
  { id: 'restaurant', label: 'Restaurant', icon: Store },
  { id: 'customer', label: 'Customer', icon: Smartphone },
]

export default function BiteBackApp() {
  const store = useDemoStore()
  const { currentView, setCurrentView, toast, setToast, pitchStep, setPitchStep, goToPitchStep } = store

  return (
    <>
      {currentView === 'auth' && <Auth onLogin={setCurrentView} />}
      {currentView === 'restaurant' && <RestaurantDashboard store={store} />}
      {currentView === 'customer' && <CustomerApp store={store} />}

      {currentView !== 'auth' && (
        // Restaurant: the empty middle of the header. Customer: beside the phone frame.
        <div
          role="group"
          aria-label="Demo view"
          className={cx(
            'glass fixed top-3 z-30 hidden xl:flex rounded-full bg-white/85 p-1 shadow-lg ring-1 ring-zinc-200 backdrop-blur-md',
            currentView === 'restaurant' ? 'left-[calc(50%+8rem)] -translate-x-1/2' : 'right-3',
          )}
        >
          {VIEWS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              aria-pressed={currentView === id}
              onClick={() => setCurrentView(id)}
              className={cx(
                'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition active:scale-95',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50',
                currentView === id ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:text-zinc-900',
              )}
            >
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>
      )}

      <Toast toast={toast} onClose={() => setToast(null)} />
      {pitchStep !== null && (
        <PitchBar steps={PITCH_STEPS} step={pitchStep} onStep={goToPitchStep} onExit={() => setPitchStep(null)} />
      )}
    </>
  )
}
