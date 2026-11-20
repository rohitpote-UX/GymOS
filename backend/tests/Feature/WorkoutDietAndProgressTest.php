<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\Exercise;
use App\Models\Food;
use App\Models\Gym;
use App\Models\Member;
use App\Models\MemberDietPlan;
use App\Models\MemberMealLog;
use App\Models\MemberProgressLog;
use App\Models\MemberWorkoutPlan;
use App\Models\MemberWorkoutSession;
use App\Models\SaasPlan;
use App\Models\User;
use App\Models\WorkoutTemplate;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class WorkoutDietAndProgressTest extends TestCase
{
    use RefreshDatabase;

    private Gym $gym;
    private Branch $branch;
    private User $owner;
    private User $trainer;
    private User $receptionist;
    private Member $member;

    protected function setUp(): void
    {
        parent::setUp();

        SaasPlan::create([
            'name' => 'Pro Enterprise',
            'code' => 'pro',
            'price' => 4999,
            'billing_cycle' => 'monthly',
            'max_branches' => 5,
            'max_members' => 1000,
            'features' => ['all'],
            'is_active' => true,
        ]);

        $this->gym = Gym::create([
            'name' => 'Muscle Arena Pune',
            'slug' => 'muscle-arena',
            'currency' => 'INR',
            'status' => 'active',
        ]);

        $this->branch = Branch::create([
            'gym_id' => $this->gym->id,
            'name' => 'Shivajinagar Branch',
            'code' => 'SJV',
            'city' => 'Pune',
            'is_primary' => true,
            'is_active' => true,
        ]);

        $this->owner = User::create([
            'gym_id' => $this->gym->id,
            'primary_branch_id' => $this->branch->id,
            'name' => 'Mahesh Shinde',
            'email' => 'owner@musclearena.com',
            'password' => 'password123',
            'role' => User::ROLE_GYM_OWNER,
            'language' => 'en',
            'is_active' => true,
        ]);

        $this->trainer = User::create([
            'gym_id' => $this->gym->id,
            'primary_branch_id' => $this->branch->id,
            'name' => 'Vikram Pawar',
            'email' => 'trainer@musclearena.com',
            'password' => 'password123',
            'role' => User::ROLE_TRAINER,
            'language' => 'en',
            'is_active' => true,
            'specialization' => 'Hypertrophy & Strength',
        ]);

        $this->receptionist = User::create([
            'gym_id' => $this->gym->id,
            'primary_branch_id' => $this->branch->id,
            'name' => 'Pooja Patil',
            'email' => 'reception@musclearena.com',
            'password' => 'password123',
            'role' => User::ROLE_FRONT_DESK,
            'language' => 'en',
            'is_active' => true,
        ]);

        $this->member = Member::create([
            'gym_id' => $this->gym->id,
            'primary_branch_id' => $this->branch->id,
            'assigned_trainer_id' => $this->trainer->id,
            'member_code' => 'MA-1001',
            'first_name' => 'Aditya',
            'last_name' => 'Deshmukh',
            'phone' => '9822001122',
            'email' => 'aditya@example.com',
            'gender' => 'male',
            'status' => 'active',
            'date_of_birth' => '1998-05-15',
        ]);
    }

    private function headers(User $user): array
    {
        return [
            'X-Gym-ID' => $this->gym->id,
            'X-Branch-ID' => $this->branch->id,
        ];
    }

    public function test_exercise_and_food_library_retrieval_with_system_and_gym_scoping()
    {
        // Global system exercise
        Exercise::create([
            'gym_id' => null,
            'is_system' => true,
            'name' => 'Barbell Bench Press',
            'name_mr' => 'बार्बेल बेंच प्रेस',
            'name_hi' => 'बारबेल बेंच प्रेस',
            'target_muscle' => 'Chest',
            'equipment' => 'Barbell',
            'difficulty' => 'intermediate',
        ]);

        // Custom gym exercise
        Exercise::create([
            'gym_id' => $this->gym->id,
            'is_system' => false,
            'name' => 'Custom Landmine Press',
            'target_muscle' => 'Shoulders',
            'equipment' => 'Landmine',
            'difficulty' => 'intermediate',
        ]);

        // Global food
        Food::create([
            'gym_id' => null,
            'is_system' => true,
            'name' => 'Paneer (Raw)',
            'name_mr' => 'पनीर',
            'name_hi' => 'पनीर',
            'calories' => 265,
            'protein_g' => 18.0,
            'carbs_g' => 3.5,
            'fat_g' => 20.0,
            'dietary_preference' => 'vegetarian',
        ]);

        $response = $this->actingAs($this->trainer)
            ->getJson('/api/exercises', $this->headers($this->trainer));

        $response->assertStatus(200);
        $data = $response->json();
        $this->assertGreaterThanOrEqual(2, count($data));

        $foodRes = $this->actingAs($this->trainer)
            ->getJson('/api/foods', $this->headers($this->trainer));

        $foodRes->assertStatus(200);
        $this->assertGreaterThanOrEqual(1, count($foodRes->json()));
    }

    public function test_workout_plan_creation_with_weekly_schedule_and_versioning()
    {
        $payload = [
            'member_id' => $this->member->id,
            'title' => 'Hypertrophy PPL Routine',
            'goal' => 'Muscle Hypertrophy',
            'difficulty' => 'intermediate',
            'days_per_week' => 5,
            'schedule' => [
                'monday' => [
                    'day_name' => 'Monday - Push (Chest & Shoulders)',
                    'is_rest_day' => false,
                    'exercises' => [
                        [
                            'exercise_id' => 1,
                            'name' => 'Bench Press',
                            'sets' => 4,
                            'reps' => '8-10',
                            'target_weight_kg' => 70,
                            'rest_seconds' => 90,
                            'notes' => 'Keep elbows tucked at 45 degrees',
                        ],
                    ],
                ],
                'sunday' => [
                    'day_name' => 'Sunday - Active Recovery',
                    'is_rest_day' => true,
                    'exercises' => [],
                ],
            ],
            'status' => 'active',
        ];

        $res = $this->actingAs($this->trainer)
            ->postJson('/api/workout-plans', $payload, $this->headers($this->trainer));

        $res->assertStatus(201);
        $planId = $res->json('workout_plan.id');
        $this->assertEquals(1, $res->json('workout_plan.version'));

        // Update active plan to trigger auto-versioning
        $updatePayload = array_merge($payload, [
            'title' => 'Hypertrophy PPL Routine v2',
            'days_per_week' => 6,
        ]);

        $updateRes = $this->actingAs($this->trainer)
            ->putJson("/api/workout-plans/{$planId}", $updatePayload, $this->headers($this->trainer));

        $updateRes->assertStatus(200);
        $newVersion = $updateRes->json('workout_plan');
        $this->assertEquals(2, $newVersion['version']);
        $this->assertEquals($planId, $newVersion['parent_plan_id']);

        // Check original plan is now archived
        $this->assertDatabaseHas('member_workout_plans', [
            'id' => $planId,
            'status' => 'archived',
        ]);
    }

    public function test_diet_plan_creation_with_meal_slots_and_auto_macro_calculation()
    {
        $payload = [
            'member_id' => $this->member->id,
            'title' => 'High-Protein Muscle Gain Diet',
            'goal' => 'Weight Gain',
            'dietary_preference' => 'vegetarian',
            'food_allergies' => 'Lactose sensitive (mild)',
            'meals' => [
                [
                    'slot_name' => 'Breakfast',
                    'time_hint' => '08:30 AM',
                    'items' => [
                        [
                            'food_name' => 'Rolled Oats with Milk',
                            'quantity' => '100g with 250ml skimmed milk',
                            'calories' => 420,
                            'protein' => 18,
                            'carbs' => 68,
                            'fat' => 8,
                        ],
                    ],
                ],
                [
                    'slot_name' => 'Lunch',
                    'time_hint' => '01:30 PM',
                    'items' => [
                        [
                            'food_name' => 'Brown Rice + Paneer Bhurji',
                            'quantity' => '150g rice + 150g paneer',
                            'calories' => 580,
                            'protein' => 32,
                            'carbs' => 55,
                            'fat' => 22,
                        ],
                    ],
                ],
            ],
            'status' => 'active',
        ];

        $res = $this->actingAs($this->trainer)
            ->postJson('/api/diet-plans', $payload, $this->headers($this->trainer));

        $res->assertStatus(201);
        $diet = $res->json('diet_plan');
        $this->assertEquals(1000, $diet['target_calories']); // 420 + 580
        $this->assertEquals(50, $diet['target_protein_g']); // 18 + 32
        $this->assertEquals(123, $diet['target_carbs_g']); // 68 + 55
        $this->assertEquals(30, $diet['target_fat_g']); // 8 + 22
    }

    public function test_member_daily_fitness_session_set_logging_and_completion()
    {
        // Create an active workout plan
        $plan = MemberWorkoutPlan::create([
            'gym_id' => $this->gym->id,
            'branch_id' => $this->branch->id,
            'member_id' => $this->member->id,
            'trainer_id' => $this->trainer->id,
            'title' => 'Daily Strength Plan',
            'goal' => 'Strength',
            'difficulty' => 'intermediate',
            'days_per_week' => 5,
            'status' => 'active',
            'is_active' => true,
            'schedule' => [
                strtolower(now()->format('l')) => [
                    'day_name' => now()->format('l') . ' - Workout',
                    'is_rest_day' => false,
                    'exercises' => [
                        [
                            'exercise_id' => 10,
                            'name' => 'Barbell Squat',
                            'sets' => 3,
                            'reps' => '8-10',
                            'target_weight_kg' => 80,
                        ],
                    ],
                ],
            ],
        ]);

        // Get fitness today for member
        $todayRes = $this->actingAs($this->owner)
            ->getJson("/api/member-portal/fitness-today?member_id={$this->member->id}", $this->headers($this->owner));

        $todayRes->assertStatus(200);
        $this->assertFalse($todayRes->json('today_workout.is_rest_day'));

        // Log a completed set
        $logSetRes = $this->actingAs($this->owner)
            ->postJson('/api/member-portal/workout-session/log-set', [
                'member_id' => $this->member->id,
                'exercise_id' => 10,
                'exercise_name' => 'Barbell Squat',
                'set_number' => 1,
                'reps' => 10,
                'weight_kg' => 80,
            ], $this->headers($this->owner));

        $logSetRes->assertStatus(200);
        $this->assertEquals('in_progress', $logSetRes->json('session.status'));

        // Complete the workout session
        $completeRes = $this->actingAs($this->owner)
            ->postJson('/api/member-portal/workout-session/complete', [
                'member_id' => $this->member->id,
                'duration_minutes' => 45,
                'rating' => 5,
                'feedback' => 'Felt strong, squatted cleanly',
            ], $this->headers($this->owner));

        $completeRes->assertStatus(200);
        $this->assertEquals('completed', $completeRes->json('session.status'));
        $this->assertEquals(5, $completeRes->json('session.rating'));
    }

    public function test_member_meal_slot_toggle_and_progress_logging()
    {
        $diet = MemberDietPlan::create([
            'gym_id' => $this->gym->id,
            'branch_id' => $this->branch->id,
            'member_id' => $this->member->id,
            'trainer_id' => $this->trainer->id,
            'title' => 'Lean Bulk Plan',
            'goal' => 'Muscle Gain',
            'dietary_preference' => 'non_vegetarian',
            'status' => 'active',
            'target_calories' => 2400,
            'meals' => [
                ['slot_name' => 'Breakfast', 'time_hint' => '8am'],
                ['slot_name' => 'Lunch', 'time_hint' => '1pm'],
            ],
        ]);

        // Toggle breakfast completed
        $toggleRes = $this->actingAs($this->owner)
            ->postJson('/api/member-portal/meal-log/toggle', [
                'member_id' => $this->member->id,
                'slot_name' => 'Breakfast',
            ], $this->headers($this->owner));

        $toggleRes->assertStatus(200);
        $this->assertTrue($toggleRes->json('is_completed'));

        // Record progress measurements
        $progRes = $this->actingAs($this->owner)
            ->postJson('/api/member-portal/record-progress', [
                'member_id' => $this->member->id,
                'weight_kg' => 74.5,
                'body_fat_percent' => 15.2,
                'chest_cm' => 98.0,
                'waist_cm' => 81.0,
                'arms_cm' => 36.5,
            ], $this->headers($this->owner));

        $progRes->assertStatus(201);
        $this->assertEquals(74.5, $progRes->json('progress_log.weight_kg'));
    }

    public function test_trainer_fitness_overview_and_member_fitness_detail()
    {
        $overviewRes = $this->actingAs($this->trainer)
            ->getJson('/api/trainer-portal/fitness-overview', $this->headers($this->trainer));

        $overviewRes->assertStatus(200);
        $this->assertEquals(1, $overviewRes->json('metrics.assigned_members_count'));

        $detailRes = $this->actingAs($this->trainer)
            ->getJson("/api/trainer-portal/member/{$this->member->id}/fitness", $this->headers($this->trainer));

        $detailRes->assertStatus(200);
        $this->assertEquals($this->member->id, $detailRes->json('member.id'));
    }

    public function test_receptionist_cannot_access_member_workout_or_diet_plans()
    {
        $workoutRes = $this->actingAs($this->receptionist)
            ->getJson('/api/workout-plans', $this->headers($this->receptionist));

        $workoutRes->assertStatus(403);

        $dietRes = $this->actingAs($this->receptionist)
            ->getJson('/api/diet-plans', $this->headers($this->receptionist));

        $dietRes->assertStatus(403);
    }
}
