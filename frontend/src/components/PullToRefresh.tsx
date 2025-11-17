import { ReactNode } from 'react'
import { usePullToRefresh } from '../hooks/usePullToRefresh'
import './PullToRefresh.css'

interface PullToRefreshProps {
  onRefresh: () => Promise<void>
  children: ReactNode
}

export function PullToRefresh({ onRefresh, children }: PullToRefreshProps) {
  const { isRefreshing, pullDistance, threshold } = usePullToRefresh({ onRefresh })

  const showIndicator = pullDistance > 0 || isRefreshing
  const opacity = Math.min(pullDistance / threshold, 1)
  const contentOffset = isRefreshing ? threshold : pullDistance

  return (
    <>
      {showIndicator && (
        <div 
          className="pull-to-refresh-indicator" 
          style={{ 
            top: `${contentOffset - 20}px`,
            opacity 
          }}
        >
          <div className={isRefreshing ? 'refresh-spinner spinning' : 'refresh-spinner'} />
        </div>
      )}
      <div style={{ transform: `translateY(${contentOffset}px)`, transition: isRefreshing ? 'none' : 'transform 0.2s ease-out' }}>
        {children}
      </div>
    </>
  )
}
