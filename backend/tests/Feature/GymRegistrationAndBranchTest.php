<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\Gym;
use App\Models\SaasPlan;
use App\Models\User;
use App\Support\CurrentGym;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class GymRegistrationAndBranchTest extends TestCase
{
    use RefreshDatabase;

    private SaasPlan $starterPlan;

    protected function setUp(): void
    {
        parent::setUp();

        $this->starterPlan = SaasPlan::create([
            'name' => 'Single Studio',
            'code' => 'starter',
            'price' => 1999.00,
            'interval' => 'month',
            'branch_limit' => 1,
            'member_limit' => 200,
            'is_active' => true,
        ]);
    }

    public function test_public_gym_registration_flow(): void
    {
        $response = $this->postJson('/api/register', [
            'gym_name' => 'Spartan Fitness Club',
            'owner_name' => 'Leonidas',
            'email' => 'leonidas@spartan.com',
            'phone' => '9876543210',
            'password' => 'secret123',
            'password_confirmation' => 'secret123',
            'branch_name' => 'Sparta HQ',
            'city' => 'Pune',
            'plan_code' => 'starter',
        ]);

        $response->assertCreated()
            ->assertJsonStructure(['token', 'user' => ['id', 'gym' => ['id', 'name', 'slug']]]);

        $this->assertDatabaseHas('gyms', ['name' => 'Spartan Fitness Club', 'slug' => 'spartan-fitness-club']);
        $this->assertDatabaseHas('branches', ['name' => 'Sparta HQ', 'is_primary' => true]);
        $this->assertDatabaseHas('users', ['email' => 'leonidas@spartan.com', 'role' => User::ROLE_GYM_OWNER]);
    }

    public function test_branch_limit_enforced_by_saas_plan(): void
    {
        $gym = Gym::create([
            'name' => 'Single Branch Gym',
            'slug' => 'single-gym',
            'status' => Gym::STATUS_ACTIVE,
            'saas_plan_id' => $this->starterPlan->id,
            'subscription_expires_at' => now()->addDays(30),
        ]);

        CurrentGym::run($gym, function () use ($gym) {
            $branch = Branch::create(['gym_id' => $gym->id, 'name' => 'Branch 1', 'is_primary' => true]);
            $owner = User::create([
                'gym_id' => $gym->id,
                'primary_branch_id' => $branch->id,
                'name' => 'Studio Owner',
                'email' => 'owner@single.com',
                'password' => Hash::make('password123'),
                'role' => User::ROLE_GYM_OWNER,
                'is_active' => true,
            ]);

            Sanctum::actingAs($owner);

            // Attempting to create a 2nd branch on a 1-branch plan must be rejected with 422
            $this->postJson('/api/branches', [
                'name' => 'Branch 2 - Downtown',
            ])->assertStatus(422)->assertJsonPath('code', 'plan_limit_reached');
        });
    }

    public function test_staff_branch_access_control(): void
    {
        $plan = SaasPlan::create([
            'name' => 'Multi Branch',
            'code' => 'multi',
            'price' => 4999.00,
            'interval' => 'month',
            'branch_limit' => 5,
            'member_limit' => 1000,
            'is_active' => true,
        ]);

        $gym = Gym::create([
            'name' => 'Dual Gym',
            'slug' => 'dual-gym',
            'status' => Gym::STATUS_ACTIVE,
            'saas_plan_id' => $plan->id,
            'subscription_expires_at' => now()->addDays(30),
        ]);

        CurrentGym::run($gym, function () use ($gym) {
            $branch1 = Branch::create(['gym_id' => $gym->id, 'name' => 'Branch North', 'is_primary' => true]);
            $branch2 = Branch::create(['gym_id' => $gym->id, 'name' => 'Branch South', 'is_primary' => false]);

            $manager = User::create([
                'gym_id' => $gym->id,
                'primary_branch_id' => $branch1->id,
                'name' => 'North Manager',
                'email' => 'mgr@dual.com',
                'password' => Hash::make('password123'),
                'role' => User::ROLE_BRANCH_MANAGER,
                'is_active' => true,
            ]);
            $branch1->staff()->attach($manager->id, ['gym_id' => $gym->id]);

            Sanctum::actingAs($manager);

            // Manager accessing their own Branch North succeeds
            $this->getJson('/api/dashboard', ['X-Branch-ID' => $branch1->id])->assertOk();

            // Manager attempting to switch to Branch South (unauthorized for them) gets 403
            $this->getJson('/api/dashboard', ['X-Branch-ID' => $branch2->id])
                ->assertForbidden()
                ->assertJsonPath('message', 'You do not have access to this branch.');
        });
    }
}
