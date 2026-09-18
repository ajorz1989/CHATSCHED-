import { Link } from "react-router-dom";

export default function SubscriptionGateNotice({ role }: { role: "business" | "publisher" }) {
  return (
    <div className="border-2 border-billboard-ink rounded p-3 bg-billboard-yellow/20 text-sm mb-4">
      <p className="font-semibold mb-1">
        {role === "business"
          ? "An active Business subscription is required to start something new."
          : "An active Publisher Network subscription is required to accept new work."}
      </p>
      <Link to="/account" className="underline font-semibold text-xs">
        Subscribe on your account page →
      </Link>
    </div>
  );
}
