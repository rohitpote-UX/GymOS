<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Gym;
use App\Models\SaasOrder;
use App\Models\SaasPayment;
use App\Models\SaasPlan;
use App\Support\CurrentGym;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class BillingController extends Controller
{
    /**
     * Show Gym SaaS Subscription status & available plans.
     */
    public function index()
    {
        $gym = CurrentGym::get();
        $plans = SaasPlan::where('is_active', true)->orderBy('sort_order')->get();
        $payments = SaasPayment::where('gym_id', $gym->id)->latest()->take(10)->get();

        return response()->json([
            'gym' => [
                'id' => $gym->id,
                'name' => $gym->name,
                'status' => $gym->status,
                'is_trial' => $gym->status === Gym::STATUS_TRIAL,
                'trial_ends_at' => $gym->trial_ends_at?->toIso8601String(),
                'subscription_expires_at' => $gym->subscription_expires_at?->toIso8601String(),
                'expired' => $gym->isExpired(),
                'plan' => $gym->plan,
            ],
            'plans' => $plans,
            'recent_payments' => $payments,
            'razorpay_key_id' => config('services.razorpay.key_id', env('RAZORPAY_KEY_ID', 'rzp_test_placeholder')),
        ]);
    }

    /**
     * Create Razorpay Order for plan upgrade/renewal.
     */
    public function order(Request $request)
    {
        $validated = $request->validate([
            'plan_id' => ['required', 'exists:saas_plans,id'],
            'interval' => ['nullable', 'in:month,year'],
        ]);

        $gym = CurrentGym::get();
        $plan = SaasPlan::findOrFail($validated['plan_id']);
        $interval = $validated['interval'] ?? $plan->interval;

        // Calculate amount (convert to paise for Razorpay)
        $amount = $interval === 'year' ? round($plan->price * 10, 2) : $plan->price;
        $orderId = 'order_' . Str::random(14); // In live mode, created via Razorpay API

        $saasOrder = SaasOrder::create([
            'gym_id' => $gym->id,
            'saas_plan_id' => $plan->id,
            'razorpay_order_id' => $orderId,
            'amount' => $amount,
            'currency' => 'INR',
            'interval' => $interval,
            'status' => 'created',
            'receipt' => 'SAAS-' . strtoupper(Str::random(8)),
        ]);

        return response()->json([
            'order' => $saasOrder,
            'razorpay_order_id' => $orderId,
            'amount_in_paise' => (int) ($amount * 100),
            'currency' => 'INR',
            'plan' => $plan,
        ]);
    }

    /**
     * Verify payment and extend gym subscription.
     */
    public function verify(Request $request)
    {
        $validated = $request->validate([
            'razorpay_order_id' => ['required', 'string'],
            'razorpay_payment_id' => ['required', 'string'],
            'razorpay_signature' => ['nullable', 'string'],
        ]);

        // Idempotency: If this payment was already recorded, don't extend twice
        $existing = SaasPayment::where('razorpay_payment_id', $validated['razorpay_payment_id'])->first();
        if ($existing) {
            return response()->json(['message' => 'Payment already processed.', 'payment' => $existing]);
        }

        return DB::transaction(function () use ($validated, $request) {
            $order = SaasOrder::where('razorpay_order_id', $validated['razorpay_order_id'])->firstOrFail();
            $gym = CurrentGym::get();
            $plan = $order->plan;

            // Calculate period extension
            $baseDate = ($gym->subscription_expires_at && $gym->subscription_expires_at->isFuture())
                ? $gym->subscription_expires_at
                : now();

            $periodEnd = $order->interval === 'year'
                ? $baseDate->copy()->addYear()
                : $baseDate->copy()->addMonth();

            // Create SaaS payment record
            $payment = SaasPayment::create([
                'gym_id' => $gym->id,
                'saas_order_id' => $order->id,
                'saas_plan_id' => $plan->id,
                'razorpay_payment_id' => $validated['razorpay_payment_id'],
                'razorpay_order_id' => $validated['razorpay_order_id'],
                'amount' => $order->amount,
                'currency' => $order->currency,
                'period_start' => now(),
                'period_end' => $periodEnd,
                'payload' => $validated,
            ]);

            $order->update(['status' => 'paid']);

            // Update Gym Status
            $gym->update([
                'status' => Gym::STATUS_ACTIVE,
                'saas_plan_id' => $plan->id,
                'subscription_expires_at' => $periodEnd,
            ]);

            AuditLog::record('gym.subscription_renewed', [
                'plan' => $plan->name,
                'amount' => $order->amount,
                'period_end' => $periodEnd->toIso8601String(),
            ]);

            return response()->json([
                'message' => "Payment successful. Gym subscription active until {$periodEnd->toDateString()}.",
                'gym' => $gym->fresh('plan'),
                'payment' => $payment,
            ]);
        });
    }

    /**
     * Razorpay Webhook endpoint.
     */
    public function webhook(Request $request)
    {
        $payload = $request->all();
        $event = $payload['event'] ?? '';

        if ($event === 'order.paid' || $event === 'payment.captured') {
            $paymentEntity = $payload['payload']['payment']['entity'] ?? [];
            $paymentId = $paymentEntity['id'] ?? null;
            $orderId = $paymentEntity['order_id'] ?? null;

            if ($paymentId && $orderId) {
                $order = SaasOrder::withoutGlobalScope('gym')->where('razorpay_order_id', $orderId)->first();
                if ($order && !SaasPayment::withoutGlobalScope('gym')->where('razorpay_payment_id', $paymentId)->exists()) {
                    CurrentGym::run($order->gym_id, function () use ($order, $paymentId, $paymentEntity) {
                        $gym = CurrentGym::get();
                        $baseDate = ($gym->subscription_expires_at && $gym->subscription_expires_at->isFuture())
                            ? $gym->subscription_expires_at
                            : now();

                        $periodEnd = $order->interval === 'year'
                            ? $baseDate->copy()->addYear()
                            : $baseDate->copy()->addMonth();

                        SaasPayment::create([
                            'gym_id' => $gym->id,
                            'saas_order_id' => $order->id,
                            'saas_plan_id' => $order->saas_plan_id,
                            'razorpay_payment_id' => $paymentId,
                            'razorpay_order_id' => $order->razorpay_order_id,
                            'amount' => $order->amount,
                            'currency' => $order->currency,
                            'period_start' => now(),
                            'period_end' => $periodEnd,
                            'payload' => $paymentEntity,
                        ]);

                        $order->update(['status' => 'paid']);
                        $gym->update([
                            'status' => Gym::STATUS_ACTIVE,
                            'subscription_expires_at' => $periodEnd,
                        ]);
                    });
                }
            }
        }

        return response()->json(['status' => 'ok']);
    }
}
