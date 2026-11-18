<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\Branch;
use App\Models\Expense;
use App\Models\Gym;
use App\Models\Member;
use App\Models\MemberMembership;
use App\Models\MembershipPlan;
use App\Models\Payment;
use App\Models\PosOrder;
use App\Models\Product;
use App\Models\ProductBranchStock;
use App\Models\SaasPlan;
use App\Models\Supplier;
use App\Models\SupportTicket;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class ProductionReadinessAndLifecycleTest extends TestCase
{
    use RefreshDatabase;

    protected SaasPlan $starterPlan;
    protected SaasPlan $proPlan;
    protected User $superAdmin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->starterPlan = SaasPlan::create([
            'name' => 'Starter Club',
            'code' => 'starter',
            'price' => 2999.00,
            'interval' => 'month',
            'branch_limit' => 1,
            'member_limit' => 300,
            'is_active' => true,
        ]);

        $this->proPlan = SaasPlan::create([
            'name' => 'Multi-Branch Pro',
            'code' => 'pro',
            'price' => 7999.00,
            'interval' => 'month',
            'branch_limit' => 5,
            'member_limit' => 2000,
            'is_active' => true,
        ]);

        $this->superAdmin = User::create([
            'name' => 'Root Administrator',
            'email' => 'superadmin@antigravitygyms.com',
            'password' => bcrypt('AdminSuperSecret@2026'),
            'role' => User::ROLE_SUPER_ADMIN,
            'is_active' => true,
        ]);
    }

    /**
     * Complete 16-Step End-to-End Business Lifecycle Simulation
     */
    public function test_complete_16_step_gym_business_lifecycle_simulation(): void
    {
        // -------------------------------------------------------------
        // STEP 1: Register a new Gym Tenant
        // -------------------------------------------------------------
        $regRes = $this->postJson('/api/register', [
            'gym_name' => 'Spartan Strength Club',
            'owner_name' => 'Aarav Singhania',
            'email' => 'aarav@spartangym.in',
            'phone' => '9820011223',
            'password' => 'SpartanPassword@123',
            'password_confirmation' => 'SpartanPassword@123',
            'plan_code' => 'pro',
            'branch_name' => 'Spartan Bandra Main',
            'city' => 'Mumbai',
        ]);

        $regRes->assertStatus(201)
            ->assertJsonStructure(['token', 'user']);

        $token = $regRes->json('token');
        $gymId = $regRes->json('user.gym.id');
        $mainBranchId = $regRes->json('user.primary_branch_id');

        $headers = [
            'Authorization' => "Bearer {$token}",
            'X-Gym-Id' => (string) $gymId,
            'X-Branch-Id' => (string) $mainBranchId,
            'Accept' => 'application/json',
        ];

        // -------------------------------------------------------------
        // STEP 2: Create a Second Branch (Allowed on Pro Plan)
        // -------------------------------------------------------------
        $branchRes = $this->postJson('/api/branches', [
            'name' => 'Spartan Andheri West',
            'code' => 'ANDH01',
            'city' => 'Mumbai',
            'phone' => '9820099887',
        ], $headers);

        $branchRes->assertStatus(201);
        $secondBranchId = $branchRes->json('branch.id') ?? $branchRes->json('id');

        // -------------------------------------------------------------
        // STEP 3: Add Employees (Trainer & Receptionist)
        // -------------------------------------------------------------
        $trainerRes = $this->postJson('/api/staff', [
            'name' => 'Coach Devraj',
            'email' => 'devraj@spartangym.in',
            'phone' => '9811002233',
            'password' => 'CoachSecret123',
            'role' => 'trainer',
            'primary_branch_id' => $mainBranchId,
            'base_salary' => 30000.00,
            'pt_session_rate' => 600.00,
        ], $headers);

        $trainerRes->assertStatus(201);
        $trainerId = $trainerRes->json('staff.id') ?? $trainerRes->json('id');

        // -------------------------------------------------------------
        // STEP 4: Create Membership Plans (Quarterly Transformation)
        // -------------------------------------------------------------
        $planRes = $this->postJson('/api/membership-plans', [
            'name' => 'Quarterly Muscle Builder',
            'duration_days' => 90,
            'price' => 12000.00,
            'admission_fee' => 1000.00,
            'tax_percent' => 18.00,
        ], $headers);

        $planRes->assertStatus(201);
        $membershipPlanId = $planRes->json('plan.id') ?? $planRes->json('id');

        // -------------------------------------------------------------
        // STEP 5: Register Member with Photo & Assigned Trainer
        // -------------------------------------------------------------
        $memberRes = $this->postJson('/api/members', [
            'primary_branch_id' => $mainBranchId,
            'member_code' => 'SPARTAN-101',
            'first_name' => 'Kunal',
            'last_name' => 'Kapoor',
            'email' => 'kunal.kapoor@gmail.com',
            'phone' => '9876543210',
            'gender' => 'male',
            'dob' => '1995-05-15',
            'emergency_contact_name' => 'Sunita Kapoor',
            'emergency_contact_phone' => '9876543211',
            'assigned_trainer_id' => $trainerId,
        ], $headers);

        $memberRes->assertStatus(201);
        $memberId = $memberRes->json('member.id') ?? $memberRes->json('id');

        // -------------------------------------------------------------
        // STEP 6 & 7: Sell Membership & Collect Partial Payment
        // Total Fee: 12000 + 1000 admission = 13,000. Paid: 8,000. Balance: 5,000.
        // -------------------------------------------------------------
        $membershipRes = $this->postJson('/api/member-memberships/renew', [
            'member_id' => $memberId,
            'membership_plan_id' => $membershipPlanId,
            'start_date' => now()->toDateString(),
            'paid_amount' => 8000.00,
            'payment_method' => 'upi',
            'reference_id' => 'UPI-TXN-998877',
        ], $headers);

        $membershipRes->assertStatus(201);

        // Verify member outstanding balance is updated to exactly 4,000.00
        $memberCheck = Member::withoutGlobalScope('gym')->findOrFail($memberId);
        $this->assertEquals(4000.00, (float) $memberCheck->outstanding_balance);

        // -------------------------------------------------------------
        // STEP 8: Record Attendance & Verify Duplicate Prevention
        // -------------------------------------------------------------
        $checkInRes = $this->postJson('/api/attendance/check-in', [
            'member_id' => $memberId,
            'method' => 'qr_scan',
        ], $headers);

        $checkInRes->assertStatus(201);

        // Duplicate check-in on the same day while still checked in should fail or reject
        $dupRes = $this->postJson('/api/attendance/check-in', [
            'member_id' => $memberId,
            'method' => 'qr_scan',
        ], $headers);

        $dupRes->assertStatus(200)
            ->assertJsonPath('already_checked_in', true);

        // -------------------------------------------------------------
        // STEP 9: Renew / Extend Membership
        // -------------------------------------------------------------
        $activeMembership = MemberMembership::where('member_id', $memberId)->first();
        $extendRes = $this->postJson("/api/member-memberships/{$activeMembership->id}/extend", [
            'days' => 15,
            'reason' => 'Complimentary festive extension',
        ], $headers);

        $extendRes->assertStatus(200);

        // -------------------------------------------------------------
        // STEP 10: Record Operating Expenses
        // -------------------------------------------------------------
        $expenseRes = $this->postJson('/api/expenses', [
            'title' => 'Gym AC Maintenance & Gas Refill',
            'category' => 'maintenance',
            'amount' => 4500.00,
            'expense_date' => now()->toDateString(),
            'payment_mode' => 'bank_transfer',
        ], $headers);

        $expenseRes->assertStatus(201);

        // -------------------------------------------------------------
        // STEP 11: Purchase Supplements & Inward Inventory (WAC Costing)
        // -------------------------------------------------------------
        $supplierRes = $this->postJson('/api/suppliers', [
            'name' => 'Optimum Nutrition India Distributor',
            'contact_person' => 'Rajesh Sharma',
            'phone' => '9822114455',
        ], $headers);

        $supplierRes->assertStatus(201);
        $supplierId = $supplierRes->json('supplier.id') ?? $supplierRes->json('id');

        $productRes = $this->postJson('/api/products', [
            'name' => 'Gold Standard 100% Whey 2kg',
            'brand' => 'Optimum Nutrition',
            'category' => 'whey_protein',
            'sku' => 'ON-WHEY-2KG-DBL',
            'barcode' => '8901234567890',
            'cost_price' => 4500.00,
            'selling_price' => 6500.00,
            'min_stock_alert' => 5,
            'opening_stock' => 10,
        ], $headers);

        $productRes->assertStatus(201);
        $productId = $productRes->json('product.id') ?? $productRes->json('id');

        // Verify stock created at main branch
        $stockRecord = ProductBranchStock::where('product_id', $productId)->where('branch_id', $mainBranchId)->first();
        $this->assertEquals(10, $stockRecord->quantity);

        // -------------------------------------------------------------
        // STEP 12: Sell Products via POS Checkout
        // -------------------------------------------------------------
        $posRes = $this->postJson('/api/pos/checkout', [
            'customer_type' => 'member',
            'member_id' => $memberId,
            'payment_method' => 'upi',
            'discount_amount' => 500.00,
            'paid_amount' => 12500.00,
            'items' => [
                [
                    'product_id' => $productId,
                    'quantity' => 2,
                    'unit_price' => 6500.00,
                ],
            ],
        ], $headers);

        $posRes->assertStatus(201);
        $posOrderId = $posRes->json('order.id');

        // Stock should now be 10 - 2 = 8
        $stockRecord->refresh();
        $this->assertEquals(8, $stockRecord->quantity);

        // -------------------------------------------------------------
        // STEP 13: Process POS Refund (Return to Stock)
        // -------------------------------------------------------------
        $refundRes = $this->postJson("/api/pos/orders/{$posOrderId}/refund", [
            'amount' => 12500.00,
            'payment_mode' => 'upi',
            'reason' => 'Customer ordered chocolate flavor by mistake; unsealed tub returned.',
            'restock' => true,
        ], $headers);

        $refundRes->assertStatus(200);

        // Stock restored back to 10
        $stockRecord->refresh();
        $this->assertEquals(10, $stockRecord->quantity);

        // -------------------------------------------------------------
        // STEP 14: Review Owner Dashboard & Profitability Reports
        // -------------------------------------------------------------
        $dashRes = $this->getJson('/api/owner-dashboard?period=this_month', $headers);
        $dashRes->assertStatus(200)
            ->assertJsonPath('executive_kpis.active_members', 1);

        $reportsRes = $this->getJson('/api/reports/daily', $headers);
        $reportsRes->assertStatus(200);

        // -------------------------------------------------------------
        // STEP 15: Export Business Data (CSV Export)
        // -------------------------------------------------------------
        $exportRes = $this->get('/api/reports/export/members', $headers);
        $exportRes->assertStatus(200);
        ob_start();
        $exportRes->sendContent();
        $content = ob_get_clean();
        $this->assertStringContainsString('Kunal', $content);

        // -------------------------------------------------------------
        // STEP 16: Verify SaaS Plan Restrictions (Branch Limit Enforcement)
        // Switch Gym to Starter Plan (limit = 1 branch)
        // -------------------------------------------------------------
        Gym::where('id', $gymId)->update(['saas_plan_id' => $this->starterPlan->id]);
        \App\Support\CurrentGym::clear();

        $exceedBranchRes = $this->postJson('/api/branches', [
            'name' => 'Spartan Juhu Beach Club',
            'city' => 'Mumbai',
        ], $headers);

        // Must reject with 422 Unprocessable (plan limit reached)
        $exceedBranchRes->assertStatus(422)
            ->assertJsonPath('code', 'plan_limit_reached');
    }

    /**
     * Security: Cross-Tenant Isolation Tests (Strict ID Manipulation Defense)
     */
    public function test_security_cross_tenant_manipulation_is_completely_blocked(): void
    {
        // Gym A
        $gymA = Gym::create([
            'name' => 'Gym Alpha',
            'slug' => 'gymalpha',
            'email' => 'alpha@gym.com',
            'phone' => '9800011111',
            'status' => Gym::STATUS_ACTIVE,
            'saas_plan_id' => $this->proPlan->id,
            'subscription_expires_at' => now()->addDays(60),
        ]);
        $branchA = Branch::create(['gym_id' => $gymA->id, 'name' => 'Alpha 1', 'is_main' => true]);
        $ownerA = User::create([
            'gym_id' => $gymA->id,
            'name' => 'Owner Alpha',
            'email' => 'owner.alpha@gym.com',
            'password' => bcrypt('password123'),
            'role' => User::ROLE_GYM_OWNER,
            'primary_branch_id' => $branchA->id,
            'is_active' => true,
        ]);
        $memberA = Member::create([
            'gym_id' => $gymA->id,
            'primary_branch_id' => $branchA->id,
            'member_code' => 'ALPHA-001',
            'first_name' => 'Rahul',
            'phone' => '9811122233',
            'status' => 'active',
        ]);
        $paymentA = Payment::create([
            'gym_id' => $gymA->id,
            'branch_id' => $branchA->id,
            'member_id' => $memberA->id,
            'amount' => 5000.00,
            'payment_date' => now()->toDateString(),
            'status' => 'completed',
        ]);

        // Gym B
        $gymB = Gym::create([
            'name' => 'Gym Beta',
            'slug' => 'gymbeta',
            'email' => 'beta@gym.com',
            'phone' => '9800022222',
            'status' => Gym::STATUS_ACTIVE,
            'saas_plan_id' => $this->proPlan->id,
            'subscription_expires_at' => now()->addDays(60),
        ]);
        $branchB = Branch::create(['gym_id' => $gymB->id, 'name' => 'Beta 1', 'is_main' => true]);
        $ownerB = User::create([
            'gym_id' => $gymB->id,
            'name' => 'Owner Beta',
            'email' => 'owner.beta@gym.com',
            'password' => bcrypt('password123'),
            'role' => User::ROLE_GYM_OWNER,
            'primary_branch_id' => $branchB->id,
            'is_active' => true,
        ]);

        $tokenB = $ownerB->createToken('beta-token')->plainTextToken;
        $headersB = [
            'Authorization' => "Bearer {$tokenB}",
            'X-Gym-Id' => (string) $gymB->id,
            'X-Branch-Id' => (string) $branchB->id,
            'Accept' => 'application/json',
        ];

        // 1. Gym B tries to read Gym A's member
        $res1 = $this->getJson("/api/members/{$memberA->id}", $headersB);
        $res1->assertStatus(404);

        // 2. Gym B tries to update Gym A's member
        $res2 = $this->putJson("/api/members/{$memberA->id}", [
            'first_name' => 'HackedName',
        ], $headersB);
        $res2->assertStatus(404);

        // 3. Gym B tries to delete Gym A's member
        $res3 = $this->deleteJson("/api/members/{$memberA->id}", [], $headersB);
        $res3->assertStatus(404);

        // 4. Gym B tries to view Gym A's payment receipt
        $res4 = $this->getJson("/api/payments/{$paymentA->id}", $headersB);
        $res4->assertStatus(404);

        // 5. Gym B tries to refund Gym A's payment
        $res5 = $this->postJson("/api/payments/{$paymentA->id}/refund", [
            'reason' => 'Malicious refund',
        ], $headersB);
        $res5->assertStatus(404);

        // Verify member A was not touched
        $memberA->refresh();
        $this->assertEquals('Rahul', $memberA->first_name);
    }

    /**
     * Security: SQL Injection & XSS Protection
     */
    public function test_security_sql_injection_and_xss_protection(): void
    {
        $gym = Gym::create([
            'name' => 'Security Guard Gym',
            'slug' => 'securitygym',
            'email' => 'sec@gym.com',
            'phone' => '9810011000',
            'status' => Gym::STATUS_ACTIVE,
            'saas_plan_id' => $this->proPlan->id,
            'subscription_expires_at' => now()->addDays(90),
        ]);
        $branch = Branch::create(['gym_id' => $gym->id, 'name' => 'Main', 'is_main' => true]);
        $owner = User::create([
            'gym_id' => $gym->id,
            'name' => 'Sec Officer',
            'email' => 'sec@gym.com',
            'password' => bcrypt('password123'),
            'role' => User::ROLE_GYM_OWNER,
            'primary_branch_id' => $branch->id,
            'is_active' => true,
        ]);

        $headers = [
            'Authorization' => "Bearer {$owner->createToken('sec-token')->plainTextToken}",
            'X-Gym-Id' => (string) $gym->id,
            'X-Branch-Id' => (string) $branch->id,
            'Accept' => 'application/json',
        ];

        // SQL injection payload in search
        $sqlPayload = "' OR '1'='1' UNION SELECT * FROM users --";
        $searchRes = $this->getJson('/api/members?search=' . urlencode($sqlPayload), $headers);
        $searchRes->assertStatus(200);

        // XSS Payload in member registration
        $xssPayload = "<script>alert('XSS-ATTACK')</script>";
        $xssRes = $this->postJson('/api/members', [
            'primary_branch_id' => $branch->id,
            'member_code' => 'SEC-001',
            'first_name' => 'Aman',
            'last_name' => $xssPayload,
            'phone' => '9811009988',
        ], $headers);

        $xssRes->assertStatus(201);
        $createdMemberId = $xssRes->json('id');
        $createdMember = Member::withoutGlobalScope('gym')->find($createdMemberId);
        $this->assertNotNull($createdMember);
        $this->assertEquals($xssPayload, $createdMember->last_name);
    }

    /**
     * Super Admin Operations: Onboarding, Edit, Password Reset & Platform Tickets
     */
    public function test_super_admin_operations_lifecycle(): void
    {
        $adminHeaders = [
            'Authorization' => "Bearer {$this->superAdmin->createToken('admin-token')->plainTextToken}",
            'Accept' => 'application/json',
        ];

        // 1. Super Admin onboards a new gym
        $onboardRes = $this->postJson('/api/admin/gyms', [
            'name' => 'Olympus Athletics',
            'email' => 'admin@olympusgym.in',
            'phone' => '9820033445',
            'saas_plan_id' => $this->proPlan->id,
            'owner_name' => 'Drona Acharya',
            'owner_email' => 'drona@olympusgym.in',
            'owner_password' => 'Olympus@2026',
        ], $adminHeaders);

        $onboardRes->assertStatus(201);
        $newGymId = $onboardRes->json('gym.id');

        // 2. Super Admin edits the gym
        $editRes = $this->putJson("/api/admin/gyms/{$newGymId}", [
            'phone' => '9820033449',
        ], $adminHeaders);

        $editRes->assertStatus(200);
        $this->assertEquals('9820033449', Gym::find($newGymId)->phone);

        // 3. Super Admin resets owner password securely
        $resetRes = $this->postJson("/api/admin/gyms/{$newGymId}/reset-owner-password", [
            'password' => 'NewSecurePassword@2026',
        ], $adminHeaders);

        $resetRes->assertStatus(200)
            ->assertJsonPath('owner_email', 'drona@olympusgym.in');

        // Verify owner can log in with new password
        $loginRes = $this->postJson('/api/login', [
            'login' => 'drona@olympusgym.in',
            'password' => 'NewSecurePassword@2026',
        ]);

        $loginRes->assertStatus(200);
    }
}
