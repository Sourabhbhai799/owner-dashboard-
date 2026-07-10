const express = require('express');
const stripe = require('stripe');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// ============================================
// DATABASE HELPER FUNCTIONS
// ============================================

/**
 * Fetch Stripe keys for a specific branch from your database
 * Adjust this based on your database system (Google Sheets, MongoDB, SQL, etc.)
 */
async function getStripeKeysForBranch(branchId) {
  try {
    // Example: Using Google Sheets API
    // Replace this with your actual database query
    
    // For Google Sheets:
    // const sheets = google.sheets({ version: 'v4', auth: authClient });
    // const response = await sheets.spreadsheets.values.get({
    //   spreadsheetId: process.env.GOOGLE_SHEET_ID,
    //   range: 'RestaurantStripeKeys!A:H',
    // });
    // const rows = response.data.values;
    // const keyRow = rows.find(row => row[1] === branchId); // column B is branch_id
    // if (keyRow) {
    //   return {
    //     publishableKey: keyRow[3], // column D
    //     secretKey: keyRow[4],      // column E
    //     branchName: keyRow[2],     // column C
    //     isActive: keyRow[7] === 'TRUE' // column H
    //   };
    // }

    // For MongoDB:
    // const Restaurant = require('./models/Restaurant');
    // const branchKeys = await Restaurant.findOne({ 'branches._id': branchId }, { 'branches.$': 1 });
    // if (branchKeys && branchKeys.branches[0]) {
    //   return {
    //     publishableKey: branchKeys.branches[0].stripe_publishable_key,
    //     secretKey: branchKeys.branches[0].stripe_secret_key,
    //     branchName: branchKeys.branches[0].name,
    //     isActive: branchKeys.branches[0].is_active
    //   };
    // }

    // For SQL (using your preferred ORM like Sequelize or Knex):
    // const keys = await db.query(
    //   'SELECT stripe_publishable_key, stripe_secret_key, branch_name, is_active FROM restaurant_stripe_keys WHERE branch_id = ?',
    //   [branchId]
    // );
    // if (keys.length > 0) {
    //   return {
    //     publishableKey: keys[0].stripe_publishable_key,
    //     secretKey: keys[0].stripe_secret_key,
    //     branchName: keys[0].branch_name,
    //     isActive: keys[0].is_active
    //   };
    // }

    throw new Error(`No Stripe keys found for branch: ${branchId}`);
  } catch (error) {
    console.error('Error fetching Stripe keys:', error);
    throw error;
  }
}

/**
 * Validate that the branch belongs to the authenticated user/restaurant
 */
async function validateBranchOwnership(restaurantId, branchId) {
  try {
    // Query your database to verify ownership
    // Example for MongoDB:
    // const restaurant = await Restaurant.findOne({
    //   _id: restaurantId,
    //   'branches._id': branchId
    // });
    // return !!restaurant;

    // Example for SQL:
    // const result = await db.query(
    //   'SELECT COUNT(*) as count FROM branches WHERE restaurant_id = ? AND id = ?',
    //   [restaurantId, branchId]
    // );
    // return result[0].count > 0;

    return true; // Replace with actual validation
  } catch (error) {
    console.error('Error validating branch ownership:', error);
    return false;
  }
}

// ============================================
// CHECKOUT SESSION ENDPOINT
// ============================================

/**
 * Create a Stripe checkout session using dynamic keys for a specific branch
 * POST /api/create-checkout-session
 */
app.post('/api/create-checkout-session', async (req, res) => {
  try {
    const { branchId, restaurantId, items } = req.body;

    // ✅ VALIDATION STEP 1: Check required fields
    if (!branchId || !restaurantId || !items || items.length === 0) {
      return res.status(400).json({
        error: 'Missing required fields: branchId, restaurantId, or items',
      });
    }

    // ✅ VALIDATION STEP 2: Verify branch ownership (prevent unauthorized access)
    const isAuthorized = await validateBranchOwnership(restaurantId, branchId);
    if (!isAuthorized) {
      return res.status(403).json({
        error: 'Unauthorized: Branch does not belong to this restaurant',
      });
    }

    // ✅ STEP 3: Fetch Stripe keys for this specific branch
    const stripeKeys = await getStripeKeysForBranch(branchId);

    if (!stripeKeys.isActive) {
      return res.status(400).json({
        error: 'Stripe keys for this branch are not active',
      });
    }

    // ✅ STEP 4: Initialize Stripe with branch-specific secret key
    const stripeInstance = stripe(stripeKeys.secretKey);

    // ✅ STEP 5: Transform items to Stripe line items
    const lineItems = items.map((item) => ({
      price_data: {
        currency: 'usd',
        product_data: {
          name: item.name,
          description: item.description || undefined,
          images: item.images || undefined,
        },
        unit_amount: Math.round(item.price * 100), // Convert to cents
      },
      quantity: item.quantity || 1,
    }));

    // ✅ STEP 6: Create checkout session with branch-specific keys
    const session = await stripeInstance.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: `${process.env.FRONTEND_URL}/success?session_id={CHECKOUT_SESSION_ID}&branch=${branchId}`,
      cancel_url: `${process.env.FRONTEND_URL}/cancel?branch=${branchId}`,
      metadata: {
        branchId: branchId,
        restaurantId: restaurantId,
        branchName: stripeKeys.branchName,
      },
    });

    // ✅ STEP 7: Return ONLY the session ID to frontend (never expose keys)
    res.json({
      sessionId: session.id,
      // Optional: Return publishable key only (frontend needs this for stripe.js)
      publishableKey: stripeKeys.publishableKey,
      branchId: branchId,
    });
  } catch (error) {
    console.error('Checkout session error:', error);
    res.status(500).json({
      error: error.message || 'Failed to create checkout session',
    });
  }
});

// ============================================
// WEBHOOK ENDPOINT (for handling Stripe events)
// ============================================

/**
 * Stripe webhook endpoint for handling payment events
 * POST /api/webhooks/stripe
 */
app.post('/api/webhooks/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    // ⚠️ Note: You need to verify webhook signature for each branch's key
    // For now, parse the event (in production, verify signature with correct key)
    const event = JSON.parse(req.body);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const { branchId, restaurantId } = session.metadata;

      console.log(`✅ Payment completed for branch: ${branchId}`);
      // Handle successful payment - update your database
      // Example: Mark order as paid, send confirmation email, etc.
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(400).json({ error: error.message });
  }
});

// ============================================
// HEALTH CHECK ENDPOINT
// ============================================

app.get('/api/health', (req, res) => {
  res.json({ status: 'Server is running' });
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

module.exports = app;
