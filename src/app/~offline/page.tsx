export default function OfflinePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="text-center">
        <div className="text-5xl mb-4">📡</div>
        <h1 className="text-2xl font-bold mb-2">オフラインです</h1>
        <p className="text-muted text-sm">
          インターネット接続が復旧したら自動的に再読み込みされます
        </p>
      </div>
    </main>
  )
}
