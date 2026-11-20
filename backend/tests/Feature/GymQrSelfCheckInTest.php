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
use App\Support\CurrentGym;
use App\Support\ModuleRegistry;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class GymQrSelfCheckInTest extends TestCase
{
    use RefreshDatabase;

    protected Gym $gymA;
    protected Gym $gymB;
    protected Branch $branchA1;
    protected Branch $branchA2;
    protected Branch $branchB1;
    protected User $ownerA;
    protected User $ownerB;
    protected Member $memberA;
    protected Member $memberB;
    protected MembershipPlan $planA;
    protected MemberMembership $subA;

    protected function setUp(): void
    {
        parent::setUp();

        $allModules = array_keys(ModuleRegistry::all());

        $plan = SaasPlan::create([
            'name' => 'Pro Enterprise',
            'code' => 'pro-enterprise',
            'branch_limit' => 5,
            'member_limit' => 1000,
            'price' => 4999,
            'interval' => 'month',
            'features' => ['all'],
            'modules' => $allModules,
            'is_active' => true,
        ]);

        $this->gymA = Gym::create([
            'name' => 'Iron Fortress Gym',
            'slug' => 'iron-fortress',
            'saas_plan_id' => $plan->id,
            'subscription_status' => 'active',
            'subscription_expires_at' => now()->addYear(),
            'phone' => '9876543210',
            'email' => 'owner@ironfortress.com',
            'status' => Gym::STATUS_ACTIVE,
            'modules' => $allModules,
        ]);

        $this->gymB = Gym::create([
            'name' => 'Spartan Fitness',
            'slug' => 'spartan-fitness',
            'saas_plan_id' => $plan->id,
            'subscription_status' => 'active',
            'subscription_expires_at' => now()->addYear(),
            'phone' => '9876543211',
            'email' => 'owner@spartan.com',
            'status' => Gym::STATUS_ACTIVE,
            'modules' => $allModules,
        ]);

        CurrentGym::run($this->gymA, function () {
            $this->branchA1 = Branch::create([
                'gym_id' => $this->gymA->id,
                'name' => 'Main Downtown Branch',
                'code' => 'MAIN',
                'address' => '101 MG Road, Pune',
                'city' => 'Pune',
                'is_primary' => true,
                'is_active' => true,
            ]);

            $this->branchA2 = Branch::create([
                'gym_id' => $this->gymA->id,
                'name' => 'Kothrud Sub Branch',
                'code' => 'KOTH',
                'address' => '202 Paud Road, Pune',
                'city' => 'Pune',
                'is_primary' => false,
                'is_active' => true,
            ]);

            $this->ownerA = User::create([
                'gym_id' => $this->gymA->id,
                'primary_branch_id' => $this->branchA1->id,
                'name' => 'Vikram Deshmukh',
                'email' => 'vikram@ironfortress.com',
                'phone' => '9876543210',
                'password' => bcrypt('password123'),
                'role' => User::ROLE_GYM_OWNER,
                'is_active' => true,
            ]);

            $this->branchA1->staff()->attach($this->ownerA->id, ['gym_id' => $this->gymA->id]);
            $this->branchA2->staff()->attach($this->ownerA->id, ['gym_id' => $this->gymA->id]);

            $this->planA = MembershipPlan::create([
                'gym_id' => $this->gymA->id,
                'branch_id' => $this->branchA1->id,
                'name' => 'Annual Gold Membership',
                'duration_days' => 365,
                'price' => 12000,
                'is_active' => true,
            ]);

            $this->memberA = Member::create([
                'gym_id' => $this->gymA->id,
                'primary_branch_id' => $this->branchA1->id,
                'member_code' => 'MEM-A001',
                'first_name' => 'Rahul',
                'last_name' => 'Sharma',
                'phone' => '9822011223',
                'status' => 'active',
                'joined_date' => now()->subMonth(),
            ]);

            $this->subA = MemberMembership::create([
                'gym_id' => $this->gymA->id,
                'branch_id' => $this->branchA1->id,
                'member_id' => $this->memberA->id,
                'membership_plan_id' => $this->planA->id,
                'start_date' => now()->subMonth(),
                'end_date' => now()->addMonths(11),
                'total_price' => 12000,
                'final_price' => 12000,
                'price_paid' => 12000,
                'balance_due' => 0,
                'status' => 'active',
            ]);
        });

        CurrentGym::run($this->gymB, function () {
            $this->branchB1 = Branch::create([
                'gym_id' => $this->gymB->id,
                'name' => 'Spartan Branch 1',
                'code' => 'SP1',
                'address' => '303 FC Road, Pune',
                'city' => 'Pune',
                'is_primary' => true,
                'is_active' => true,
            ]);

            $this->ownerB = User::create([
                'gym_id' => $this->gymB->id,
                'primary_branch_id' => $this->branchB1->id,
                'name' => 'Rohan Patil',
                'email' => 'rohan@spartan.com',
                'phone' => '9876543211',
                'password' => bcrypt('password123'),
                'role' => User::ROLE_GYM_OWNER,
                'is_active' => true,
            ]);

            $this->branchB1->staff()->attach($this->ownerB->id, ['gym_id' => $this->gymB->id]);

            $this->memberB = Member::create([
                'gym_id' => $this->gymB->id,
                'primary_branch_id' => $this->branchB1->id,
                'member_code' => 'MEM-B001',
                'first_name' => 'Amit',
                'last_name' => 'Jadhav',
                'phone' => '9822099887',
                'status' => 'active',
                'joined_date' => now()->subMonth(),
            ]);
        });
    }

    public function test_owner_can_generate_and_list_branch_specific_qr_codes(): void
    {
        $response = $this->actingAs($this->ownerA)
            ->postJson('/api/attendance/qr-codes', [
                'branch_id' => $this->branchA1->id,
                'name' => 'Main Gate Entrance Poster',
            ]);

        $response->assertStatus(201);
        $qr = $response->json('qr');
        $this->assertNotEmpty($qr['token']);
        $this->assertNotEmpty($qr['code']);
        $this->assertStringStartsWith('gymqr_', $qr['token']);
        $this->assertStringStartsWith('QR-MAIN-', $qr['code']);

        // Generate second QR for second branch
        $resBranch2 = $this->actingAs($this->ownerA)
            ->postJson('/api/attendance/qr-codes', [
                'branch_id' => $this->branchA2->id,
                'name' => 'Kothrud Entrance QR',
            ]);
        $resBranch2->assertStatus(201);
        $this->assertStringStartsWith('QR-KOTH-', $resBranch2->json('qr.code'));

        // List QR codes
        $listRes = $this->actingAs($this->ownerA)
            ->getJson('/api/attendance/qr-codes');
        $listRes->assertStatus(200);
        $this->assertCount(2, $listRes->json('data'));

        // Filter by branch
        $filterRes = $this->actingAs($this->ownerA)
            ->getJson('/api/attendance/qr-codes?branch_id=' . $this->branchA1->id);
        $filterRes->assertStatus(200);
        $this->assertCount(1, $filterRes->json('data'));
        $this->assertEquals($this->branchA1->id, $filterRes->json('data.0.branch_id'));
    }

    public function test_owner_can_regenerate_qr_invalidating_old_token(): void
    {
        $qr = GymQrCode::createUnique($this->gymA->id, $this->branchA1->id);
        $oldToken = $qr->token;
        $oldCode = $qr->code;

        $response = $this->actingAs($this->ownerA)
            ->postJson("/api/attendance/qr-codes/{$qr->id}/regenerate");

        $response->assertStatus(200);
        $newToken = $response->json('qr.token');
        $newCode = $response->json('qr.code');

        $this->assertNotEquals($oldToken, $newToken);
        $this->assertNotEquals($oldCode, $newCode);

        // Old token must no longer work publicly
        $oldInfoRes = $this->getJson("/api/self-check-in/info/{$oldToken}");
        $oldInfoRes->assertStatus(404);

        // New token must work publicly
        $newInfoRes = $this->getJson("/api/self-check-in/info/{$newToken}");
        $newInfoRes->assertStatus(200);
        $this->assertTrue($newInfoRes->json('valid'));
        $this->assertEquals('Iron Fortress Gym', $newInfoRes->json('gym.name'));
    }

    public function test_owner_can_deactivate_and_reactivate_qr_code(): void
    {
        $qr = GymQrCode::createUnique($this->gymA->id, $this->branchA1->id);

        // Deactivate
        $deactRes = $this->actingAs($this->ownerA)
            ->postJson("/api/attendance/qr-codes/{$qr->id}/toggle-status");
        $deactRes->assertStatus(200);
        $this->assertFalse($deactRes->json('qr.is_active'));

        // Public check-in info must return 410 Gone / deactivated
        $publicRes = $this->getJson("/api/self-check-in/info/{$qr->token}");
        $publicRes->assertStatus(410);

        // Reactivate
        $actRes = $this->actingAs($this->ownerA)
            ->postJson("/api/attendance/qr-codes/{$qr->id}/toggle-status");
        $actRes->assertStatus(200);
        $this->assertTrue($actRes->json('qr.is_active'));

        $publicRes2 = $this->getJson("/api/self-check-in/info/{$qr->token}");
        $publicRes2->assertStatus(200);
    }

    public function test_complete_self_check_in_flow_for_valid_member(): void
    {
        $qr = GymQrCode::createUnique($this->gymA->id, $this->branchA1->id);

        // 1. Member scans QR poster & gets safe public gym/branch info
        $infoRes = $this->getJson("/api/self-check-in/info/{$qr->token}");
        $infoRes->assertStatus(200);
        $this->assertEquals('Iron Fortress Gym', $infoRes->json('gym.name'));
        $this->assertEquals('Main Downtown Branch', $infoRes->json('branch.name'));

        // 2. Member enters registered phone number to verify
        $verifyRes = $this->postJson('/api/self-check-in/verify-member', [
            'token' => $qr->token,
            'phone' => '9822011223',
        ]);
        $verifyRes->assertStatus(200);
        $this->assertTrue($verifyRes->json('success'));
        $this->assertEquals('Rahul Sharma', $verifyRes->json('member.name'));
        $this->assertEquals('Annual Gold Membership', $verifyRes->json('member.plan_name'));
        $confirmationToken = $verifyRes->json('confirmation_token');
        $this->assertNotEmpty($confirmationToken);

        // 3. Member confirms check-in
        $confirmRes = $this->postJson('/api/self-check-in/confirm', [
            'token' => $qr->token,
            'confirmation_token' => $confirmationToken,
        ]);
        $confirmRes->assertStatus(201);
        $this->assertTrue($confirmRes->json('success'));
        $this->assertStringContainsString('Rahul', $confirmRes->json('message'));
        $this->assertEquals('Main Downtown Branch', $confirmRes->json('branch_name'));

        // 4. Verify AttendanceLog was created
        $log = AttendanceLog::withoutGlobalScopes()
            ->where('member_id', $this->memberA->id)
            ->where('branch_id', $this->branchA1->id)
            ->first();
        $this->assertNotNull($log);
        $this->assertEquals('qr_self_check_in', $log->method);
        $this->assertEquals($qr->id, $log->gym_qr_code_id);

        // 5. Duplicate check-in today must be prevented
        $dupVerifyRes = $this->postJson('/api/self-check-in/verify-member', [
            'token' => $qr->token,
            'phone' => '9822011223',
        ]);
        $dupVerifyRes->assertStatus(200);
        $this->assertTrue($dupVerifyRes->json('already_checked_in'));
    }

    public function test_self_check_in_rejects_expired_and_frozen_memberships(): void
    {
        $qr = GymQrCode::createUnique($this->gymA->id, $this->branchA1->id);

        // Expire membership
        $this->subA->update([
            'end_date' => now()->subDay(),
        ]);

        $verifyRes = $this->postJson('/api/self-check-in/verify-member', [
            'token' => $qr->token,
            'phone' => '9822011223',
        ]);
        $verifyRes->assertStatus(422);
        $this->assertStringContainsString('expired', strtolower($verifyRes->json('message')));

        // Freeze membership
        $this->subA->update([
            'end_date' => now()->addMonths(6),
            'status' => 'frozen',
        ]);

        $frozenRes = $this->postJson('/api/self-check-in/verify-member', [
            'token' => $qr->token,
            'phone' => '9822011223',
        ]);
        $frozenRes->assertStatus(422);
        $this->assertStringContainsString('frozen', strtolower($frozenRes->json('message')));
    }

    public function test_multi_tenant_isolation_cross_gym_member_blocked(): void
    {
        // Gym A's QR code
        $qrA = GymQrCode::createUnique($this->gymA->id, $this->branchA1->id);

        // Member B (belongs to Gym B) tries to check into Gym A
        $verifyRes = $this->postJson('/api/self-check-in/verify-member', [
            'token' => $qrA->token,
            'phone' => $this->memberB->phone,
        ]);

        $verifyRes->assertStatus(404);
        $this->assertStringContainsString('No active member record found', $verifyRes->json('message'));
    }

    public function test_geofencing_location_verification(): void
    {
        // Configure QR with location: Pune center (18.5204, 73.8567)
        $qr = GymQrCode::createUnique($this->gymA->id, $this->branchA1->id, null, [
            'require_location' => true,
            'latitude' => 18.5204,
            'longitude' => 73.8567,
            'radius_meters' => 100, // 100 meters
        ]);

        // Verify member
        $verifyRes = $this->postJson('/api/self-check-in/verify-member', [
            'token' => $qr->token,
            'phone' => '9822011223',
        ]);
        $confirmationToken = $verifyRes->json('confirmation_token');

        // Check in from Mumbai (19.0760, 72.8777) -> ~120 kilometers away -> must fail!
        $failRes = $this->postJson('/api/self-check-in/confirm', [
            'token' => $qr->token,
            'confirmation_token' => $confirmationToken,
            'latitude' => 19.0760,
            'longitude' => 72.8777,
        ]);
        $failRes->assertStatus(422);
        $this->assertStringContainsString('Location verification failed', $failRes->json('message'));

        // Check in from exact gym premises (18.5204, 73.8567) -> 0 meters away -> must succeed!
        $successRes = $this->postJson('/api/self-check-in/confirm', [
            'token' => $qr->token,
            'confirmation_token' => $confirmationToken,
            'latitude' => 18.5204,
            'longitude' => 73.8567,
        ]);
        $successRes->assertStatus(201);
        $this->assertTrue($successRes->json('success'));
    }
}
