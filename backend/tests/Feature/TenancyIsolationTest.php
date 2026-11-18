<?php

namespace Tests\Feature;

use App\Models\AttendanceLog;
use App\Models\Branch;
use App\Models\Gym;
use App\Models\Member;
use App\Models\MembershipPlan;
use App\Models\Payment;
use App\Models\SaasPlan;
use App\Models\User;
use App\Support\CurrentGym;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class TenancyIsolationTest extends TestCase
{
    use RefreshDatabase;

    private Gym $gymA;
    private Gym $gymB;
    private User $ownerA;
    private User $ownerB;
    private Branch $branchA;
    private Branch $branchB;
    private Member $memberA;
    private MembershipPlan $planA;
    private Payment $paymentA;
    private AttendanceLog $attendanceA;

    protected function setUp(): void
    {
        parent::setUp();

        // 1. SaaS Plan
        $saasPlan = SaasPlan::create([
            'name' => 'Growth Pro',
            'code' => 'growth',
            'price' => 4999.00,
            'interval' => 'month',
            'branch_limit' => 3,
            'member_limit' => 1000,
            'is_active' => true,
        ]);

        // 2. Setup Gym A
        $this->gymA = Gym::create([
            'name' => 'Gym Alpha',
            'slug' => 'gym-alpha',
            'email' => 'contact@alpha.com',
            'phone' => '9000000001',
            'status' => Gym::STATUS_ACTIVE,
            'saas_plan_id' => $saasPlan->id,
            'subscription_expires_at' => now()->addDays(30),
        ]);

        CurrentGym::run($this->gymA, function () {
            $this->branchA = Branch::create([
                'gym_id' => $this->gymA->id,
                'name' => 'Alpha Main',
                'is_primary' => true,
            ]);

            $this->ownerA = User::create([
                'gym_id' => $this->gymA->id,
                'primary_branch_id' => $this->branchA->id,
                'name' => 'Owner Alpha',
                'email' => 'owner@alpha.com',
                'phone' => '9000000001',
                'password' => Hash::make('password123'),
                'role' => User::ROLE_GYM_OWNER,
                'is_active' => true,
            ]);

            $this->planA = MembershipPlan::create([
                'gym_id' => $this->gymA->id,
                'name' => 'Alpha 30-Day',
                'duration_days' => 30,
                'price' => 2000.00,
                'is_active' => true,
            ]);

            $this->memberA = Member::create([
                'gym_id' => $this->gymA->id,
                'primary_branch_id' => $this->branchA->id,
                'member_code' => 'ALP-001',
                'first_name' => 'Rahul',
                'last_name' => 'Verma',
                'phone' => '9888888881',
                'status' => 'active',
            ]);

            $this->paymentA = Payment::create([
                'gym_id' => $this->gymA->id,
                'branch_id' => $this->branchA->id,
                'member_id' => $this->memberA->id,
                'amount' => 2000.00,
                'payment_method' => 'cash',
                'payment_date' => now()->toDateString(),
                'status' => 'completed',
            ]);

            $this->attendanceA = AttendanceLog::create([
                'gym_id' => $this->gymA->id,
                'branch_id' => $this->branchA->id,
                'member_id' => $this->memberA->id,
                'check_in_at' => now(),
            ]);
        });

        // 3. Setup Gym B
        $this->gymB = Gym::create([
            'name' => 'Gym Beta',
            'slug' => 'gym-beta',
            'email' => 'contact@beta.com',
            'phone' => '9000000002',
            'status' => Gym::STATUS_ACTIVE,
            'saas_plan_id' => $saasPlan->id,
            'subscription_expires_at' => now()->addDays(30),
        ]);

        CurrentGym::run($this->gymB, function () {
            $this->branchB = Branch::create([
                'gym_id' => $this->gymB->id,
                'name' => 'Beta Central',
                'is_primary' => true,
            ]);

            $this->ownerB = User::create([
                'gym_id' => $this->gymB->id,
                'primary_branch_id' => $this->branchB->id,
                'name' => 'Owner Beta',
                'email' => 'owner@beta.com',
                'phone' => '9000000002',
                'password' => Hash::make('password123'),
                'role' => User::ROLE_GYM_OWNER,
                'is_active' => true,
            ]);
        });
    }

    /**
     * Test 1: Gym B authenticated user cannot see or find Gym A's records by ID (fail-closed, 404).
     */
    public function test_gym_b_cannot_find_gym_a_records_by_id(): void
    {
        Sanctum::actingAs($this->ownerB);

        $this->getJson("/api/members/{$this->memberA->id}")->assertNotFound();
        $this->putJson("/api/members/{$this->memberA->id}", ['first_name' => 'Hacked'])->assertNotFound();
        $this->deleteJson("/api/members/{$this->memberA->id}")->assertNotFound();

        $this->getJson("/api/branches/{$this->branchA->id}")->assertNotFound();
        $this->getJson("/api/membership-plans/{$this->planA->id}")->assertNotFound();
        $this->getJson("/api/payments/{$this->paymentA->id}")->assertNotFound();

        // Verify Gym A record remains untouched
        CurrentGym::run($this->gymA, function () {
            $this->assertSame('Rahul', Member::findOrFail($this->memberA->id)->first_name);
        });
    }

    /**
     * Test 2: Gym B list endpoints show only Gym B's data (0 count for Gym B initially).
     */
    public function test_lists_and_dashboards_contain_only_own_tenant_data(): void
    {
        Sanctum::actingAs($this->ownerB);

        $this->getJson('/api/members')->assertOk()->assertJsonCount(0, 'data');
        $this->getJson('/api/membership-plans')->assertOk()->assertJsonCount(0);
        $this->getJson('/api/payments')->assertOk()->assertJsonCount(0, 'payments.data');
        $this->getJson('/api/branches')->assertOk()->assertJsonCount(1); // Only Beta Central

        $this->getJson('/api/dashboard')->assertOk()
            ->assertJsonPath('metrics.total_members', 0)
            ->assertJsonPath('metrics.today_revenue', 0);

        // Gym A still sees its own data
        Sanctum::actingAs($this->ownerA);
        $this->getJson('/api/members')->assertOk()->assertJsonCount(1, 'data');
        $this->getJson('/api/dashboard')->assertOk()->assertJsonPath('metrics.total_members', 1);
    }

    /**
     * Test 3: Gym B cannot record payments or check-ins against Gym A's member (returns 404 Not Found due to fail-closed scope).
     */
    public function test_cannot_write_against_another_gyms_member(): void
    {
        Sanctum::actingAs($this->ownerB);

        // Attempting to create a payment for Gym A's member fails because Gym A's member does not exist in Gym B's scope
        $this->postJson('/api/payments', [
            'member_id' => $this->memberA->id,
            'amount' => 500,
            'payment_method' => 'cash',
        ])->assertNotFound();

        // Check-in attempt also cannot find member
        $this->postJson('/api/attendance/check-in', [
            'member_id' => $this->memberA->id,
        ])->assertNotFound();
    }

    /**
     * Test 4: Idempotent payment recording with client_uuid.
     */
    public function test_idempotent_outbox_payment_sync(): void
    {
        Sanctum::actingAs($this->ownerA);

        $clientUuid = (string) Str::uuid();

        $res1 = $this->postJson('/api/payments', [
            'member_id' => $this->memberA->id,
            'amount' => 1500.00,
            'payment_method' => 'upi',
            'client_uuid' => $clientUuid,
        ])->assertCreated();

        $paymentId1 = $res1->json('id');

        // Resending identical client_uuid (simulating offline outbox replay)
        $res2 = $this->postJson('/api/payments', [
            'member_id' => $this->memberA->id,
            'amount' => 1500.00,
            'payment_method' => 'upi',
            'client_uuid' => $clientUuid,
        ])->assertOk();

        $paymentId2 = $res2->json('id');

        $this->assertSame($paymentId1, $paymentId2);
        $this->assertSame(1, Payment::where('client_uuid', $clientUuid)->count());
    }

    /**
     * Test 5: Suspended gym account cannot access API (receives 403 gym_suspended).
     */
    public function test_suspended_gym_is_forbidden(): void
    {
        $this->gymA->update(['status' => Gym::STATUS_SUSPENDED]);

        Sanctum::actingAs($this->ownerA);

        $this->getJson('/api/dashboard')->assertForbidden()
            ->assertJsonPath('code', 'gym_suspended');

        $this->getJson('/api/members')->assertForbidden()
            ->assertJsonPath('code', 'gym_suspended');
    }

    /**
     * Test 6: Expired gym is locked out of business routes, but billing routes stay open for renewal.
     */
    public function test_expired_gym_locks_business_routes_but_permits_billing(): void
    {
        $this->gymA->update([
            'status' => Gym::STATUS_ACTIVE,
            'subscription_expires_at' => now()->subDay(),
        ]);

        Sanctum::actingAs($this->ownerA);

        // Business route locked
        $this->getJson('/api/dashboard')->assertForbidden()
            ->assertJsonPath('code', 'gym_expired');

        // Billing route open so owner can renew
        $this->getJson('/api/billing')->assertOk()
            ->assertJsonPath('gym.expired', true);
    }

    /**
     * Test 7: Super Admin cannot directly access business tenant routes without gym context.
     */
    public function test_super_admin_cannot_use_business_api_directly(): void
    {
        $superAdmin = User::create([
            'gym_id' => null,
            'name' => 'Super Admin',
            'email' => 'superadmin@test.com',
            'password' => Hash::make('password123'),
            'role' => User::ROLE_SUPER_ADMIN,
            'is_active' => true,
        ]);

        Sanctum::actingAs($superAdmin);

        $this->getJson('/api/dashboard')->assertForbidden()->assertJsonPath('code', 'no_gym');
        $this->getJson('/api/members')->assertForbidden()->assertJsonPath('code', 'no_gym');

        // But admin overview route succeeds
        $this->getJson('/api/admin/overview')->assertOk()
            ->assertJsonPath('metrics.total_gyms', 2);
    }
}
