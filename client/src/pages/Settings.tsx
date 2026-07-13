import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

const BACKEND_URL = "https://nevolt-backend.onrender.com";

export default function Settings() {
  const [publicKey, setPublicKey] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSaveKeys = async () => {
    if (!publicKey.trim() || !secretKey.trim()) {
      toast({
        title: "❌ Error",
        description: "Both keys are required",
      });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/save-keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stripePublicKey: publicKey,
          stripeSecretKey: secretKey,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to save keys");
      }

      toast({
        title: "✅ Success",
        description: "Stripe keys saved successfully",
      });

      setPublicKey("");
      setSecretKey("");
    } catch (error: any) {
      toast({
        title: "❌ Error",
        description: error.message || "Failed to save keys",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Settings</h1>
        <p className="text-gray-600">Configure your Stripe payment credentials</p>
      </div>

      <div className="border rounded-lg p-6 space-y-4 max-w-md">
        <div>
          <label className="block text-sm font-medium mb-2">Stripe Public Key</label>
          <Input
            type="password"
            placeholder="pk_live_..."
            value={publicKey}
            onChange={(e) => setPublicKey(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Stripe Secret Key</label>
          <Input
            type="password"
            placeholder="sk_live_..."
            value={secretKey}
            onChange={(e) => setSecretKey(e.target.value)}
          />
        </div>

        <Button
          onClick={handleSaveKeys}
          disabled={loading}
          className="w-full"
        >
          {loading ? "Saving..." : "Save Keys"}
        </Button>
      </div>

      <div className="border-t pt-6 space-y-2">
        <h2 className="text-lg font-semibold">How it works</h2>
        <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
          <li>Enter your Stripe public and secret keys</li>
          <li>Keys are stored securely on the server</li>
          <li>When payment mode is configured, customers can pay via Stripe</li>
          <li>If no keys are configured, cash mode is activated</li>
        </ul>
      </div>
    </div>
  );
}
