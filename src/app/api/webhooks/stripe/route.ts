import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { sendOrderConfirmationEmail } from "@/lib/mailer";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: any) {
    return NextResponse.json({ error: `Webhook signature verification failed: ${err.message}` }, { status: 400 });
  }

  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const checkoutSession = event.data.object as Stripe.Checkout.Session;
    const orderId = checkoutSession.metadata?.orderId;

    if (orderId) {
      const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });

      if (order && order.status === "PENDING_PAYMENT") {
        const paymentIntentId =
          typeof checkoutSession.payment_intent === "string"
            ? checkoutSession.payment_intent
            : checkoutSession.payment_intent?.id;

        await prisma.$transaction([
          prisma.order.update({
            where: { id: orderId },
            data: {
              status: "PAID",
              stripePaymentIntentId: paymentIntentId,
              guestEmail: order.userId ? undefined : checkoutSession.customer_details?.email,
              shippingAddressSnapshot: checkoutSession.shipping_details
                ? (checkoutSession.shipping_details as unknown as object)
                : undefined,
              totalCents: checkoutSession.amount_total ?? order.totalCents,
            },
          }),
          ...order.items
            .filter((item) => item.cardVariantId)
            .map((item) =>
              prisma.cardVariant.update({
                where: { id: item.cardVariantId! },
                data: { quantity: { decrement: item.quantity } },
              })
            ),
        ]);

        const email = checkoutSession.customer_details?.email;
        if (email) {
          await sendOrderConfirmationEmail(email, order.orderNumber, checkoutSession.amount_total ?? order.totalCents);
        }
      }
    }
  }

  if (event.type === "checkout.session.expired") {
    const checkoutSession = event.data.object as Stripe.Checkout.Session;
    const orderId = checkoutSession.metadata?.orderId;
    if (orderId) {
      await prisma.order.updateMany({
        where: { id: orderId, status: "PENDING_PAYMENT" },
        data: { status: "CANCELED" },
      });
    }
  }

  return NextResponse.json({ received: true });
}
