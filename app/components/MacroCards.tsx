interface Macro {
  label: string
  emoji: string
  value: number
  target: number
  barColor: string
}

export default function MacroCards({
  protein, carbs, fat,
  proteinTarget, carbTarget, fatTarget,
}: {
  protein: number; carbs: number; fat: number
  proteinTarget: number; carbTarget: number; fatTarget: number
}) {
  const macros: Macro[] = [
    { label: 'Protein', emoji: '🍗', value: protein, target: proteinTarget, barColor: '#FF8A65' },
    { label: 'Carbs',   emoji: '🍚', value: carbs,   target: carbTarget,   barColor: '#9CCF3A' },
    { label: 'Fat',     emoji: '🥑', value: fat,     target: fatTarget,    barColor: '#F5C463' },
  ]

  return (
    <div className="grid grid-cols-3 gap-3">
      {macros.map((m) => {
        const pct = m.target > 0 ? Math.min((m.value / m.target) * 100, 100) : 0
        return (
          <div key={m.label} className="rounded-card bg-white p-3.5 shadow-card">
            <p className="text-lg leading-none">{m.emoji}</p>
            <p className="mt-1.5 text-xs font-medium text-sub">{m.label}</p>
            <p className="tnum text-sm font-bold text-ink">
              {Math.round(m.value)}
              {m.target > 0 && <span className="font-medium text-sub">/{Math.round(m.target)}g</span>}
              {m.target === 0 && <span className="font-medium text-sub">g</span>}
            </p>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-pill bg-bg">
              <div
                className="anim-bar-fill h-full rounded-pill"
                style={{ width: `${pct}%`, backgroundColor: m.barColor }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
