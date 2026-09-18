export default function SetupNotice() {
  return (
    <div className="max-w-2xl mx-auto px-5 py-24 text-center">
      <span className="inline-block font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-red text-billboard-red px-3 py-1.5 rounded mb-4">Setup needed</span>
      <h1 className="text-2xl md:text-3xl mb-3">This page needs the database connected.</h1>
      <p className="text-billboard-inkSoft">
        Copy <code className="font-mono bg-billboard-paperDim px-1.5 py-0.5 rounded">.env.example</code> to{" "}
        <code className="font-mono bg-billboard-paperDim px-1.5 py-0.5 rounded">.env</code>, add your Supabase project URL and anon key,
        then restart the dev server. See the README for the full setup steps.
      </p>
    </div>
  );
}
