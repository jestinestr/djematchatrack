export default function LoadingSpinner({ text = 'Memuat...', className = '' }) {
  return (
    <div className={`flex flex-col items-center justify-center py-16 gap-4 ${className}`}>
      {/* Bouncy strawberry */}
      <div className="relative flex flex-col items-center">
        <span className="text-5xl select-none animate-berry-bounce inline-block">🍓</span>
        {/* Shadow that shrinks as strawberry goes up */}
        <div className="w-8 h-2 bg-matcha-800/10 rounded-full blur-sm animate-shadow-shrink mt-1" />
      </div>

      {/* Text + bouncing dots */}
      <div className="flex items-center gap-1.5">
        <span className="text-sm font-bold text-matcha-600">{text}</span>
        <span className="flex items-end gap-0.5 pb-0.5">
          <span className="w-1.5 h-1.5 bg-berry-400 rounded-full inline-block animate-dot-wave-1" />
          <span className="w-1.5 h-1.5 bg-berry-400 rounded-full inline-block animate-dot-wave-2" />
          <span className="w-1.5 h-1.5 bg-berry-400 rounded-full inline-block animate-dot-wave-3" />
        </span>
      </div>
    </div>
  );
}
