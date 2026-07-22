const GRADIENTS = {
  blue: 'from-emerald-500 to-green-600',
  darkblue: 'from-green-600 to-teal-700',
  orange: 'from-amber-400 to-yellow-500',
  red: 'from-rose-500 to-red-600'
};

export default function StatCard({ title, value, badge, note, linkLabel, color }) {
  return (
    <div className={`rounded-xl p-4 text-white bg-gradient-to-br ${GRADIENTS[color]} shadow`}>
      <div className="flex items-center justify-between">
        <span className="text-sm opacity-90">{title}</span>
        {badge && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/25">{badge}</span>
        )}
      </div>
      <div className="text-3xl font-bold mt-2">{value}</div>
      <div className="text-xs opacity-90 mt-1">{note}</div>
      {linkLabel && <div className="text-xs mt-2 underline underline-offset-2 opacity-90">{linkLabel}</div>}
    </div>
  );
}
