// This is a helper file for Cart.tsx - Dual Payment Mode Handler

const BACKEND_URL = "https://nevolt-backend.onrender.com";
const POLL_INTERVAL = 2000; // Poll every 2 seconds
const CASH_TIMEOUT = 5 * 60 * 1000; // 5 minutes in milliseconds

export async function initiateDualPayment(
  items: any[],
  totalPrice: number,
  onPaymentStart: () => void,
  onPaymentSuccess: () => void,
  onPaymentError: (error: string) => void,
  onCashPollUpdate?: (timeRemaining: number) => void
) {
  try {
    // Step 1: Check if Stripe keys are configured
    const keysResponse = await fetch(`${BACKEND_URL}/api/get-keys`);
    const keysData = await keysResponse.json();

    onPaymentStart();

    if (keysData.hasKeys && keysData.stripePublicKey) {
      // STRIPE PAYMENT MODE
      console.log("🔵 Initiating Stripe payment...");
      await initiateStripePayment(
        keysData.stripePublicKey,
        items,
        totalPrice,
        onPaymentSuccess,
        onPaymentError
      );
    } else {
      // CASH PAYMENT MODE
      console.log("💰 Initiating Cash payment flow...");
      await initiateCashPayment(
        items,
        totalPrice,
        onPaymentSuccess,
        onPaymentError,
        onCashPollUpdate
      );
    }
  } catch (error: any) {
    onPaymentError(error.message || "Payment initialization failed");
  }
}

async function initiateStripePayment(
  publicKey: string,
  items: any[],
  totalPrice: number,
  onSuccess: () => void,
  onError: (error: string) => void
) {
  try {
    // Load Stripe.js
    const script = document.createElement("script");
    script.src = "https://js.stripe.com/v3/";
    script.onload = async () => {
      // @ts-ignore
      const stripe = window.Stripe(publicKey);

      // Create checkout session
      const response = await fetch(`${BACKEND_URL}/api/create-checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, totalPrice }),
      });

      const session = await response.json();

      // Redirect to Stripe Checkout
      // @ts-ignore
      await stripe.redirectToCheckout({ sessionId: session.id });
      onSuccess();
    };
    document.head.appendChild(script);
  } catch (error: any) {
    onError("Stripe payment failed: " + error.message);
  }
}

async function initiateCashPayment(
  items: any[],
  totalPrice: number,
  onSuccess: () => void,
  onError: (error: string) => void,
  onPollUpdate?: (timeRemaining: number) => void
) {
  try {
    // Step 1: Submit order with status "pending"
    const orderResponse = await fetch(`${BACKEND_URL}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerName: "Walk-in Customer",
        items: items.map((i) => ({ name: i.name, qty: i.quantity, price: i.price })),
        totalPrice: totalPrice,
        status: "pending",
        paymentMethod: "cash",
      }),
    });

    if (!orderResponse.ok) {
      throw new Error("Failed to create order");
    }

    const order = await orderResponse.json();
    const orderId = order.id;

    console.log(`✅ Order created: ${orderId}`);

    // Step 2: Start 5-minute timer
    const startTime = Date.now();
    const timeoutTime = startTime + CASH_TIMEOUT;

    // Step 3: Poll for order status update
    return new Promise((resolve, reject) => {
      const pollInterval = setInterval(async () => {
        try {
          const timeRemaining = timeoutTime - Date.now();

          if (timeRemaining <= 0) {
            clearInterval(pollInterval);
            await fetch(`${BACKEND_URL}/api/orders/${orderId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: "cancelled" }),
            });
            reject(new Error("Payment timeout - Order cancelled"));
            return;
          }

          // Notify about remaining time (in seconds)
          if (onPollUpdate) {
            onPollUpdate(Math.ceil(timeRemaining / 1000));
          }

          // Check order status
          const statusResponse = await fetch(`${BACKEND_URL}/api/orders/${orderId}`);
          const orderData = await statusResponse.json();

          if (orderData.status === "confirmed") {
            clearInterval(pollInterval);
            console.log("✅ Payment confirmed by owner!");
            onSuccess();
            resolve(orderData);
          }
        } catch (error) {
          console.error("Polling error:", error);
        }
      }, POLL_INTERVAL);
    });
  } catch (error: any) {
    onError("Cash payment failed: " + error.message);
  }
}
