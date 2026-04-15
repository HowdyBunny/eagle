import { Component, type ErrorInfo, type ReactNode } from 'react'
import { reportError } from '@/lib/api/errors'

interface Props {
  children: ReactNode
  context?: string   // e.g. "ProjectDetailPage" — helps narrow down the source
}

interface State {
  hasError: boolean
  message: string
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    reportError({
      message: error.message,
      stack: error.stack,
      source: info.componentStack?.trim().split('\n')[1]?.trim(),
      context: `ErrorBoundary${this.props.context ? `: ${this.props.context}` : ''}`,
    })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-3 p-8 text-center">
          <p className="text-sm font-semibold text-on-surface">页面出现错误</p>
          <p className="text-xs text-secondary max-w-sm">{this.state.message}</p>
          <button
            onClick={() => this.setState({ hasError: false, message: '' })}
            className="px-4 py-1.5 rounded-lg border border-outline-variant/20 text-xs text-secondary hover:text-on-surface transition-colors"
          >
            重试
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
