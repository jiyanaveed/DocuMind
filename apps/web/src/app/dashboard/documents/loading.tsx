export default function DocumentsLoading() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="h-8 w-32 bg-gray-200 animate-pulse rounded-lg" />
        <div className="h-9 w-36 bg-gray-200 animate-pulse rounded-lg" />
      </div>
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-16 bg-gray-200 animate-pulse rounded-lg" />
        ))}
      </div>
    </div>
  );
}
