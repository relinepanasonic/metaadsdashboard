export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="max-w-2xl w-full text-center">
        <div className="mb-6">
          <span className="inline-block bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider mb-4">
            Prof Toko Online
          </span>
          <h1 className="text-4xl font-black text-white mb-3">
            Meta Ads Dashboard
          </h1>
          <p className="text-gray-400 text-lg">
            Campaign performance, leads tracking & creative analytics
          </p>
        </div>

        <div className="grid grid-cols-3 gap-4 mt-10">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="text-2xl font-black text-blue-400">—</div>
            <div className="text-xs text-gray-500 mt-1">Total Leads</div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="text-2xl font-black text-green-400">—</div>
            <div className="text-xs text-gray-500 mt-1">Cost per Lead</div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="text-2xl font-black text-yellow-400">—</div>
            <div className="text-xs text-gray-500 mt-1">Active Campaigns</div>
          </div>
        </div>

        <p className="text-gray-600 text-sm mt-10">
          Connected to Supabase · Deployed on Vercel
        </p>
      </div>
    </main>
  );
}
