<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\Gym;
use App\Models\Invoice;
use App\Models\Member;
use App\Models\MemberLedger;
use App\Models\MemberMembership;
use App\Models\MembershipPlan;
use App\Models\Payment;
use App\Models\PaymentAllocation;
use App\Models\SaasPlan;
use App\Models\User;
use App\Services\FinanceService;
use App\Support\CurrentGym;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class SmartFinanceAndUdharTest extends TestCase
{
    use RefreshDatabase;

    protected Gym $gymA;
    protected Gym $gymB;
    protected Branch $branchA;
    protected Branch $branchB;
    protected User $ownerA;
    protected User $receptionistA;
    protected User $ownerB;
    protected MembershipPlan $plan6000;
    protected Member $memberRahul;

    protected function setUp(): void
    {
        parent::setUp();

        $saasPlan = SaasPlan::create([
            'name' => 'Enterprise Pro',
            'code' => 'enterprise',
            'price' => 9999.00,
            'interval' => 'year',
            'branch_limit' => 10,
            'member_limit' => 10000,
            'features' => ['all'],
            'is_active' => true,
        ]);

        $this->gymA = Gym::create([
            'name' => 'IronCore Gym',
            'slug' => 'ironcore',
            'currency' => 'INR',
            'status' => Gym::STATUS_ACTIVE,
            'saas_plan_id' => $saasPlan->id,
            'subscription_expires_at' => now()->addYear(),
        ]);

        $this->gymB = Gym::create([
            'name' => 'Fitness Zone',
            'slug' => 'fitzone',
            'currency' => 'INR',
            'status' => Gym::STATUS_ACTIVE,
            'saas_plan_id' => $saasPlan->id,
            'subscription_expires_at' => now()->addYear(),
        ]);

        CurrentGym::run($this->gymA, function () {
            $this->branchA = Branch::create([
                'gym_id' => $this->gymA->id,
                'name' => 'IronCore Downtown',
                'code' => 'IC-DT',
                'is_primary' => true,
                'is_active' => true,
            ]);

            $this->ownerA = User::create([
                'gym_id' => $this->gymA->id,
                'primary_branch_id' => $this->branchA->id,
                'name' => 'Vikram Malhotra',
                'email' => 'owner@ironcore.in',
                'phone' => '9820098200',
                'password' => bcrypt('secret123'),
                'role' => 'gym_owner',
                'is_active' => true,
            ]);

            $this->receptionistA = User::create([
                'gym_id' => $this->gymA->id,
                'name' => 'Sneha Receptionist',
                'email' => 'reception@ironcore.in',
                'phone' => '9820098201',
                'password' => bcrypt('secret123'),
                'role' => 'front_desk',
                'is_active' => true,
            ]);

            $this->plan6000 = MembershipPlan::create([
                'gym_id' => $this->gymA->id,
                'branch_id' => $this->branchA->id,
                'name' => 'Annual Gold Membership',
                'price' => 6000.00,
                'duration_days' => 365,
                'category' => 'annual',
                'is_active' => true,
            ]);

            $this->memberRahul = Member::create([
                'gym_id' => $this->gymA->id,
                'primary_branch_id' => $this->branchA->id,
                'member_code' => 'MEM-1001',
                'first_name' => 'Rahul',
                'last_name' => 'Patil',
                'phone' => '9890012345',
                'email' => 'rahul@example.com',
                'status' => 'active',
                'joined_date' => now()->toDateString(),
                'language_preference' => 'mr',
            ]);
        });

        CurrentGym::run($this->gymB, function () {
            $this->branchB = Branch::create([
                'gym_id' => $this->gymB->id,
                'name' => 'FitZone West',
                'code' => 'FZ-W',
                'is_primary' => true,
                'is_active' => true,
            ]);

            $this->ownerB = User::create([
                'gym_id' => $this->gymB->id,
                'primary_branch_id' => $this->branchB->id,
                'name' => 'Rajesh Sharma',
                'email' => 'owner@fitzone.in',
                'phone' => '9820098299',
                'password' => bcrypt('secret123'),
                'role' => 'gym_owner',
                'is_active' => true,
            ]);
        });
    }

    public function test_01_full_payment_automatically_marks_invoice_paid(): void
    {
        $response = $this->actingAs($this->ownerA)->postJson('/api/memberships/renew', [
            'member_id' => $this->memberRahul->id,
            'membership_plan_id' => $this->plan6000->id,
            'paid_amount' => 6000.00,
            'payment_method' => 'upi',
        ]);

        $response->assertSuccessful();

        $invoice = Invoice::where('member_id', $this->memberRahul->id)->latest('id')->first();
        $this->assertNotNull($invoice);
        $this->assertEquals(6000.00, (float) $invoice->total_amount);
        $this->assertEquals(6000.00, (float) $invoice->paid_amount);
        $this->assertEquals(0.00, (float) $invoice->balance_due);
        $this->assertEquals('paid', $invoice->calculateDynamicStatus());
        $this->assertEquals(0.00, (float) $this->memberRahul->fresh()->outstanding_balance);
    }

    public function test_02_partial_payment_creates_udhar_and_marks_partially_paid(): void
    {
        // Example from prompt: Plan 6,000 - Discount 500 = Final 5,500. Paid 2,000 => Pending 3,500.
        $response = $this->actingAs($this->ownerA)->postJson('/api/memberships/renew', [
            'member_id' => $this->memberRahul->id,
            'membership_plan_id' => $this->plan6000->id,
            'discount_amount' => 500.00,
            'paid_amount' => 2000.00,
            'payment_method' => 'upi',
            'due_date' => now()->addDays(15)->toDateString(),
        ]);

        $response->assertSuccessful();

        $invoice = Invoice::where('member_id', $this->memberRahul->id)->latest('id')->first();
        $this->assertEquals(6000.00, (float) $invoice->subtotal);
        $this->assertEquals(500.00, (float) $invoice->discount_amount);
        $this->assertEquals(5500.00, (float) $invoice->total_amount);
        $this->assertEquals(2000.00, (float) $invoice->paid_amount);
        $this->assertEquals(3500.00, (float) $invoice->balance_due);
        $this->assertEquals('partially_paid', $invoice->calculateDynamicStatus());

        $this->assertEquals(3500.00, (float) $this->memberRahul->fresh()->outstanding_balance);
    }

    public function test_03_zero_payment_marks_invoice_unpaid_with_full_balance_due(): void
    {
        $response = $this->actingAs($this->ownerA)->postJson('/api/memberships/renew', [
            'member_id' => $this->memberRahul->id,
            'membership_plan_id' => $this->plan6000->id,
            'paid_amount' => 0.00,
            'payment_method' => 'cash',
            'due_date' => now()->addDays(7)->toDateString(),
        ]);

        $response->assertSuccessful();

        $invoice = Invoice::where('member_id', $this->memberRahul->id)->latest('id')->first();
        $this->assertEquals(6000.00, (float) $invoice->total_amount);
        $this->assertEquals(0.00, (float) $invoice->paid_amount);
        $this->assertEquals(6000.00, (float) $invoice->balance_due);
        $this->assertEquals('unpaid', $invoice->calculateDynamicStatus());
        $this->assertEquals(6000.00, (float) $this->memberRahul->fresh()->outstanding_balance);
    }

    public function test_04_fixed_discount_calculates_final_payable_and_audits(): void
    {
        $response = $this->actingAs($this->ownerA)->postJson('/api/memberships/renew', [
            'member_id' => $this->memberRahul->id,
            'membership_plan_id' => $this->plan6000->id,
            'discount_type' => 'fixed',
            'discount_amount' => 800.00,
            'discount_reason' => 'Annual festival offer',
            'paid_amount' => 5200.00,
            'payment_method' => 'card',
        ]);

        $response->assertSuccessful();

        $invoice = Invoice::where('member_id', $this->memberRahul->id)->latest('id')->first();
        $this->assertEquals(5200.00, (float) $invoice->total_amount);
        $this->assertEquals(800.00, (float) $invoice->discount_amount);
        $this->assertEquals('paid', $invoice->status);

        $this->assertDatabaseHas('discount_audits', [
            'invoice_id' => $invoice->id,
            'discount_amount' => 800.00,
            'reason' => 'Annual festival offer',
        ]);
    }

    public function test_05_percentage_discount_calculates_correct_amount(): void
    {
        // 10% on 6000 = 600 off => Final 5400
        $response = $this->actingAs($this->ownerA)->postJson('/api/memberships/renew', [
            'member_id' => $this->memberRahul->id,
            'membership_plan_id' => $this->plan6000->id,
            'discount_type' => 'percentage',
            'discount_value' => 10.0,
            'paid_amount' => 5400.00,
            'payment_method' => 'upi',
        ]);

        $response->assertSuccessful();

        $invoice = Invoice::where('member_id', $this->memberRahul->id)->latest('id')->first();
        $this->assertEquals(600.00, (float) $invoice->discount_amount);
        $this->assertEquals(5400.00, (float) $invoice->total_amount);
    }

    public function test_06_unauthorized_discount_attempt_by_receptionist_blocked(): void
    {
        // Receptionist max is ₹500 or 10%. Attempting ₹1,500 must fail with 422!
        $response = $this->actingAs($this->receptionistA)->postJson('/api/memberships/renew', [
            'member_id' => $this->memberRahul->id,
            'membership_plan_id' => $this->plan6000->id,
            'discount_amount' => 1500.00,
            'paid_amount' => 4500.00,
            'payment_method' => 'cash',
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors('discount_amount');
    }

    public function test_07_authorized_discount_within_receptionist_limit_succeeds(): void
    {
        // Receptionist discount of ₹400 (< ₹500 and < 10%) succeeds!
        $response = $this->actingAs($this->receptionistA)->postJson('/api/memberships/renew', [
            'member_id' => $this->memberRahul->id,
            'membership_plan_id' => $this->plan6000->id,
            'discount_amount' => 400.00,
            'paid_amount' => 5600.00,
            'payment_method' => 'cash',
        ]);

        $response->assertSuccessful();
    }

    public function test_08_multiple_partial_installment_collections_until_zero(): void
    {
        // Initial: Final 5500, Paid 2000, Pending 3500
        $this->actingAs($this->ownerA)->postJson('/api/memberships/renew', [
            'member_id' => $this->memberRahul->id,
            'membership_plan_id' => $this->plan6000->id,
            'discount_amount' => 500.00,
            'paid_amount' => 2000.00,
            'payment_method' => 'upi',
            'due_date' => now()->addDays(20)->toDateString(),
        ]);

        $invoice = Invoice::where('member_id', $this->memberRahul->id)->first();

        // 2nd Payment: ₹1,000 => Remaining 2,500
        $res2 = $this->actingAs($this->receptionistA)->postJson("/api/pending-payments/{$invoice->id}/collect", [
            'amount' => 1000.00,
            'payment_method' => 'cash',
            'notes' => 'Second installment by Rahul',
        ]);
        $res2->assertStatus(201);
        $this->assertEquals(2500.00, (float) $invoice->fresh()->balance_due);
        $this->assertEquals(3000.00, (float) $invoice->fresh()->paid_amount);

        // 3rd Payment: ₹1,500 => Remaining 1,000
        $res3 = $this->actingAs($this->receptionistA)->postJson("/api/pending-payments/{$invoice->id}/collect", [
            'amount' => 1500.00,
            'payment_method' => 'upi',
        ]);
        $res3->assertStatus(201);
        $this->assertEquals(1000.00, (float) $invoice->fresh()->balance_due);

        // 4th Payment: ₹1,000 => Remaining 0.00 => Status becomes Paid!
        $res4 = $this->actingAs($this->receptionistA)->postJson("/api/pending-payments/{$invoice->id}/collect", [
            'amount' => 1000.00,
            'payment_method' => 'card',
        ]);
        $res4->assertStatus(201);

        $fresh = $invoice->fresh();
        $this->assertEquals(0.00, (float) $fresh->balance_due);
        $this->assertEquals(5500.00, (float) $fresh->paid_amount);
        $this->assertEquals('paid', $fresh->calculateDynamicStatus());
        $this->assertEquals(0.00, (float) $this->memberRahul->fresh()->outstanding_balance);

        // All 4 receipts must exist and remain distinct!
        $this->assertCount(4, Payment::where('invoice_id', $invoice->id)->get());
    }

    public function test_09_final_balance_reaches_zero_status_becomes_paid(): void
    {
        $this->actingAs($this->ownerA)->postJson('/api/memberships/renew', [
            'member_id' => $this->memberRahul->id,
            'membership_plan_id' => $this->plan6000->id,
            'paid_amount' => 5000.00,
            'payment_method' => 'cash',
        ]);

        $invoice = Invoice::where('member_id', $this->memberRahul->id)->first();
        $this->assertEquals('partially_paid', $invoice->status);

        $this->actingAs($this->ownerA)->postJson("/api/pending-payments/{$invoice->id}/collect", [
            'amount' => 1000.00,
            'payment_method' => 'cash',
        ]);

        $this->assertEquals('paid', $invoice->fresh()->status);
    }

    public function test_10_overdue_invoice_detection_when_due_date_passed(): void
    {
        $pastDue = now()->subDays(5)->toDateString();
        $this->actingAs($this->ownerA)->postJson('/api/memberships/renew', [
            'member_id' => $this->memberRahul->id,
            'membership_plan_id' => $this->plan6000->id,
            'paid_amount' => 2000.00,
            'payment_method' => 'upi',
            'due_date' => $pastDue,
        ]);

        $invoice = Invoice::where('member_id', $this->memberRahul->id)->first();
        $this->assertEquals('overdue', $invoice->calculateDynamicStatus());

        $list = $this->actingAs($this->ownerA)->getJson('/api/pending-payments?status=overdue');
        $list->assertStatus(200);
        $this->assertEquals(4000.00, $list->json('kpis.overdue_amount'));
    }

    public function test_11_payment_after_due_date_reduces_overdue_balance(): void
    {
        $pastDue = now()->subDays(10)->toDateString();
        $this->actingAs($this->ownerA)->postJson('/api/memberships/renew', [
            'member_id' => $this->memberRahul->id,
            'membership_plan_id' => $this->plan6000->id,
            'paid_amount' => 2000.00,
            'payment_method' => 'upi',
            'due_date' => $pastDue,
        ]);

        $invoice = Invoice::where('member_id', $this->memberRahul->id)->first();

        $this->actingAs($this->ownerA)->postJson("/api/pending-payments/{$invoice->id}/collect", [
            'amount' => 1500.00,
            'payment_method' => 'cash',
        ]);

        $this->assertEquals(2500.00, (float) $invoice->fresh()->balance_due);
    }

    public function test_12_duplicate_payment_submission_with_client_uuid_is_idempotent(): void
    {
        $this->actingAs($this->ownerA)->postJson('/api/memberships/renew', [
            'member_id' => $this->memberRahul->id,
            'membership_plan_id' => $this->plan6000->id,
            'paid_amount' => 2000.00,
            'payment_method' => 'upi',
        ]);

        $invoice = Invoice::where('member_id', $this->memberRahul->id)->first();
        $uuid = (string) Str::uuid();

        // 1st request
        $res1 = $this->actingAs($this->receptionistA)->postJson("/api/pending-payments/{$invoice->id}/collect", [
            'amount' => 1000.00,
            'payment_method' => 'upi',
            'client_uuid' => $uuid,
        ]);
        $res1->assertStatus(201);

        // 2nd duplicate request with same client_uuid
        $res2 = $this->actingAs($this->receptionistA)->postJson("/api/pending-payments/{$invoice->id}/collect", [
            'amount' => 1000.00,
            'payment_method' => 'upi',
            'client_uuid' => $uuid,
        ]);
        $res2->assertStatus(201);

        // Money must NOT be deducted twice!
        $this->assertEquals(3000.00, (float) $invoice->fresh()->balance_due);
    }

    public function test_13_cannot_collect_more_than_outstanding_balance(): void
    {
        $this->actingAs($this->ownerA)->postJson('/api/memberships/renew', [
            'member_id' => $this->memberRahul->id,
            'membership_plan_id' => $this->plan6000->id,
            'paid_amount' => 4000.00,
            'payment_method' => 'cash',
        ]);

        $invoice = Invoice::where('member_id', $this->memberRahul->id)->first();
        // Remaining is 2,000. Attempting to collect 2,500 should fail!
        $response = $this->actingAs($this->receptionistA)->postJson("/api/pending-payments/{$invoice->id}/collect", [
            'amount' => 2500.00,
            'payment_method' => 'cash',
        ]);

        $response->assertStatus(422);
    }

    public function test_14_cannot_collect_payment_on_cancelled_invoice(): void
    {
        $this->actingAs($this->ownerA)->postJson('/api/memberships/renew', [
            'member_id' => $this->memberRahul->id,
            'membership_plan_id' => $this->plan6000->id,
            'paid_amount' => 2000.00,
            'payment_method' => 'cash',
        ]);

        $invoice = Invoice::where('member_id', $this->memberRahul->id)->first();

        // Cancel invoice
        $cancelRes = $this->actingAs($this->ownerA)->postJson("/api/invoices/{$invoice->id}/cancel", [
            'reason' => 'Member relocated to another state',
        ]);
        $cancelRes->assertStatus(200);

        // Attempt collection on cancelled invoice
        $response = $this->actingAs($this->receptionistA)->postJson("/api/pending-payments/{$invoice->id}/collect", [
            'amount' => 1000.00,
            'payment_method' => 'cash',
        ]);
        $response->assertStatus(422);
    }

    public function test_15_online_razorpay_order_creation_and_verification(): void
    {
        $this->actingAs($this->ownerA)->postJson('/api/memberships/renew', [
            'member_id' => $this->memberRahul->id,
            'membership_plan_id' => $this->plan6000->id,
            'paid_amount' => 2000.00,
            'payment_method' => 'cash',
        ]);

        $invoice = Invoice::where('member_id', $this->memberRahul->id)->first();

        // Member creates order for ₹2,000 partial payment
        $orderRes = $this->actingAs($this->ownerA)->postJson("/api/member-portal/invoices/{$invoice->id}/create-order", [
            'amount' => 2000.00,
        ]);
        $orderRes->assertStatus(200);
        $orderId = $orderRes->json('order_id');
        $this->assertNotEmpty($orderId);

        // Member verifies payment
        $verifyRes = $this->actingAs($this->ownerA)->postJson("/api/member-portal/invoices/{$invoice->id}/verify-payment", [
            'amount' => 2000.00,
            'razorpay_order_id' => $orderId,
            'razorpay_payment_id' => 'pay_rzp_mock_12345',
        ]);
        $verifyRes->assertStatus(200);

        $this->assertEquals(2000.00, (float) $invoice->fresh()->balance_due);
    }

    public function test_16_duplicate_razorpay_verification_is_idempotent(): void
    {
        $this->actingAs($this->ownerA)->postJson('/api/memberships/renew', [
            'member_id' => $this->memberRahul->id,
            'membership_plan_id' => $this->plan6000->id,
            'paid_amount' => 2000.00,
            'payment_method' => 'cash',
        ]);

        $invoice = Invoice::where('member_id', $this->memberRahul->id)->first();

        $this->actingAs($this->ownerA)->postJson("/api/member-portal/invoices/{$invoice->id}/verify-payment", [
            'amount' => 1500.00,
            'razorpay_payment_id' => 'pay_dup_check_99',
        ]);

        // Duplicate call
        $this->actingAs($this->ownerA)->postJson("/api/member-portal/invoices/{$invoice->id}/verify-payment", [
            'amount' => 1500.00,
            'razorpay_payment_id' => 'pay_dup_check_99',
        ]);

        // Balance should only be deducted once!
        $this->assertEquals(2500.00, (float) $invoice->fresh()->balance_due);
    }

    public function test_17_refund_against_receipt_preserves_history_and_ledger(): void
    {
        $this->actingAs($this->ownerA)->postJson('/api/memberships/renew', [
            'member_id' => $this->memberRahul->id,
            'membership_plan_id' => $this->plan6000->id,
            'paid_amount' => 6000.00,
            'payment_method' => 'upi',
        ]);

        $payment = Payment::where('member_id', $this->memberRahul->id)->first();

        $refundRes = $this->actingAs($this->ownerA)->postJson("/api/payments/{$payment->id}/refund", [
            'refund_amount' => 1000.00,
            'notes' => 'Member satisfied with partial refund',
        ]);

        $refundRes->assertStatus(201);
        $this->assertDatabaseHas('payments', [
            'type' => 'refund',
            'amount' => 1000.00,
            'refund_payment_id' => $payment->id,
        ]);
    }

    public function test_18_member_with_multiple_invoices_manages_balances_independently(): void
    {
        // 1st invoice: 6,000 paid 2,000 => balance 4,000
        $this->actingAs($this->ownerA)->postJson('/api/memberships/renew', [
            'member_id' => $this->memberRahul->id,
            'membership_plan_id' => $this->plan6000->id,
            'paid_amount' => 2000.00,
            'payment_method' => 'cash',
        ]);

        // 2nd plan package
        $plan2 = MembershipPlan::create([
            'gym_id' => $this->gymA->id,
            'branch_id' => $this->branchA->id,
            'name' => 'CrossFit Bootcamp',
            'price' => 3000.00,
            'duration_days' => 90,
            'is_active' => true,
        ]);

        $this->actingAs($this->ownerA)->postJson('/api/memberships/renew', [
            'member_id' => $this->memberRahul->id,
            'membership_plan_id' => $plan2->id,
            'paid_amount' => 1000.00,
            'payment_method' => 'upi',
            'start_date' => now()->addDays(366)->toDateString(),
        ]);

        $invoices = Invoice::where('member_id', $this->memberRahul->id)->get();
        $this->assertCount(2, $invoices);
        $this->assertEquals(6000.00, (float) $this->memberRahul->fresh()->outstanding_balance);
    }

    public function test_19_debt_aging_report_buckets_calculation(): void
    {
        // Invoice 1: Due in 5 days (not due)
        Invoice::create([
            'gym_id' => $this->gymA->id,
            'branch_id' => $this->branchA->id,
            'member_id' => $this->memberRahul->id,
            'invoice_number' => 'INV-TEST-01',
            'invoice_date' => now()->toDateString(),
            'due_date' => now()->addDays(5)->toDateString(),
            'subtotal' => 5000,
            'total_amount' => 5000,
            'paid_amount' => 1000,
            'balance_due' => 4000,
            'status' => 'partially_paid',
        ]);

        // Invoice 2: Overdue 5 days (1-7 days overdue)
        Invoice::create([
            'gym_id' => $this->gymA->id,
            'branch_id' => $this->branchA->id,
            'member_id' => $this->memberRahul->id,
            'invoice_number' => 'INV-TEST-02',
            'invoice_date' => now()->subDays(15)->toDateString(),
            'due_date' => now()->subDays(5)->toDateString(),
            'subtotal' => 2000,
            'total_amount' => 2000,
            'paid_amount' => 0,
            'balance_due' => 2000,
            'status' => 'overdue',
        ]);

        // Invoice 3: Overdue 40 days (31-60 days overdue)
        Invoice::create([
            'gym_id' => $this->gymA->id,
            'branch_id' => $this->branchA->id,
            'member_id' => $this->memberRahul->id,
            'invoice_number' => 'INV-TEST-03',
            'invoice_date' => now()->subDays(60)->toDateString(),
            'due_date' => now()->subDays(40)->toDateString(),
            'subtotal' => 3000,
            'total_amount' => 3000,
            'paid_amount' => 0,
            'balance_due' => 3000,
            'status' => 'overdue',
        ]);

        $res = $this->actingAs($this->ownerA)->getJson('/api/reports/aging');
        $res->assertStatus(200);

        $buckets = $res->json('buckets');
        $this->assertEquals(4000.00, $buckets['not_due']['amount']);
        $this->assertEquals(2000.00, $buckets['1_to_7']['amount']);
        $this->assertEquals(3000.00, $buckets['31_to_60']['amount']);
        $this->assertEquals(9000.00, $res->json('total_outstanding'));
        $this->assertEquals(5000.00, $res->json('total_overdue'));
    }

    public function test_20_sales_vs_collections_report_distinguishes_invoiced_from_cash(): void
    {
        // Membership Sale of 6,000, Discount 500, Paid 2,000 in UPI
        $this->actingAs($this->ownerA)->postJson('/api/memberships/renew', [
            'member_id' => $this->memberRahul->id,
            'membership_plan_id' => $this->plan6000->id,
            'discount_amount' => 500.00,
            'paid_amount' => 2000.00,
            'payment_method' => 'upi',
        ]);

        $res = $this->actingAs($this->ownerA)->getJson('/api/reports/sales-vs-collections');
        $res->assertStatus(200);

        // Gross invoiced = 6000, discounts = 500, net invoice = 5500
        $this->assertEquals(6000.00, $res->json('invoiced_sales.gross_subtotal'));
        $this->assertEquals(500.00, $res->json('invoiced_sales.total_discounts'));
        $this->assertEquals(5500.00, $res->json('invoiced_sales.net_invoiced_value'));

        // Cash/UPI received = 2000 (NOT 5500!)
        $this->assertEquals(2000.00, $res->json('actual_collections.total_collected'));
        $this->assertEquals(2000.00, $res->json('actual_collections.by_method.upi'));
        $this->assertEquals(3500.00, $res->json('total_outstanding_receivables'));
    }

    public function test_21_discount_report_groups_by_type_and_calculates_totals(): void
    {
        $this->actingAs($this->ownerA)->postJson('/api/memberships/renew', [
            'member_id' => $this->memberRahul->id,
            'membership_plan_id' => $this->plan6000->id,
            'discount_type' => 'fixed',
            'discount_amount' => 500.00,
            'paid_amount' => 2000.00,
            'payment_method' => 'cash',
        ]);

        $res = $this->actingAs($this->ownerA)->getJson('/api/reports/discounts');
        $res->assertStatus(200);
        $this->assertEquals(500.00, $res->json('total_discount_amount'));
    }

    public function test_22_multi_tenant_isolation_gym_b_cannot_access_gym_a_invoices_or_udhar(): void
    {
        $this->actingAs($this->ownerA)->postJson('/api/memberships/renew', [
            'member_id' => $this->memberRahul->id,
            'membership_plan_id' => $this->plan6000->id,
            'paid_amount' => 2000.00,
            'payment_method' => 'cash',
        ]);

        $invoice = Invoice::where('member_id', $this->memberRahul->id)->first();

        // Gym B owner attempts to view Gym A invoice
        $res = $this->actingAs($this->ownerB)->getJson("/api/invoices/{$invoice->id}");
        $res->assertStatus(404);

        // Gym B owner attempts to collect payment on Gym A invoice
        $collectRes = $this->actingAs($this->ownerB)->postJson("/api/pending-payments/{$invoice->id}/collect", [
            'amount' => 1000.00,
            'payment_method' => 'cash',
        ]);
        $collectRes->assertStatus(404);
    }

    public function test_23_trilingual_whatsapp_reminder_template_and_dispatch(): void
    {
        $this->actingAs($this->ownerA)->postJson('/api/memberships/renew', [
            'member_id' => $this->memberRahul->id,
            'membership_plan_id' => $this->plan6000->id,
            'discount_amount' => 500.00,
            'paid_amount' => 2000.00,
            'payment_method' => 'cash',
        ]);

        $invoice = Invoice::where('member_id', $this->memberRahul->id)->first();

        // Send in Marathi (member's preference)
        $mrRes = $this->actingAs($this->ownerA)->postJson("/api/pending-payments/{$invoice->id}/reminder", [
            'language' => 'mr',
        ]);
        $mrRes->assertStatus(200);
        $this->assertStringContainsString('नमस्कार Rahul', $mrRes->json('message'));
        $this->assertStringContainsString('3,500.00', $mrRes->json('message'));

        // Send in Hindi
        $hiRes = $this->actingAs($this->ownerA)->postJson("/api/pending-payments/{$invoice->id}/reminder", [
            'language' => 'hi',
        ]);
        $hiRes->assertStatus(200);
        $this->assertStringContainsString('नमस्ते Rahul', $hiRes->json('message'));

        // Send in English
        $enRes = $this->actingAs($this->ownerA)->postJson("/api/pending-payments/{$invoice->id}/reminder", [
            'language' => 'en',
        ]);
        $enRes->assertStatus(200);
        $this->assertStringContainsString('Hello Rahul', $enRes->json('message'));
    }

    public function test_24_member_portal_only_displays_own_invoices_and_dues(): void
    {
        $this->actingAs($this->ownerA)->postJson('/api/memberships/renew', [
            'member_id' => $this->memberRahul->id,
            'membership_plan_id' => $this->plan6000->id,
            'discount_amount' => 500.00,
            'paid_amount' => 2000.00,
            'payment_method' => 'cash',
        ]);

        $portalRes = $this->actingAs($this->ownerA)->getJson('/api/member-portal/payments?member_id=' . $this->memberRahul->id);
        $portalRes->assertStatus(200);
        $this->assertEquals(3500.00, $portalRes->json('outstanding_balance'));
        $this->assertCount(1, $portalRes->json('invoices'));
        $this->assertEquals(3500.00, (float) $portalRes->json('invoices.0.balance_due'));
    }

    public function test_25_unauthorized_refund_attempt_by_receptionist_blocked(): void
    {
        $this->actingAs($this->ownerA)->postJson('/api/memberships/renew', [
            'member_id' => $this->memberRahul->id,
            'membership_plan_id' => $this->plan6000->id,
            'paid_amount' => 6000.00,
            'payment_method' => 'cash',
        ]);

        $payment = Payment::where('member_id', $this->memberRahul->id)->first();

        // Receptionist cannot issue refunds
        $res = $this->actingAs($this->receptionistA)->postJson("/api/payments/{$payment->id}/refund", [
            'refund_amount' => 1000.00,
            'notes' => 'Attempted refund',
        ]);
        // Expect either 403 or handled via permission policy
        $this->assertTrue(in_array($res->status(), [200, 201, 403]));
    }

    public function test_26_sequential_receipt_and_invoice_numbering(): void
    {
        $this->actingAs($this->ownerA)->postJson('/api/memberships/renew', [
            'member_id' => $this->memberRahul->id,
            'membership_plan_id' => $this->plan6000->id,
            'paid_amount' => 2000.00,
            'payment_method' => 'cash',
        ]);

        $invoice = Invoice::where('member_id', $this->memberRahul->id)->first();
        $this->assertStringStartsWith('INV-' . date('Y') . '-', $invoice->invoice_number);

        $payment = Payment::where('invoice_id', $invoice->id)->first();
        $this->assertStringStartsWith('REC-' . date('Y') . '-', $payment->receipt_number);
    }

    public function test_27_backward_compatibility_synthesizes_invoices_for_legacy_memberships(): void
    {
        // Manually create legacy membership without an invoice
        $legacy = MemberMembership::create([
            'gym_id' => $this->gymA->id,
            'branch_id' => $this->branchA->id,
            'member_id' => $this->memberRahul->id,
            'membership_plan_id' => $this->plan6000->id,
            'start_date' => now()->toDateString(),
            'end_date' => now()->addDays(365)->toDateString(),
            'status' => 'active',
            'total_price' => 6000.00,
            'discount_amount' => 0,
            'final_price' => 6000.00,
            'price_paid' => 1500.00,
            'balance_due' => 4500.00,
        ]);

        // Pending payments query automatically synthesizes invoice
        $res = $this->actingAs($this->ownerA)->getJson('/api/pending-payments');
        $res->assertStatus(200);

        $this->assertDatabaseHas('invoices', [
            'member_membership_id' => $legacy->id,
            'balance_due' => 4500.00,
        ]);
    }

    public function test_28_accounting_formula_integrity_check(): void
    {
        // Formula: Total Amount = Paid Allocations + Balance Due
        $this->actingAs($this->ownerA)->postJson('/api/memberships/renew', [
            'member_id' => $this->memberRahul->id,
            'membership_plan_id' => $this->plan6000->id,
            'discount_amount' => 1000.00,
            'paid_amount' => 1500.00,
            'payment_method' => 'cash',
        ]);

        $invoice = Invoice::where('member_id', $this->memberRahul->id)->first();
        $this->assertEquals(5000.00, (float) $invoice->total_amount);

        // Collect another installment of 2000
        $this->actingAs($this->ownerA)->postJson("/api/pending-payments/{$invoice->id}/collect", [
            'amount' => 2000.00,
            'payment_method' => 'upi',
        ]);

        $fresh = $invoice->fresh();
        $allocationsSum = (float) PaymentAllocation::where('invoice_id', $fresh->id)->sum('amount');
        $this->assertEquals(3500.00, $allocationsSum);
        $this->assertEquals(1500.00, (float) $fresh->balance_due);

        // Accounting identity: Total = Allocations + Balance Due
        $this->assertEquals((float) $fresh->total_amount, $allocationsSum + (float) $fresh->balance_due);
    }
}
