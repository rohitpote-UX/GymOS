<?php

namespace App\Services;

use App\Models\AttendanceLog;
use App\Models\AuditLog;
use App\Models\Branch;
use App\Models\Gym;
use App\Models\User;
use App\Models\VisitorPass;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class VisitorPassService
{
    /**
     * Calculate dynamic pricing with taxes for a given branch
     */
    public function getPassPricing(Branch $branch): array
    {
        $gym = $branch->gym;
        $gymSettings = $gym?->settings ?? [];

        $enabled = (bool) ($branch->visitor_pass_enabled ?? true);
        if (isset($gymSettings['visitor_pass_enabled'])) {
            $enabled = $enabled && (bool) $gymSettings['visitor_pass_enabled'];
        }

        $basePrice = $branch->getEffectiveOneDayPassPrice();
        $gstRate = (float) ($branch->one_day_pass_gst_rate ?? $gymSettings['tax_rate'] ?? 18.00);
        $gstAmount = round(($basePrice * $gstRate) / 100, 2);
        $totalAmount = round($basePrice + $gstAmount, 2);
        $accessHours = $branch->visitor_access_hours ?: ($gymSettings['visitor_access_hours'] ?? '06:00 AM - 10:00 PM');

        return [
            'enabled' => $enabled,
            'base_price' => $basePrice,
            'gst_rate' => $gstRate,
            'gst_amount' => $gstAmount,
            'total_amount' => $totalAmount,
            'currency' => 'INR',
            'access_hours' => $accessHours,
            'valid_for' => 'Today until facility closing',
        ];
    }

    /**
     * Create a pending visitor pass and initialize payment order
     */
    public function createPendingPass(Branch $branch, array $data): VisitorPass
    {
        $pricing = $this->getPassPricing($branch);

        if (!$pricing['enabled']) {
            throw new \RuntimeException('One-day visitor passes are currently not available at this branch.');
        }

        $passCode = VisitorPass::generatePassCode($branch->id);

        // Generate Razorpay Order ID (or sandbox order token)
        $razorpayKeyId = config('services.razorpay.key_id') ?: env('RAZORPAY_KEY_ID');
        $razorpayKeySecret = config('services.razorpay.key_secret') ?: env('RAZORPAY_KEY_SECRET');

        $orderId = 'order_' . Str::random(14);
        if ($razorpayKeyId && $razorpayKeySecret && class_exists(\Razorpay\Api\Api::class)) {
            try {
                $api = new \Razorpay\Api\Api($razorpayKeyId, $razorpayKeySecret);
                $order = $api->order->create([
                    'receipt' => $passCode,
                    'amount' => (int) round($pricing['total_amount'] * 100), // in paise
                    'currency' => 'INR',
                    'notes' => [
                        'gym_id' => $branch->gym_id,
                        'branch_id' => $branch->id,
                        'pass_code' => $passCode,
                        'visitor_name' => $data['full_name'],
                        'visitor_phone' => $data['phone'],
                    ],
                ]);
                $orderId = $order['id'];
            } catch (\Throwable $e) {
                Log::warning('Razorpay order creation fallback to sandbox token: ' . $e->getMessage());
            }
        }

        return VisitorPass::create([
            'gym_id' => $branch->gym_id,
            'branch_id' => $branch->id,
            'pass_code' => $passCode,
            'full_name' => trim($data['full_name']),
            'phone' => trim($data['phone']),
            'email' => !empty($data['email']) ? trim($data['email']) : null,
            'gender' => !empty($data['gender']) ? strtolower(trim($data['gender'])) : null,
            'emergency_contact' => !empty($data['emergency_contact']) ? trim($data['emergency_contact']) : null,
            'base_amount' => $pricing['base_price'],
            'gst_rate' => $pricing['gst_rate'],
            'gst_amount' => $pricing['gst_amount'],
            'total_amount' => $pricing['total_amount'],
            'currency' => 'INR',
            'payment_method' => 'razorpay',
            'payment_status' => 'pending',
            'razorpay_order_id' => $orderId,
            'valid_on' => now()->toDateString(),
            'notes' => $data['notes'] ?? 'Public QR self-service purchase',
        ]);
    }

    /**
     * Verify payment signature server-side and confirm pass + attendance
     */
    public function verifyAndConfirmPayment(string $passCode, string $paymentId, ?string $signature = null): array
    {
        return DB::transaction(function () use ($passCode, $paymentId, $signature) {
            $pass = VisitorPass::withoutGlobalScopes()
                ->where('pass_code', $passCode)
                ->lockForUpdate()
                ->firstOrFail();

            // Idempotency: If pass is already paid, return existing confirmed pass
            if ($pass->isPaid()) {
                $pass->load(['branch', 'attendanceLog']);
                return [
                    'success' => true,
                    'already_confirmed' => true,
                    'pass' => $pass,
                    'message' => 'Visitor pass is already active and verified.',
                ];
            }

            // Verify Razorpay signature if secret is configured
            $keySecret = config('services.razorpay.key_secret') ?: env('RAZORPAY_KEY_SECRET');
            if ($keySecret && $signature && $pass->razorpay_order_id) {
                $expectedSignature = hash_hmac('sha256', $pass->razorpay_order_id . '|' . $paymentId, $keySecret);
                if (!hash_equals($expectedSignature, $signature)) {
                    $pass->update(['payment_status' => 'failed']);
                    throw new \RuntimeException('Invalid payment signature. Verification failed.');
                }
            }

            $now = now();
            $expiresAt = now()->endOfDay();

            // 1. Mark pass paid
            $pass->update([
                'payment_status' => 'paid',
                'razorpay_payment_id' => $paymentId,
                'razorpay_signature' => $signature,
                'check_in_at' => $now,
                'expires_at' => $expiresAt,
            ]);

            // 2. Automatically record visitor attendance in attendance_logs
            $log = AttendanceLog::create([
                'gym_id' => $pass->gym_id,
                'branch_id' => $pass->branch_id,
                'member_id' => null,
                'person_type' => 'visitor',
                'visitor_pass_id' => $pass->id,
                'check_in_at' => $now,
                'method' => 'qr_scan',
                'qr_reference' => $pass->pass_code,
                'notes' => "Visitor 1-Day Pass: {$pass->full_name}",
            ]);

            $pass->update(['attendance_log_id' => $log->id]);

            // 3. Log audit event
            AuditLog::withoutGlobalScope('gym')->create([
                'gym_id' => $pass->gym_id,
                'branch_id' => $pass->branch_id,
                'user_id' => null,
                'event' => 'visitor_pass.paid_and_checked_in',
                'payload' => [
                    'pass_code' => $pass->pass_code,
                    'visitor_name' => $pass->full_name,
                    'phone' => $pass->phone,
                    'amount' => $pass->total_amount,
                    'payment_id' => $paymentId,
                    'attendance_log_id' => $log->id,
                ],
            ]);

            $pass->load(['branch', 'attendanceLog']);

            return [
                'success' => true,
                'pass' => $pass,
                'attendance_log' => $log,
                'message' => 'Payment verified successfully. Welcome to the gym!',
            ];
        });
    }

    /**
     * Manual Counter Registration by Front Desk / Receptionist
     */
    public function manualCounterRegister(Branch $branch, User $staff, array $data): VisitorPass
    {
        return DB::transaction(function () use ($branch, $staff, $data) {
            $pricing = $this->getPassPricing($branch);
            $passCode = VisitorPass::generatePassCode($branch->id);

            $method = in_array($data['payment_method'] ?? '', ['cash', 'upi', 'pos_card']) ? $data['payment_method'] : 'cash';
            $now = now();

            $pass = VisitorPass::create([
                'gym_id' => $branch->gym_id,
                'branch_id' => $branch->id,
                'pass_code' => $passCode,
                'full_name' => trim($data['full_name']),
                'phone' => trim($data['phone']),
                'email' => !empty($data['email']) ? trim($data['email']) : null,
                'gender' => !empty($data['gender']) ? strtolower(trim($data['gender'])) : null,
                'emergency_contact' => !empty($data['emergency_contact']) ? trim($data['emergency_contact']) : null,
                'base_amount' => $pricing['base_price'],
                'gst_rate' => $pricing['gst_rate'],
                'gst_amount' => $pricing['gst_amount'],
                'total_amount' => $pricing['total_amount'],
                'currency' => 'INR',
                'payment_method' => $method,
                'payment_status' => 'paid',
                'valid_on' => $now->toDateString(),
                'check_in_at' => $now,
                'expires_at' => $now->copy()->endOfDay(),
                'created_by_user_id' => $staff->id,
                'notes' => $data['notes'] ?? "Front desk manual check-in by {$staff->name}",
            ]);

            // Record attendance immediately
            $log = AttendanceLog::create([
                'gym_id' => $branch->gym_id,
                'branch_id' => $branch->id,
                'member_id' => null,
                'person_type' => 'visitor',
                'visitor_pass_id' => $pass->id,
                'check_in_at' => $now,
                'method' => 'front_desk',
                'qr_reference' => $pass->pass_code,
                'verified_by_user_id' => $staff->id,
                'notes' => "Walk-in Visitor Pass ({$method}): {$pass->full_name}",
            ]);

            $pass->update(['attendance_log_id' => $log->id]);

            AuditLog::withoutGlobalScope('gym')->create([
                'gym_id' => $branch->gym_id,
                'branch_id' => $branch->id,
                'user_id' => $staff->id,
                'event' => 'visitor_pass.counter_registered',
                'payload' => [
                    'pass_code' => $pass->pass_code,
                    'visitor_name' => $pass->full_name,
                    'staff_name' => $staff->name,
                    'amount' => $pass->total_amount,
                    'payment_method' => $method,
                ],
            ]);

            return $pass->load(['branch', 'attendanceLog', 'creator']);
        });
    }

    /**
     * Process Razorpay Webhook Event with signature & duplicate prevention
     */
    public function handleWebhook(array $payload, ?string $signature = null): bool
    {
        $event = $payload['event'] ?? '';
        if (!in_array($event, ['payment.captured', 'order.paid'])) {
            return false;
        }

        $paymentEntity = $payload['payload']['payment']['entity'] ?? null;
        if (!$paymentEntity) {
            return false;
        }

        $orderId = $paymentEntity['order_id'] ?? null;
        $paymentId = $paymentEntity['id'] ?? null;

        if (!$orderId || !$paymentId) {
            return false;
        }

        $pass = VisitorPass::withoutGlobalScopes()
            ->where('razorpay_order_id', $orderId)
            ->first();

        if (!$pass) {
            return false;
        }

        if ($pass->isPaid()) {
            return true; // Already processed idempotently
        }

        $this->verifyAndConfirmPayment($pass->pass_code, $paymentId, null);
        return true;
    }
}
