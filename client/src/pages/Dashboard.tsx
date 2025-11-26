import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import OrderCard from "@/components/OrderCard";
import RevenueCard from "@/components/RevenueCard";
import EmptyState from "@/components/EmptyState";
import { useSound } from "@/hooks/use-sound";
import { useWebSocket } from "@/hooks/use-websocket";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import type { Order } from "@shared/schema";
import { Button } from "@/components/ui/button";

const BACKEND_URL = "https://nevolt-backend.onrender.com";
const RESTAURANT_ID = "res-1";

const DASHBOARD_PASSWORD = "nevolt123";

export default function Dashboard() {
  // AUTH STATE
  const [auth, setAuth] = useState(() => {
    return localStorage.getItem("auth_pass") === "true";
  });
  const [password, setPassword] = useState("");

  // If NOT authenticated → show login
  if (!auth) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-screen">
        <h1 className="text-2xl font-bold mb-4">Dashboard Login</h1>

        <input
          className="border p-2 rounded mb-4 w-64"
          type="password"
          placeholder="Enter Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <Button
          onClick={() => {
            if (password === DASHBOARD_PASSWORD) {
              localStorage.setItem("auth_pass", "true");
              setAuth(true);
            } else {
              alert("Incorrect password");
            }
          }}
        >
          Login
        </Button>
      </div>
    );
  }

  // =======================
  // DASHBOARD ORIGINAL CODE
  // =======================
  const { playNotificationSound } = useSound();
  const { toast } = useToast();

  const [newOrderIds, setNewOrderIds] = useState<Set<string>>(new Set());
  const [lastResetOrderId, setLastResetOrderId] = useState<number>(() =>
    parseInt(localStorage.getItem("last_reset_order_id") || "0")
  );

  const { data: orders = [], isLoading } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
    queryFn: async () => {
      const res = await fetch(`${BACKEND_URL}/api/orders?restaurant_id=${RESTAURANT_ID}`);
      if (!res.ok) throw new Error("Failed to fetch orders");
      const data = await res.json();

      return data.map((order: any) => ({
        ...order,
        items:
          typeof order.items === "string"
            ? JSON.parse(order.items || "[]")
            : Array.isArray(order.items)
            ? order.items
            : [],
      }));
    },
    refetchInterval: 10000,
  });

  const completeOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const res = await fetch(`${BACKEND_URL}/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" }),
      });
      if (!res.ok) throw new Error("Failed to update order");
      return res.json();
    },
    onSuccess: (updatedOrder) => {
      queryClient.setQueryData<Order[]>(["/api/orders"], (oldOrders = []) =>
        oldOrders.map((o) => (o.id === updatedOrder.id ? updatedOrder : o))
      );
      toast({
        title: "✅ Order Completed",
        description: `Order #${updatedOrder.id} marked as completed.`,
      });
    },
  });

  const handleNewOrder = useCallback(
    (order: Order) => {
      queryClient.setQueryData<Order[]>(["/api/orders"], (oldOrders = []) => {
        const exists = oldOrders.find((o) => o.id === order.id);
        if (exists) return oldOrders;
        return [order, ...oldOrders];
      });
      setNewOrderIds((prev) => new Set(prev).add(order.id));
      playNotificationSound();
      toast({
        title: "🔔 New Order Received!",
        description: `Order #${order.id} from table ${order.table_no}`,
      });
    },
    [playNotificationSound, toast]
  );

  useWebSocket({
    url: BACKEND_URL.replace("http", "ws"),
    onMessage: (data) => {
      if (data.type === "new_order") handleNewOrder(data.order);
    },
  });

  useEffect(() => {
    if (newOrderIds.size > 0) {
      const timer = setTimeout(() => setNewOrderIds(new Set()), 5000);
      return () => clearTimeout(timer);
    }
  }, [newOrderIds]);

  if (isLoading) return <div className="p-4 text-center">Loading orders...</div>;

  const filteredOrders = orders.filter((o) => o.id > lastResetOrderId);
  const pendingOrders = filteredOrders.filter((o) => o.status === "pending");
  const completedOrders = filteredOrders.filter((o) => o.status === "completed");

  const totalRevenue = completedOrders.reduce((sum, o) => {
    const v = typeof o.total === "string" ? parseFloat(o.total) : o.total || 0;
    return sum + (isNaN(v) ? 0 : v);
  }, 0);

  const handleReset = () => {
    if (confirm("Do you want to reset the dashboard?")) {
      const latestId = Math.max(...orders.map((o) => o.id), 0);
      localStorage.setItem("last_reset_order_id", latestId.toString());
      setLastResetOrderId(latestId);
      toast({ title: "Dashboard Reset Done" });
    }
  };

  return (
    <div className="p-4 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Button variant="destructive" onClick={handleReset}>
          Reset
        </Button>
      </div>

      <RevenueCard
        todayRevenue={totalRevenue.toFixed(2)}
        completedOrders={completedOrders.length}
        averageOrderValue={
          completedOrders.length > 0
            ? (totalRevenue / completedOrders.length).toFixed(2)
            : "0.00"
        }
      />

      <div>
        <h2 className="text-xl font-semibold mb-4">Active Orders</h2>
        {pendingOrders.length === 0 ? (
          <EmptyState message="No active orders at the moment." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pendingOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                isNew={newOrderIds.has(order.id)}
                onComplete={() => completeOrderMutation.mutate(order.id)}
              />
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-2">Completed Orders</h2>
        {completedOrders.length === 0 ? (
          <EmptyState message="No completed orders yet." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {completedOrders.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
                     }
