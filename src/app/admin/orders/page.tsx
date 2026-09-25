import { prisma } from "@/lib/prisma";
import { formatCents } from "@/lib/utils";
import OrderStatusSelect from "@/components/admin/OrderStatusSelect";

export const dynamic = "force-dynamic";

export default async function AdminOrdersPage() {
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { user: true, items: true },
  });

  return (
    <div>
      <h1 className="mb-6 text-2xl font-extrabold">Orders</h1>
      <div className="card-surface overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-black/5 text-left text-xs uppercase tracking-wide text-black/50">
            <tr>
              <th className="px-4 py-2">Order</th>
              <th className="px-4 py-2">Customer</th>
              <th className="px-4 py-2">Items</th>
              <th className="px-4 py-2">Total</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Placed</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5">
            {orders.map((o) => (
              <tr key={o.id}>
                <td className="px-4 py-3 font-medium">{o.orderNumber}</td>
                <td className="px-4 py-3 text-black/60">{o.user?.name ?? o.guestEmail ?? "Guest"}</td>
                <td className="px-4 py-3 text-black/60">{o.items.length}</td>
                <td className="px-4 py-3 font-semibold">{formatCents(o.totalCents)}</td>
                <td className="px-4 py-3">
                  <OrderStatusSelect orderId={o.id} status={o.status} />
                </td>
                <td className="px-4 py-3 text-black/50">{new Date(o.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
