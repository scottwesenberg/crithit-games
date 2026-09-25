import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatCents } from "@/lib/utils";
import { ORDER_STATUS_LABELS } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function AccountOverviewPage() {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const recentOrders = await prisma.order.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 3,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold">Welcome back, {session.user.name?.split(" ")[0]}</h1>
        <p className="text-sm text-black/50">{session.user.email}</p>
      </div>

      <div className="card-surface p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-bold">Recent orders</h2>
          <Link href="/account/orders" className="text-sm text-brand-600 hover:underline">View all</Link>
        </div>
        {recentOrders.length === 0 ? (
          <p className="text-sm text-black/50">No orders yet — go find your next chase card.</p>
        ) : (
          <ul className="divide-y divide-black/5">
            {recentOrders.map((o) => (
              <li key={o.id} className="flex items-center justify-between py-3 text-sm">
                <Link href={`/account/orders/${o.orderNumber}`} className="font-medium text-brand-700 hover:underline">
                  {o.orderNumber}
                </Link>
                <span className="text-black/50">{ORDER_STATUS_LABELS[o.status] ?? o.status}</span>
                <span className="font-semibold">{formatCents(o.totalCents)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
