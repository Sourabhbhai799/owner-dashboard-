"use client";

import { useState, useEffect } from "react";
import Dashboard from "./Dashboard"; // your original working dashboard component

const PASSWORD = "nevolt123";

export default function DashboardWrapper() {
  const [auth, setAuth] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [pass, setPass] = useState("");

  useEffect(() => {
    setAuth(localStorage.getItem("dashboard_auth") === "true");
    setLoaded(true);
  }, []);

  if (!loaded) return null;

  if (!auth) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-screen">
        <h1 className="text-2xl font-bold mb-4">Dashboard Login</h1>

        <input
          type="password"
          placeholder="Enter Password"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          className="border p-2 rounded mb-4 w-64"
        />

        <button
          onClick={() => {
            if (pass === PASSWORD) {
              localStorage.setItem("dashboard_auth", "true");
              setAuth(true);
            } else {
              alert("Incorrect password");
            }
          }}
          className="bg-black text-white px-4 py-2 rounded"
        >
          Login
        </button>
      </div>
    );
  }

  return <Dashboard />;
}
