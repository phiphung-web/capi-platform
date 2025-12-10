"use client";

import { ApiTester } from "@/components/api-tester";
import { useAuth } from "@/contexts/AuthContext";

export default function DevConsolePage() {
  const { token } = useAuth();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Dev Console</h1>
      <ApiTester defaultToken={token} defaultAdminToken={process.env.NEXT_PUBLIC_ADMIN_TOKEN} />
    </div>
  );
}
