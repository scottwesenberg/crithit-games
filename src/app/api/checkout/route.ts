import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type Stripe from "stripe";
import type { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { checkoutSchema } from "@/lib/validations";
import { conditionLabel } from "@/lib/constants";
import { generateOrderNumber } from "@/lib/utils";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Your cart looks invalid — please refresh and try again." }, { status: 400 });
  }

  const session = await getServerSession(authOptions);

  const variantIds = parsed.data.items.map((i) => i.variantId);
  const variants = await prisma.cardVariant.findMany({
    where: { id: { in: variantIds } },
    include: { card: { include: { set: true } } },
  });

  if (variants.length !== new Set(variantIds).size) {
    return NextResponse.json({ error: "Some items in your cart are no longer available." }, { status: 400 });
  }

  let subtotalCents = 0;
  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];
  const orderItemsData: Prisma.OrderItemCreateManyOrderInput[] = [];

  for (const reqItem of parsed.data.items) {
    const variant = variants.find((v) => v.id === reqItem.variantId)!;
    if (variant.quantity < reqItem.quantity) {
      return NextResponse.json(
        { error: `Only ${variant.quantity} left of ${variant.card.name} (${variant.finish}).` },
        { status: 400 }
      );
    }

    subtotalCents += variant.priceCents * reqItem.quantity;

    lineItems.push({
      quantity: reqItem.quantity,
      price_data: {
        currency: "usd",
        unit_amount: variant.priceCents,
        product_data: {
          name: `${variant.card.name} — ${variant.finish}, ${conditionLabel(variant.condition)}`,
          metadata: { variantId: variant.id },
        },
      },
    });

    orderItemsData.push({
      cardVariantId: variant.id,
      cardName: variant.card.name,
      setName: variant.card.set.name,
      finish: variant.finish,
      condition: variant.condition,
      unitPriceCents: variant.priceCents,
      quantity: reqItem.quantity,
    });
  }

  const order = await prisma.order.create({
    data: {
      orderNumber: generateOrderNumber(),
      userId: session?.user?.id,
      subtotalCents,
      totalCents: subtotalCents,
      items: { createMany: { data: orderItemsData } },
    },
  });

  const appUrl = process.env.APP_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000";

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: lineItems,
    success_url: `${appUrl}/checkout/success?order=${order.orderNumber}`,
    cancel_url: `${appUrl}/checkout/cancel`,
    shipping_address_collection: { allowed_countries: ["US", "CA"] },
    customer_email: session?.user?.email ?? undefined,
    metadata: { orderId: order.id },
  });

  await prisma.order.update({
    where: { id: order.id },
    data: { stripeCheckoutSessionId: checkoutSession.id },
  });

  return NextResponse.json({ url: checkoutSession.url });
}
