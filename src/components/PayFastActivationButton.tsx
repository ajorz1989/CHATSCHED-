import { useState } from "react";
import { SUPABASE_URL } from "../lib/supabase";

const PAYFAST_ACTION = "https://payment.payfast.io/eng/process";
const PAYFAST_RECEIVER = "11151803";
const PAYFAST_BUTTON_IMAGE = "https://my.payfast.io/images/buttons/PayNow/Light-Large-PayNow.png";

type ActivationType = "business" | "publisher";

interface Props {
  activationType: ActivationType;
  userId: string;
}

const CONFIG = {
  business: {
    amount: "399",
    itemName: "ChatSched Business Activation",
    itemDescription:
      "Once-off ChatSched Business activation. Unlocks business booking tools, managed campaigns, opportunities, Content Studio free tier and a R199 launch credit. No renewal.",
    customType: "business_activation_paynow",
  },
  publisher: {
    amount: "199",
    itemName: "ChatSched Publisher Network Activation",
    itemDescription:
      "Once-off ChatSched Publisher Network activation. Unlocks opportunities, campaign access, earnings tools, analytics and request approvals. No renewal.",
    customType: "publisher_activation_paynow",
  },
} as const;

export default function PayFastActivationButton({ activationType, userId }: Props) {
  const [paymentId] = useState(
    () =>
      `CHS-${activationType === "business" ? "BIZ" : "PUB"}-${userId.slice(0, 8).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`
  );
  const config = CONFIG[activationType];
  const notifyUrl = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/payfast-notify` : "";

  return (
    <div className="flex flex-col gap-2">
      <form name={`PayFastPayNowForm-${activationType}`} action={PAYFAST_ACTION} method="post">
        <input type="hidden" name="cmd" value="_paynow" />
        <input required type="hidden" name="receiver" pattern="[0-9]+" value={PAYFAST_RECEIVER} />
        <input type="hidden" name="return_url" value="https://chatsched.com/payment/return" />
        <input type="hidden" name="cancel_url" value="https://chatsched.com/payment/cancel" />
        {notifyUrl && <input type="hidden" name="notify_url" value={notifyUrl} />}
        <input type="hidden" name="m_payment_id" value={paymentId} />
        <input required type="hidden" name="amount" value={config.amount} />
        <input required type="hidden" name="item_name" maxLength={255} value={config.itemName} />
        <input type="hidden" name="item_description" maxLength={255} value={config.itemDescription} />

        {/*
          These fields are deliberately only routing hints. The ITN handler
          validates PayFast's signature/validation response and also checks
          the payer email against the supplied ChatSched account before
          auto-activating anything.
        */}
        <input type="hidden" name="custom_str1" value={config.customType} />
        <input type="hidden" name="custom_str2" value={userId} />
        <input type="hidden" name="custom_str3" value="primary_paynow_button" />

        <table>
          <tbody>
            <tr>
              <td colSpan={2} align="center">
                <input
                  type="image"
                  src={PAYFAST_BUTTON_IMAGE}
                  alt="Pay Now"
                  title="Pay Now with Payfast"
                  className="max-w-full h-auto"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </form>
      <p className="text-xs text-billboard-inkSoft">
        Secure PayFast Pay Now checkout. Your activation is matched to this ChatSched account after PayFast confirms payment.
      </p>
    </div>
  );
}
