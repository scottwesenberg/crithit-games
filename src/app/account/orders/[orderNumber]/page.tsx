import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatCents } from "@/lib/utils";
import { conditionLabel, ORDER_STATUS_LABELS } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function OrderDetailPage({ params }: { params: { orderNumber: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const order = await prisma.order.findFirst({
    where: { orderNumber: params.orderNumber, userId: session.user.id },
    include: { items: true },
  });

  if (!order) notFound();

  const shipping = order.shippingAddressSnapshot as {
    name?: string;
    address?: { line1?: string; line2?: string; city?: string; state?: string; postal_code?: string; country?: string };
  } | null;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">{order.orderNumber}</h1>
        <span className="badge bg-brand-100 text-brand-700">{ORDER_STATUS_LABELS[order.status] ?? order.status}</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div className="card-surface divide-y divide-black/5">
          {order.items.map((item) => (
            <div key={item.id} className="flex items-center justify-between p-4 text-sm">
              <div>
                <p className="font-medium">{item.cardName}</p>
                <p className="text-xs text-black/50">
                  {item.setName} · {item.finish} · {conditionLabel(item.condition)} · Qty {item.quantity}
                </p>
              </div>
              <p className="font-semibold">{formatCents(item.unitPriceCents * item.quantity)}</p>
            </div>
          ))}
        </div>

        <div className="space-y-4">
          <div className="card-surface p-4 text-sm">
            <h2 className="mb-2 font-bold">Total</h2>
            <div className="flex justify-between"><span>Subtotal</span><span>{formatCents(order.subtotalCents)}</span></div>
            <div className="flex justify-between"><span>Shipping</span><span>{formatCents(order.shippingCents)}</span></div>
            <div className="flex justify-between"><span>Tax</span><span>{formatCents(order.taxCents)}</span></div>
            <div className="mt-2 flex justify-between border-t border-black/10 pt-2 font-bold">
              <span>Total</span><span>{formatCents(order.totalCents)}</span>
            </div>
          </div>

          {shipping?.address && (
            <div className="card-surface p-4 text-sm">
              <h2 className="mb-2 font-bold">Shipping to</h2>
              <p>{shipping.name}</p>
              <p>{shipping.address.line1}</p>
              {shipping.address.line2 && <p>{shipping.address.line2}</p>}
              <p>
                {shipping.address.city}, {shipping.address.state} {shipping.address.postal_code}
              </p>
              <p>{shipping.address.country}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
