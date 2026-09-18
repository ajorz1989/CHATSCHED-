import { Link } from "react-router-dom";
import Seo from "../components/Seo";

export default function PaymentResult({ status }: { status: "return" | "cancel" }) {
  return (
    <div className="max-w-md mx-auto px-5 py-24 text-center">
      <Seo title={`Payment ${status === "return" ? "Received" : "Cancelled"} · ChatSched`} noindex />
      {status === "return" ? (
        <>
          <span className="inline-block font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-greenDeep text-billboard-greenDeep px-3 py-1.5 rounded mb-4">Payment received</span>
          <h1 className="text-2xl md:text-3xl mb-3">Thanks — we're confirming it now.</h1>
          <p className="text-billboard-inkSoft mb-8">PayFast is finalising the payment on their end, which usually takes a minute or two. Your dashboard will update automatically once it's confirmed.</p>
        </>
      ) : (
        <>
          <span className="inline-block font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-red text-billboard-red px-3 py-1.5 rounded mb-4">Payment cancelled</span>
          <h1 className="text-2xl md:text-3xl mb-3">No charge was made.</h1>
          <p className="text-billboard-inkSoft mb-8">You can try again any time from your dashboard.</p>
        </>
      )}
      <Link to="/dashboard" className="inline-flex items-center gap-2 border-[3px] border-billboard-ink bg-billboard-ink text-billboard-paper font-bold px-5 py-3 rounded hover:-translate-y-0.5 transition">
        Go to dashboard →
      </Link>
    </div>
  );
}
