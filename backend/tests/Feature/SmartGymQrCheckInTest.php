<?php

namespace Tests\Feature;

use App\Models\AttendanceLog;
use App\Models\Branch;
use App\Models\Gym;
use App\Models\GymQrCode;
use App\Models\Member;
use App\Models\MemberMembership;
use App\Models\MembershipPlan;
use App\Models\SaasPlan;
use App\Models\User;
use App\Models\VisitorPass;
use App\Support\CurrentGym;
use App\Support\ModuleRegistry;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SmartGymQrCheckInTest extends TestCase
{
    use RefreshDatabase;

    protected Gym $gym;
    protected Branch $branch;
    protected User $owner;
    protected Member $member;
    protected MembershipPlan $membershipPlan;
    protected MemberMembership $membership;
    protected GymQrCode $qrCode;

    protected function setUp(): void
    {
        parent::setUp();

        $allModules = array_keys(ModuleRegistry::all());

        $saasPlan = SaasPlan::create([
            'name' => 'Enterprise OS',
            'code' => 'enterprise-os',
            'branch_limit' => 5,
            'member_limit' => 1000,
            'price' => 4999,
            'interval' => 'month',
            'features' => ['all'],
            'modules' => $allModules,
            'is_active' => true,
        ]);

        $this->gym = Gym::create([
            'name' => 'IronCore Fitness',
            'slug' => 'ironcore',
            'saas_plan_id' => $saasPlan->id,
            'subscription_status' => 'active',
            'subscription_expires_at' => now()->addYear(),
            'phone' => '9876543210',
            'email' => 'owner@ironcore.in',
            'status' => Gym::STATUS_ACTIVE,
            'modules' => $allModules,
            'settings' => [
                'dues_policy' => 'allow_with_warning',
                'visitor_pass_enabled' => true,
                'tax_rate' => 18.00,
            ],
        ]);

        CurrentGym::run($this->gym, function () {
            $this->branch = Branch::create([
                'gym_id' => $this->gym->id,
                'name' => 'Downtown Flagship',
                'code' => 'MAIN',
                'address' => 'Plot 42, Senapati Bapat Road',
                'city' => 'Pune',
                'is_primary' => true,
                'is_active' => true,
                'visitor_pass_enabled' => true,
                'one_day_pass_price' => 300.00,
                'one_day_pass_gst_rate' => 18.00,
                'visitor_access_hours' => '06:00 AM - 10:00 PM',
            ]);

            $this->owner = User::create([
                'gym_id' => $this->gym->id,
                'primary_branch_id' => $this->branch->id,
                'name' => 'Vikram Malhotra',
                'email' => 'owner@ironcore.in',
                'phone' => '9822011111',
                'password' => bcrypt('Password@123'),
                'role' => 'gym_owner',
                'is_active' => true,
            ]);

            $this->membershipPlan = MembershipPlan::create([
                'gym_id' => $this->gym->id,
                'name' => 'Annual Elite VIP',
                'duration_months' => 12,
                'price' => 15000,
                'is_active' => true,
            ]);

            $this->member = Member::create([
                'gym_id' => $this->gym->id,
                'primary_branch_id' => $this->branch->id,
                'member_code' => 'ICF-0001',
                'first_name' => 'Aarav',
                'last_name' => 'Sharma',
                'phone' => '9822000001',
                'email' => 'aarav@sharma.in',
                'status' => 'active',
                'outstanding_balance' => 0,
            ]);

            $this->membership = MemberMembership::create([
                'gym_id' => $this->gym->id,
                'member_id' => $this->member->id,
                'membership_plan_id' => $this->membershipPlan->id,
                'branch_id' => $this->branch->id,
                'start_date' => now()->subMonth(),
                'end_date' => now()->addMonths(11),
                'price_paid' => 15000,
                'status' => 'active',
            ]);

            $this->qrCode = GymQrCode::createUnique(
                gymId: $this->gym->id,
                branchId: $this->branch->id,
                userId: $this->owner->id,
                attributes: ['name' => 'Downtown Turnstile QR']
            );
        });
    }

    public function test_can_resolve_checkin_facility_by_gym_slug_and_branch_code(): void
    {
        $response = $this->getJson("/api/self-check-in/resolve/ironcore/MAIN");

        $response->assertStatus(200)
            ->assertJson([
                'valid' => true,
                'gym' => [
                    'name' => 'IronCore Fitness',
                    'slug' => 'ironcore',
                ],
                'branch' => [
                    'name' => 'Downtown Flagship',
                    'code' => 'MAIN',
                ],
            ]);

        $this->assertNotEmpty($response->json('token'));
        $this->assertEquals(300, $response->json('visitor_pass.base_price'));
        $this->assertEquals(54, $response->json('visitor_pass.gst_amount')); // 18% of 300
        $this->assertEquals(354, $response->json('visitor_pass.total_amount'));
    }

    public function test_auto_provisions_qr_token_if_branch_does_not_have_one(): void
    {
        CurrentGym::run($this->gym, function () {
            GymQrCode::where('branch_id', $this->branch->id)->delete();
        });

        $this->assertDatabaseMissing('gym_qr_codes', ['branch_id' => $this->branch->id]);

        $response = $this->getJson("/api/self-check-in/resolve/ironcore/MAIN");

        $response->assertStatus(200);
        $this->assertDatabaseHas('gym_qr_codes', [
            'gym_id' => $this->gym->id,
            'branch_id' => $this->branch->id,
            'is_active' => true,
        ]);
    }

    public function test_info_by_token_returns_visitor_pass_pricing_with_gst_breakdown(): void
    {
        $response = $this->getJson("/api/self-check-in/info/{$this->qrCode->token}");

        $response->assertStatus(200)
            ->assertJson([
                'valid' => true,
                'visitor_pass' => [
                    'enabled' => true,
                    'base_price' => 300,
                    'gst_rate' => 18,
                    'gst_amount' => 54,
                    'total_amount' => 354,
                ],
            ]);
    }

    public function test_member_verification_with_allow_with_warning_dues_policy(): void
    {
        CurrentGym::run($this->gym, function () {
            $this->member->update(['outstanding_balance' => 500]);
        });

        $response = $this->postJson('/api/self-check-in/verify-member', [
            'token' => $this->qrCode->token,
            'phone' => '9822000001',
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'member' => [
                    'id' => $this->member->id,
                    'outstanding_balance' => 500,
                ],
            ]);

        $this->assertNotNull($response->json('confirmation_token'));
        $this->assertStringContainsString('500', $response->json('member.dues_warning'));
    }

    public function test_member_verification_blocked_when_dues_policy_is_block_until_paid(): void
    {
        CurrentGym::run($this->gym, function () {
            $this->gym->update(['settings' => array_merge($this->gym->settings, ['dues_policy' => 'block_until_paid'])]);
            $this->member->update(['outstanding_balance' => 750]);
        });

        $response = $this->postJson('/api/self-check-in/verify-member', [
            'token' => $this->qrCode->token,
            'phone' => '9822000001',
        ]);

        $response->assertStatus(422)
            ->assertJson([
                'dues_blocked' => true,
                'outstanding_balance' => 750,
            ]);
    }

    public function test_successful_member_confirm_records_attendance_with_person_type_member(): void
    {
        // 1. Verify member to obtain signed HMAC confirmation token
        $verifyRes = $this->postJson('/api/self-check-in/verify-member', [
            'token' => $this->qrCode->token,
            'phone' => '9822000001',
        ]);

        $confirmationToken = $verifyRes->json('confirmation_token');

        // 2. Confirm check-in
        $confirmRes = $this->postJson('/api/self-check-in/confirm', [
            'token' => $this->qrCode->token,
            'confirmation_token' => $confirmationToken,
        ]);

        $confirmRes->assertStatus(201)
            ->assertJson([
                'success' => true,
                'member_name' => 'Aarav Sharma',
            ]);

        $this->assertDatabaseHas('attendance_logs', [
            'gym_id' => $this->gym->id,
            'branch_id' => $this->branch->id,
            'member_id' => $this->member->id,
            'person_type' => 'member',
            'method' => 'qr_self_check_in',
        ]);
    }

    public function test_prevents_duplicate_member_checkin_today(): void
    {
        // Mark first check-in
        AttendanceLog::create([
            'gym_id' => $this->gym->id,
            'branch_id' => $this->branch->id,
            'member_id' => $this->member->id,
            'person_type' => 'member',
            'check_in_at' => now()->subHours(2),
            'method' => 'manual',
        ]);

        $response = $this->postJson('/api/self-check-in/verify-member', [
            'token' => $this->qrCode->token,
            'phone' => '9822000001',
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'already_checked_in' => true,
            ]);
    }

    public function test_visitor_pass_order_creation_with_pricing_and_taxes(): void
    {
        $response = $this->postJson('/api/self-check-in/visitor-order', [
            'token' => $this->qrCode->token,
            'full_name' => 'Kunal Deshmukh',
            'phone' => '9876500000',
            'email' => 'kunal@deshmukh.in',
            'gender' => 'male',
        ]);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'pricing' => [
                    'base_price' => 300,
                    'gst_rate' => 18,
                    'gst_amount' => 54,
                    'total_amount' => 354,
                ],
                'visitor' => [
                    'full_name' => 'Kunal Deshmukh',
                    'phone' => '9876500000',
                ],
            ]);

        $passCode = $response->json('pass_code');
        $this->assertDatabaseHas('visitor_passes', [
            'pass_code' => $passCode,
            'full_name' => 'Kunal Deshmukh',
            'payment_status' => 'pending',
            'total_amount' => 354,
        ]);
    }

    public function test_visitor_payment_verification_activates_pass_and_records_attendance(): void
    {
        // 1. Order pending pass
        $orderRes = $this->postJson('/api/self-check-in/visitor-order', [
            'token' => $this->qrCode->token,
            'full_name' => 'Sneha Patil',
            'phone' => '9876500002',
            'gender' => 'female',
        ]);

        $passCode = $orderRes->json('pass_code');
        $orderId = $orderRes->json('order_id');

        // 2. Verify payment
        $verifyRes = $this->postJson('/api/self-check-in/visitor-verify-payment', [
            'pass_code' => $passCode,
            'razorpay_payment_id' => 'pay_test_998811',
            'razorpay_order_id' => $orderId,
        ]);

        $verifyRes->assertStatus(200)
            ->assertJson([
                'success' => true,
                'pass' => [
                    'pass_code' => $passCode,
                    'payment_status' => 'paid',
                ],
            ]);

        // Check visitor pass updated
        $pass = VisitorPass::withoutGlobalScopes()->where('pass_code', $passCode)->first();
        $this->assertNotNull($pass);
        $this->assertEquals('paid', $pass->payment_status);
        $this->assertNotNull($pass->attendance_log_id);

        // Check attendance log created for visitor
        $this->assertDatabaseHas('attendance_logs', [
            'id' => $pass->attendance_log_id,
            'gym_id' => $this->gym->id,
            'branch_id' => $this->branch->id,
            'member_id' => null,
            'person_type' => 'visitor',
            'visitor_pass_id' => $pass->id,
            'qr_reference' => $passCode,
        ]);
    }

    public function test_payment_verification_is_idempotent(): void
    {
        $pass = VisitorPass::create([
            'gym_id' => $this->gym->id,
            'branch_id' => $this->branch->id,
            'pass_code' => 'VP-MAIN-TEST99',
            'full_name' => 'Idempotent Tester',
            'phone' => '9988776655',
            'base_amount' => 300,
            'gst_rate' => 18,
            'gst_amount' => 54,
            'total_amount' => 354,
            'currency' => 'INR',
            'payment_method' => 'razorpay',
            'payment_status' => 'paid',
            'valid_on' => now()->toDateString(),
            'check_in_at' => now(),
            'expires_at' => now()->endOfDay(),
        ]);

        $initialLogsCount = AttendanceLog::count();

        // Calling verify again on already-paid pass
        $response = $this->postJson('/api/self-check-in/visitor-verify-payment', [
            'pass_code' => 'VP-MAIN-TEST99',
            'razorpay_payment_id' => 'pay_dup_001',
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'already_confirmed' => true,
            ]);

        // Count of attendance logs should NOT increase
        $this->assertEquals($initialLogsCount, AttendanceLog::count());
    }

    public function test_staff_can_manual_register_walkin_visitor_with_cash(): void
    {
        $response = $this->actingAs($this->owner)->postJson('/api/visitor-passes/manual-register', [
            'branch_id' => $this->branch->id,
            'full_name' => 'Walk-In Customer',
            'phone' => '9890012345',
            'gender' => 'male',
            'payment_method' => 'cash',
            'notes' => 'Direct counter walk-in',
        ]);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'pass' => [
                    'full_name' => 'Walk-In Customer',
                    'payment_method' => 'cash',
                    'payment_status' => 'paid',
                ],
            ]);

        $this->assertDatabaseHas('attendance_logs', [
            'gym_id' => $this->gym->id,
            'branch_id' => $this->branch->id,
            'person_type' => 'visitor',
            'method' => 'front_desk',
            'verified_by_user_id' => $this->owner->id,
        ]);
    }

    public function test_staff_can_list_visitor_passes_with_stats(): void
    {
        $response = $this->actingAs($this->owner)->getJson('/api/visitor-passes?timeframe=today');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'data',
                'stats' => [
                    'today_passes_count',
                    'today_revenue',
                    'today_pending',
                    'month_passes_count',
                ],
            ]);
    }

    public function test_turnstile_scanner_endpoint_can_checkin_member_pass(): void
    {
        $response = $this->actingAs($this->owner)->postJson('/api/attendance/scan-member-pass', [
            'pass_payload' => $this->member->member_code,
            'branch_id' => $this->branch->id,
        ]);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'member' => [
                    'member_code' => 'ICF-0001',
                ],
            ]);

        $this->assertDatabaseHas('attendance_logs', [
            'member_id' => $this->member->id,
            'person_type' => 'member',
            'method' => 'turnstile_qr',
        ]);
    }
}
