import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatCents } from "@/lib/utils";
import { ORDER_STATUS_LABELS } from "@/lib/constants";

export const dynamic = "force-dynamic";
export const metadata = { title: "Order history" };

export default async function OrderHistoryPage() {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const orders = await prisma.order.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: { items: true },
  });

  return (
    <div>
      <h1 className="mb-6 text-2xl font-extrabold">Order history</h1>
      {orders.length === 0 ? (
        <div className="card-surface p-10 text-center text-black/50">You haven't placed any orders yet.</div>
      ) : (
        <div className="card-surface divide-y divide-black/5">
          {orders.map((o) => (
            <Link
              key={o.id}
              href={`/account/orders/${o.orderNumber}`}
              className="flex flex-col gap-1 p-4 hover:bg-black/[0.02] sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-semibold">{o.orderNumber}</p>
                <p className="text-xs text-black/50">
                  {o.items.length} item{o.items.length === 1 ? "" : "s"} ·{" "}
                  {new Date(o.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <span className="badge bg-brand-100 text-brand-700">
                  {ORDER_STATUS_LABELS[o.status] ?? o.status}
                </span>
                <span className="font-semibold">{formatCents(o.totalCents)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
