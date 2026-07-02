// Reusable Skeleton Loader Components
export function SkeletonLine({ width = '100%', height = '1rem', style = {} }) {
    return (
        <div
            className="skeleton"
            style={{ width, height, borderRadius: '6px', ...style }}
        />
    )
}

export function SkeletonCard({ height = 100, style = {} }) {
    return (
        <div
            className="skeleton"
            style={{ height, borderRadius: '12px', ...style }}
        />
    )
}

export function SkeletonStatCard() {
    return (
        <div className="stat-card" style={{ pointerEvents: 'none' }}>
            <SkeletonLine width="32px" height="32px" style={{ borderRadius: '8px', marginBottom: '16px' }} />
            <SkeletonLine width="60%" height="2rem" style={{ marginBottom: '8px' }} />
            <SkeletonLine width="80%" height="0.75rem" />
        </div>
    )
}

export function SkeletonTableRow({ cols = 6 }) {
    return (
        <tr>
            {Array.from({ length: cols }).map((_, i) => (
                <td key={i}>
                    <SkeletonLine
                        width={i === 0 ? '20px' : i === 1 ? '80%' : `${40 + Math.random() * 40}%`}
                        height="0.85rem"
                    />
                </td>
            ))}
        </tr>
    )
}

export function SkeletonTable({ rows = 6, cols = 6 }) {
    return (
        <div className="table-wrapper">
            <table>
                <thead>
                    <tr>
                        {Array.from({ length: cols }).map((_, i) => (
                            <th key={i}><SkeletonLine width={`${50 + i * 10}%`} height="0.65rem" /></th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {Array.from({ length: rows }).map((_, i) => (
                        <SkeletonTableRow key={i} cols={cols} />
                    ))}
                </tbody>
            </table>
        </div>
    )
}
