<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\Gym;
use App\Models\Lead;
use App\Models\Member;
use App\Models\MemberMembership;
use App\Models\MembershipPlan;
use App\Models\Payment;
use App\Models\PtSession;
use App\Models\SaasPlan;
use App\Models\User;
use App\Support\CurrentBranch;
use App\Support\CurrentGym;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class GymEngineBusinessTest extends TestCase
{
    use RefreshDatabase;

    protected Gym $gym;
    protected Branch $branch;
    protected User $owner;
    protected User $trainer;
    protected MembershipPlan $plan;

    protected function setUp(): void
    {
        parent::setUp();

        $saasPlan = SaasPlan::create([
            'name' => 'Growth',
            'code' => 'growth',
            'price' => 4999.00,
            'interval' => 'month',
            'branch_limit' => 5,
            'member_limit' => 1000,
            'features' => ['all'],
            'is_active' => true,
        ]);

        $this->gym = Gym::create([
            'name' => 'Titan Gym',
            'slug' => 'titan',
            'currency' => 'INR',
            'status' => Gym::STATUS_ACTIVE,
            'saas_plan_id' => $saasPlan->id,
            'subscription_expires_at' => now()->addDays(60),
        ]);

        CurrentGym::run($this->gym, function () {
            $this->branch = Branch::create([
                'gym_id' => $this->gym->id,
                'name' => 'Titan Flagship',
                'code' => 'T-FLG',
                'is_primary' => true,
                'is_active' => true,
            ]);

            $this->owner = User::create([
                'gym_id' => $this->gym->id,
                'primary_branch_id' => $this->branch->id,
                'name' => 'Titan Owner',
                'email' => 'owner@titan.test',
                'password' => bcrypt('password123'),
                'role' => User::ROLE_GYM_OWNER,
                'is_active' => true,
            ]);
            $this->branch->staff()->attach($this->owner->id, ['gym_id' => $this->gym->id]);

            $this->trainer = User::create([
                'gym_id' => $this->gym->id,
                'primary_branch_id' => $this->branch->id,
                'name' => 'Coach Kabir',
                'email' => 'kabir@titan.test',
                'password' => bcrypt('password123'),
                'role' => User::ROLE_TRAINER,
                'specialization' => 'Powerlifting & Rehab',
                'base_salary' => 40000,
                'pt_session_rate' => 750,
                'is_active' => true,
            ]);
            $this->branch->staff()->attach($this->trainer->id, ['gym_id' => $this->gym->id]);

            $this->plan = MembershipPlan::create([
                'gym_id' => $this->gym->id,
                'branch_id' => $this->branch->id,
                'name' => 'Quarterly Beast',
                'category' => 'quarterly',
                'duration_days' => 90,
                'price' => 6000.00,
                'max_freeze_days' => 15,
                'is_active' => true,
            ]);
        });
    }

    protected function authHeaders(): array
    {
        return [
            'Authorization' => 'Bearer ' . $this->owner->createToken('test')->plainTextToken,
            'X-Gym-Slug' => $this->gym->slug,
            'X-Branch-Id' => (string) $this->branch->id,
        ];
    }

    public function test_member_registration_with_photo_and_trainer_assignment(): void
    {
        $response = $this->withHeaders($this->authHeaders())->postJson('/api/members', [
            'first_name' => 'Ranveer',
            'last_name' => 'Singh',
            'phone' => '9876543210',
            'email' => 'ranveer@test.com',
            'gender' => 'male',
            'assigned_trainer_id' => $this->trainer->id,
            'photo_data' => 'data:image/jpeg;base64,/9j/4AAQSkZJRg...',
            'membership_plan_id' => $this->plan->id,
            'paid_amount' => 4000.00,
            'discount_amount' => 500.00,
            'payment_method' => 'upi',
        ]);

        $response->assertStatus(201);
        $data = $response->json();

        $this->assertEquals('Ranveer Singh', $data['first_name'] . ' ' . $data['last_name']);
        $this->assertStringStartsWith('MEM-', $data['member_code']);
        $this->assertEquals($this->trainer->id, $data['assigned_trainer_id']);

        // Check outstanding balance: Final price = 6000 - 500 = 5500. Paid = 4000. Due = 1500.
        $member = Member::find($data['id']);
        $this->assertEquals(5500.00, (float) $member->total_fees_billed);
        $this->assertEquals(4000.00, (float) $member->total_fees_paid);
        $this->assertEquals(1500.00, (float) $member->outstanding_balance);
    }

    public function test_membership_freeze_unfreeze_and_extension(): void
    {
        // 1. Create member and membership
        CurrentGym::run($this->gym, function () {
            $member = Member::create([
                'gym_id' => $this->gym->id,
                'primary_branch_id' => $this->branch->id,
                'member_code' => 'MEM-FREEZE',
                'first_name' => 'Deepika',
                'last_name' => 'Padukone',
                'phone' => '9822334455',
                'status' => 'active',
            ]);

            $sub = MemberMembership::create([
                'gym_id' => $this->gym->id,
                'branch_id' => $this->branch->id,
                'member_id' => $member->id,
                'membership_plan_id' => $this->plan->id,
                'start_date' => now()->toDateString(),
                'end_date' => now()->addDays(90)->toDateString(),
                'status' => 'active',
                'total_price' => 6000,
                'final_price' => 6000,
                'price_paid' => 6000,
            ]);

            // Freeze
            $freezeRes = $this->withHeaders($this->authHeaders())->postJson("/api/member-memberships/{$sub->id}/freeze", [
                'freeze_days' => 10,
                'reason' => 'Traveling for shoot',
            ]);
            $freezeRes->assertStatus(200);
            $this->assertEquals('frozen', $sub->fresh()->status);

            // Unfreeze
            $unfreezeRes = $this->withHeaders($this->authHeaders())->postJson("/api/member-memberships/{$sub->id}/unfreeze");
            $unfreezeRes->assertStatus(200);
            $this->assertEquals('active', $sub->fresh()->status);

            // Manual Extension
            $extendRes = $this->withHeaders($this->authHeaders())->postJson("/api/member-memberships/{$sub->id}/extend", [
                'days' => 7,
                'reason' => 'Goodwill Diwali Extension',
            ]);
            $extendRes->assertStatus(200);
            $this->assertEquals(7, $sub->fresh()->extended_days);
        });
    }

    public function test_membership_cancellation_with_refund_and_balance_update(): void
    {
        CurrentGym::run($this->gym, function () {
            $member = Member::create([
                'gym_id' => $this->gym->id,
                'primary_branch_id' => $this->branch->id,
                'member_code' => 'MEM-CANCEL',
                'first_name' => 'Varun',
                'last_name' => 'Dhawan',
                'phone' => '9877001122',
                'status' => 'active',
            ]);

            $sub = MemberMembership::create([
                'gym_id' => $this->gym->id,
                'branch_id' => $this->branch->id,
                'member_id' => $member->id,
                'membership_plan_id' => $this->plan->id,
                'start_date' => now()->toDateString(),
                'end_date' => now()->addDays(90)->toDateString(),
                'status' => 'active',
                'total_price' => 6000,
                'final_price' => 6000,
                'price_paid' => 6000,
            ]);

            Payment::create([
                'gym_id' => $this->gym->id,
                'branch_id' => $this->branch->id,
                'member_id' => $member->id,
                'member_membership_id' => $sub->id,
                'receipt_number' => 'REC-CANCEL-1',
                'type' => 'payment',
                'amount' => 6000,
                'payment_method' => 'card',
                'payment_date' => now()->toDateString(),
                'status' => 'completed',
                'collected_by_user_id' => $this->owner->id,
            ]);
            $member->recalculateBalances();

            // Cancel with refund of 4000
            $cancelRes = $this->withHeaders($this->authHeaders())->postJson("/api/member-memberships/{$sub->id}/cancel", [
                'reason' => 'Relocated to London',
                'refund_amount' => 4000.00,
                'refund_payment_method' => 'bank_transfer',
            ]);

            $cancelRes->assertStatus(200);
            $this->assertEquals('cancelled', $sub->fresh()->status);

            // Refund payment recorded
            $this->assertDatabaseHas('payments', [
                'gym_id' => $this->gym->id,
                'member_id' => $member->id,
                'type' => 'refund',
                'amount' => 4000.00,
            ]);
        });
    }

    public function test_attendance_qr_checkin_and_duplicate_prevention(): void
    {
        CurrentGym::run($this->gym, function () {
            $member = Member::create([
                'gym_id' => $this->gym->id,
                'primary_branch_id' => $this->branch->id,
                'member_code' => 'MEM-QR1',
                'first_name' => 'Alia',
                'last_name' => 'Bhatt',
                'phone' => '9811002233',
                'status' => 'active',
            ]);

            MemberMembership::create([
                'gym_id' => $this->gym->id,
                'branch_id' => $this->branch->id,
                'member_id' => $member->id,
                'membership_plan_id' => $this->plan->id,
                'start_date' => now()->subDays(5)->toDateString(),
                'end_date' => now()->addDays(85)->toDateString(),
                'status' => 'active',
                'price_paid' => 6000,
            ]);

            // First QR Scan -> Check In
            $res1 = $this->withHeaders($this->authHeaders())->postJson('/api/attendance/qr-check-in', [
                'qr_data' => $member->member_code,
            ]);
            $res1->assertStatus(201);
            $this->assertEquals('checked_in', $res1->json('action'));
            $this->assertFalse($res1->json('is_expired'));

            // Second QR Scan immediately -> Duplicate Warning
            $res2 = $this->withHeaders($this->authHeaders())->postJson('/api/attendance/qr-check-in', [
                'qr_data' => $member->member_code,
            ]);
            $res2->assertStatus(200);
            $this->assertTrue($res2->json('already_inside'));
        });
    }

    public function test_expense_crud_and_daily_cash_closing(): void
    {
        // 1. Record expense
        $expenseRes = $this->withHeaders($this->authHeaders())->postJson('/api/expenses', [
            'title' => 'Mineral Water Dispensers',
            'category' => 'other',
            'amount' => 1200.00,
            'payment_mode' => 'cash',
            'expense_date' => now()->toDateString(),
            'vendor_name' => 'Bisleri Mumbai',
        ]);
        $expenseRes->assertStatus(201);

        // 2. Query live cash closing register
        $currentClosing = $this->withHeaders($this->authHeaders())->getJson('/api/cash-closings/current');
        $currentClosing->assertStatus(200);
        $this->assertEquals(1200.00, (float) $currentClosing->json('summary.cash_expenses'));

        // 3. Submit cash closing with discrepancy
        $closeRes = $this->withHeaders($this->authHeaders())->postJson('/api/cash-closings/close', [
            'opening_cash' => 0,
            'actual_cash_in_hand' => 500.00,
            'notes' => 'Evening shift closed.',
        ]);
        $closeRes->assertStatus(200);
        $this->assertEquals('closed', $closeRes->json('closing.status'));
    }

    public function test_lead_crm_enquiry_to_member_conversion(): void
    {
        // 1. Create Lead
        $leadRes = $this->withHeaders($this->authHeaders())->postJson('/api/leads', [
            'name' => 'Vicky Kaushal',
            'phone' => '9833445566',
            'email' => 'vicky@bollywood.in',
            'source' => 'instagram',
            'fitness_goal' => 'muscle_gain',
            'followup_date' => now()->addDays(2)->toDateString(),
        ]);
        $leadRes->assertStatus(201);
        $leadId = $leadRes->json('id');

        // 2. Add Follow-up
        $followRes = $this->withHeaders($this->authHeaders())->postJson("/api/leads/{$leadId}/follow-up", [
            'type' => 'call',
            'summary' => 'Client agreed to join on Quarterly Beast plan.',
            'next_followup_date' => now()->addDays(3)->toDateString(),
        ]);
        $followRes->assertStatus(200);

        // 3. 1-Click Convert to Member with immediate plan enrolment
        $convertRes = $this->withHeaders($this->authHeaders())->postJson("/api/leads/{$leadId}/convert", [
            'gender' => 'male',
            'membership_plan_id' => $this->plan->id,
            'paid_amount' => 6000.00,
            'payment_method' => 'upi',
        ]);
        $convertRes->assertStatus(200);
        $this->assertEquals('converted', $convertRes->json('lead.status'));

        $memberId = $convertRes->json('member.id');
        $this->assertDatabaseHas('members', [
            'id' => $memberId,
            'first_name' => 'Vicky',
            'status' => 'active',
        ]);
    }

    public function test_trainer_pt_sessions_and_performance_report(): void
    {
        CurrentGym::run($this->gym, function () {
            $member = Member::create([
                'gym_id' => $this->gym->id,
                'primary_branch_id' => $this->branch->id,
                'member_code' => 'MEM-PT1',
                'first_name' => 'Kartik',
                'last_name' => 'Aaryan',
                'phone' => '9811223344',
                'status' => 'active',
            ]);

            // Schedule session
            $schedRes = $this->withHeaders($this->authHeaders())->postJson('/api/pt-sessions', [
                'trainer_id' => $this->trainer->id,
                'member_id' => $member->id,
                'session_date' => now()->toDateString(),
                'start_time' => '10:00:00',
                'duration_minutes' => 60,
                'trainer_notes' => 'Bench press and chest accessory work.',
            ]);
            $schedRes->assertStatus(201);
            $sessionId = $schedRes->json('session.id');

            // Complete session
            $compRes = $this->withHeaders($this->authHeaders())->postJson("/api/pt-sessions/{$sessionId}/complete", [
                'trainer_notes' => 'Session finished on time with 80kg PR.',
                'client_feedback' => 'Great pump!',
            ]);
            $compRes->assertStatus(200);
            $this->assertEquals('completed', $compRes->json('session.status'));

            // Trainer performance report
            $reportRes = $this->withHeaders($this->authHeaders())->getJson('/api/trainers/performance-report');
            $reportRes->assertStatus(200);
            $this->assertNotEmpty($reportRes->json('trainers'));
        });
    }

    public function test_reports_and_csv_export(): void
    {
        // Daily Report
        $dailyRes = $this->withHeaders($this->authHeaders())->getJson('/api/reports/daily');
        $dailyRes->assertStatus(200);
        $this->assertArrayHasKey('net_collections', $dailyRes->json());
        $this->assertArrayHasKey('collections_by_method', $dailyRes->json());

        // Monthly Report
        $monthlyRes = $this->withHeaders($this->authHeaders())->getJson('/api/reports/monthly');
        $monthlyRes->assertStatus(200);
        $this->assertArrayHasKey('net_operating_profit', $monthlyRes->json());

        // CSV Export for members
        $csvRes = $this->withHeaders($this->authHeaders())->get('/api/reports/export/members');
        $csvRes->assertStatus(200);
        $this->assertStringContainsString('text/csv', $csvRes->headers->get('content-type'));
    }
}
