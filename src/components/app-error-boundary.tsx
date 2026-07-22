import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Admin application render failure', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <main className="fatal-error">
        <span><AlertTriangle /></span>
        <h1>We couldn’t display this page</h1>
        <p>The error has been contained. Reload the workspace to try again.</p>
        <button onClick={() => window.location.reload()}>Reload application</button>
      </main>
    )
  }
}
