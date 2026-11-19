<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\Gym;
use App\Models\Member;
use App\Models\MembershipPlan;
use App\Models\Payment;
use App\Models\Product;
use App\Models\SaasPlan;
use App\Models\User;
use App\Support\ModuleRegistry;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class NavigationAndModuleConfigurationTest extends TestCase
{
    use RefreshDatabase;

    private SaasPlan $starterPlan;
    private SaasPlan $enterprisePlan;
    private Gym $gym;
    private Branch $branch;
    private User $owner;
    private User $superAdmin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->starterPlan = SaasPlan::create([
            'name' => 'Starter Studio',
            'code' => 'starter',
            'price' => 2499.00,
            'interval' => 'month',
            'branch_limit' => 1,
            'member_limit' => 250,
            'modules' => [
                ModuleRegistry::MODULE_OVERVIEW,
                ModuleRegistry::MODULE_MEMBERS,
                ModuleRegistry::MODULE_ATTENDANCE,
                ModuleRegistry::MODULE_FINANCE,
            ],
            'is_active' => true,
        ]);

        $this->enterprisePlan = SaasPlan::create([
            'name' => 'Enterprise Franchise',
            'code' => 'enterprise',
            'price' => 9999.00,
            'interval' => 'month',
            'branch_limit' => 10,
            'member_limit' => 5000,
            'modules' => array_keys(ModuleRegistry::all()),
            'is_active' => true,
        ]);

        $this->gym = Gym::create([
            'name' => 'Olympia Fitness',
            'slug' => 'olympia-fitness',
            'currency' => 'INR',
            'status' => Gym::STATUS_ACTIVE,
            'saas_plan_id' => $this->starterPlan->id,
            'subscription_expires_at' => now()->addMonths(6),
        ]);

        $this->branch = Branch::create([
            'gym_id' => $this->gym->id,
            'name' => 'Main Studio',
            'code' => 'MAIN',
            'is_primary' => true,
            'is_active' => true,
        ]);

        $this->owner = User::create([
            'gym_id' => $this->gym->id,
            'name' => 'Karan Owner',
            'email' => 'owner@olympia.fit',
            'password' => bcrypt('password123'),
            'role' => User::ROLE_GYM_OWNER,
            'primary_branch_id' => $this->branch->id,
            'is_active' => true,
        ]);

        $this->superAdmin = User::create([
            'gym_id' => null,
            'name' => 'Platform Admin',
            'email' => 'admin@platform.com',
            'password' => bcrypt('password123'),
            'role' => User::ROLE_SUPER_ADMIN,
            'is_active' => true,
        ]);
    }

    public function test_global_search_returns_multi_domain_matches(): void
    {
        $member = Member::create([
            'gym_id' => $this->gym->id,
            'primary_branch_id' => $this->branch->id,
            'first_name' => 'Rahul',
            'last_name' => 'Sharma',
            'phone' => '9876543210',
            'email' => 'rahul@example.com',
            'member_code' => 'MEM-101',
            'status' => 'active',
        ]);

        $plan = MembershipPlan::create([
            'gym_id' => $this->gym->id,
            'name' => 'Gold Annual Pass',
            'code' => 'GOLD-YR',
            'price' => 18000,
            'duration_days' => 365,
            'is_active' => true,
        ]);

        $product = Product::create([
            'gym_id' => $this->gym->id,
            'name' => 'Gold Standard Whey',
            'brand' => 'Optimum Nutrition',
            'category' => 'whey_protein',
            'sku' => 'ON-WHEY-1',
            'selling_price' => 3200,
            'cost_price' => 2400,
            'stock_quantity' => 15,
            'is_active' => true,
        ]);

        $response = $this->actingAs($this->owner)
            ->withHeader('X-Branch-ID', (string) $this->branch->id)
            ->getJson('/api/search?q=Gold');

        $response->assertStatus(200)
            ->assertJsonPath('total_matches', 2)
            ->assertJsonFragment(['title' => 'Gold Annual Pass'])
            ->assertJsonFragment(['title' => 'Gold Standard Whey']);

        $memberSearch = $this->actingAs($this->owner)
            ->withHeader('X-Branch-ID', (string) $this->branch->id)
            ->getJson('/api/search?q=9876543210');

        $memberSearch->assertStatus(200)
            ->assertJsonPath('total_matches', 1)
            ->assertJsonFragment(['title' => 'Rahul Sharma']);
    }

    public function test_module_access_enforcement_and_plan_upgrade_restriction(): void
    {
        // Gym is on Starter plan which does not have 'ai_advisor'
        $response = $this->actingAs($this->owner)
            ->withHeader('X-Branch-ID', (string) $this->branch->id)
            ->getJson('/api/ai-advisor/insights');

        $response->assertStatus(403)
            ->assertJsonPath('error', 'module_upgrade_required')
            ->assertJsonPath('module', 'ai_advisor');
    }

    public function test_gym_owner_can_toggle_permitted_modules_and_dependencies(): void
    {
        // Owner gets module status
        $modRes = $this->actingAs($this->owner)
            ->withHeader('X-Branch-ID', (string) $this->branch->id)
            ->getJson('/api/settings/modules');

        $modRes->assertStatus(200)
            ->assertJsonStructure(['all_modules', 'entitled_modules', 'active_modules']);

        // Owner tries to activate 'ai_advisor' not included in Starter plan -> fails with 422
        $invalidAttempt = $this->actingAs($this->owner)
            ->withHeader('X-Branch-ID', (string) $this->branch->id)
            ->putJson('/api/settings/modules', [
                'modules' => ['overview', 'members', 'ai_advisor'],
            ]);

        $invalidAttempt->assertStatus(422)
            ->assertJsonPath('status', 'error');

        // Owner deactivates 'attendance' module
        $validUpdate = $this->actingAs($this->owner)
            ->withHeader('X-Branch-ID', (string) $this->branch->id)
            ->putJson('/api/settings/modules', [
                'modules' => ['overview', 'members', 'finance'],
            ]);

        $validUpdate->assertStatus(200)
            ->assertJsonFragment(['message' => 'Gym feature modules updated successfully.']);

        // Now calling attendance endpoint should return 403 module_deactivated
        $attendRes = $this->actingAs($this->owner)
            ->withHeader('X-Branch-ID', (string) $this->branch->id)
            ->getJson('/api/attendance');

        $attendRes->assertStatus(403)
            ->assertJsonPath('error', 'module_deactivated')
            ->assertJsonPath('module', 'attendance');
    }

    public function test_super_admin_can_override_gym_modules(): void
    {
        // Super admin enables ai_advisor as a custom grant for this gym
        $adminRes = $this->actingAs($this->superAdmin)
            ->putJson("/api/admin/gyms/{$this->gym->id}/modules", [
                'modules' => ['overview', 'members', 'attendance', 'finance', 'ai_advisor'],
            ]);

        $adminRes->assertStatus(200)
            ->assertJsonFragment(['message' => "Modules updated for gym 'Olympia Fitness'."]);

        // Now owner can access ai_advisor
        $this->gym->refresh();
        $this->owner->refresh();
        \App\Support\CurrentGym::clear();
        $this->assertTrue($this->gym->hasModule('ai_advisor'));

        $aiRes = $this->actingAs($this->owner)
            ->withHeader('X-Branch-ID', (string) $this->branch->id)
            ->getJson('/api/ai-advisor/insights');

        $aiRes->assertStatus(200);
    }
}
