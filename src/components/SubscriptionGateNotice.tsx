import { Link } from "react-router-dom";
import { PREMIUM_ACCESS_PRICE } from "../lib/constants";
import { formatCurrency } from "../lib/currency";

export default function SubscriptionGateNotice(_props: { role?: "business" | "publisher" }) {
  return (
    <div className="border-2 border-billboard-ink rounded p-3 bg-billboard-yellow/20 text-sm mb-4">
      <p className="font-semibold mb-1">
        Premium access ({formatCurrency(PREMIUM_ACCESS_PRICE)}/month) is needed for this.
      </p>
      <Link to="/account#premium" className="underline font-semibold text-xs">
        Get Premium access →
      </Link>
    </div>
  );
}
