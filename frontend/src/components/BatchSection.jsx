import ParcelCard from './ParcelCard';

export default function BatchSection({ batch, type }) {
  const count = batch.parcels?.length || 0;

  return (
    <div className="mb-8">
      {/* Batch header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="bg-matcha-800 text-white text-sm font-bold px-4 py-1.5 rounded-full">
          Batch #{batch.batch_number}
        </div>
        <div className="text-sm text-gray-500">
          {count} resi
        </div>
        <div className="flex-1 h-px bg-cream-200" />
      </div>

      {count === 0 ? (
        <div className="card text-center py-8 text-gray-400">
          <div className="text-3xl mb-2">📭</div>
          <p className="text-sm">Belum ada resi di batch ini</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {batch.parcels.map(p => (
            <ParcelCard key={p.id} parcel={p} type={type} />
          ))}
        </div>
      )}
    </div>
  );
}
