import { Router } from 'express';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import pool from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

const PLANS = {
  individual: {
    name: 'Individual',
    amount: 2000,
    currency: 'USD',
    displayPrice: '$20/month',
    periodDays: 30,
  },
  teams: {
    name: 'Teams',
    amount: 10000,
    currency: 'USD',
    displayPrice: '$100/month',
    periodDays: 30,
  },
};

function getRazorpay() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    throw new Error('Razorpay credentials not configured');
  }

  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

router.get('/plans', (_req, res) => {
  return res.json({ plans: PLANS });
});

router.post('/create-order', requireAuth, async (req, res) => {
  try {
    const { plan } = req.body;

    if (!PLANS[plan]) {
      return res.status(400).json({ error: 'Invalid plan' });
    }

    const planConfig = PLANS[plan];
    const razorpay = getRazorpay();

    const order = await razorpay.orders.create({
      amount: planConfig.amount,
      currency: planConfig.currency,
      receipt: `rcpt_${req.user.id.slice(0, 8)}_${Date.now()}`,
      notes: {
        user_id: req.user.id,
        user_email: req.user.email,
        plan,
      },
    });

    return res.json({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      plan,
      key_id: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    console.error('Create order error:', err);

    if (err.message === 'Razorpay credentials not configured') {
      return res.status(503).json({ error: 'Payment system not configured yet' });
    }

    return res.status(500).json({ error: 'Failed to create payment order' });
  }
});

router.post('/verify', requireAuth, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !plan) {
      return res.status(400).json({ error: 'Missing payment verification fields' });
    }

    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keySecret) {
      return res.status(503).json({ error: 'Payment system not configured' });
    }

    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto.createHmac('sha256', keySecret).update(body).digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ error: 'Invalid payment signature' });
    }

    const planConfig = PLANS[plan];

    if (!planConfig) {
      return res.status(400).json({ error: 'Invalid plan' });
    }

    const periodStart = new Date();
    const periodEnd = new Date(periodStart.getTime() + planConfig.periodDays * 24 * 60 * 60 * 1000);

    const existingSub = await pool.query(
      "SELECT id FROM subscriptions WHERE user_id = $1 AND status = 'active'",
      [req.user.id],
    );

    let subscriptionId;

    if (existingSub.rows.length > 0) {
      const updated = await pool.query(
        `UPDATE subscriptions SET plan = $1, status = 'active', current_period_start = $2,
         current_period_end = $3, razorpay_order_id = $4, razorpay_payment_id = $5, updated_at = NOW()
         WHERE id = $6 RETURNING id`,
        [plan, periodStart, periodEnd, razorpay_order_id, razorpay_payment_id, existingSub.rows[0].id],
      );
      subscriptionId = updated.rows[0].id;
    } else {
      const created = await pool.query(
        `INSERT INTO subscriptions (user_id, plan, status, current_period_start, current_period_end,
         razorpay_order_id, razorpay_payment_id)
         VALUES ($1, $2, 'active', $3, $4, $5, $6) RETURNING id`,
        [req.user.id, plan, periodStart, periodEnd, razorpay_order_id, razorpay_payment_id],
      );
      subscriptionId = created.rows[0].id;
    }

    const invoiceNumResult = await pool.query("SELECT nextval('invoice_number_seq') AS num");
    const invoiceNumber = `INV-${String(invoiceNumResult.rows[0].num).padStart(6, '0')}`;

    const invoice = await pool.query(
      `INSERT INTO invoices (user_id, subscription_id, invoice_number, plan, amount, currency,
       status, razorpay_order_id, razorpay_payment_id, paid_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'paid', $7, $8, NOW()) RETURNING *`,
      [
        req.user.id,
        subscriptionId,
        invoiceNumber,
        plan,
        planConfig.amount,
        planConfig.currency,
        razorpay_order_id,
        razorpay_payment_id,
      ],
    );

    return res.json({
      success: true,
      invoice: invoice.rows[0],
      subscription_id: subscriptionId,
    });
  } catch (err) {
    console.error('Verify payment error:', err);
    return res.status(500).json({ error: 'Failed to verify payment' });
  }
});

router.get('/subscription', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM subscriptions WHERE user_id = $1 AND status = 'active' ORDER BY created_at DESC LIMIT 1",
      [req.user.id],
    );
    return res.json({ subscription: result.rows[0] || null });
  } catch (err) {
    console.error('Get subscription error:', err);
    return res.status(500).json({ error: 'Failed to fetch subscription' });
  }
});

router.get('/invoices', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM invoices WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id],
    );
    return res.json({ invoices: result.rows });
  } catch (err) {
    console.error('Get invoices error:', err);
    return res.status(500).json({ error: 'Failed to fetch invoices' });
  }
});

export default router;
