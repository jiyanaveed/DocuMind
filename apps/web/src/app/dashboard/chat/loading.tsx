export default function ChatLoading() {
  return (
    <div className="-m-6 flex overflow-hidden" style={{ height: 'calc(100vh - 49px)' }}>
      <div className="w-60 flex-shrink-0 border-r border-gray-200 bg-gray-50 animate-pulse" />
      <div className="flex-1 flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-3 text-gray-400">
          <div className="h-4 w-4 rounded-full border-2 border-gray-300 border-t-blue-500 animate-spin" />
          <span className="text-sm">Loading chat…</span>
        </div>
      </div>
    </div>
  );
}
