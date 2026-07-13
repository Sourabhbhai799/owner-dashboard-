import { storage } from "./storage";

// In-memory store for settings (replace with database in production)
interface Settings {
  stripePublicKey: string;
  stripeSecretKey: string;
  lastUpdated: Date;
}

let appSettings: Settings | null = null;

export async function saveStripeKeys(publicKey: string, secretKey: string) {
  appSettings = {
    stripePublicKey: publicKey,
    stripeSecretKey: secretKey,
    lastUpdated: new Date(),
  };
  console.log("✅ Stripe keys saved");
  return appSettings;
}

export async function getStripeKeys() {
  return appSettings;
}

export async function updateOrderStatusToCash(orderId: string) {
  const order = await storage.updateOrderStatus(orderId, "confirmed");
  if (!order) {
    throw new Error("Order not found");
  }
  return order;
}
