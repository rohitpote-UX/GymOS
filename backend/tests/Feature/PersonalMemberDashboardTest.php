<?php

namespace Tests\Feature;

use App\Models\AttendanceLog;
use App\Models\Branch;
use App\Models\Gym;
use App\Models\Member;
use App\Models\MemberDietPlan;
use App\Models\MemberFitnessGoal;
use App\Models\MemberProgressLog;
use App\Models\MemberWaterLog;
use App\Models\MemberWorkoutPlan;
use App\Models\MemberWorkoutSession;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PersonalMemberDashboardTest extends TestCase
{
    use RefreshDatabase;

    protected Gym $gymA;
    protected Gym $gymB;
    protected Branch $branchA;
    protected User $trainer;
    protected User $memberUserA;
    protected Member $memberA;
    protected User $memberUserB;
    protected Member $memberB;

    protected function setUp(): void
    {
        parent::setUp();

        // 1. Gym A & Branch
        $this->gymA = Gym::create([
            'name' => 'IronCore Flagship',
            'slug' => 'ironcore',
            'status' => 'active',
            'subscription_expires_at' => now()->addYear(),
        ]);
        $this->branchA = Branch::create([
            'gym_id' => $this->gymA->id,
            'name' => 'Main Club',
            'code' => 'MAIN',
            'is_primary' => true,
            'is_active' => true,
        ]);

        // 2. Trainer
        $this->trainer = User::create([
            'gym_id' => $this->gymA->id,
            'role' => 'trainer',
            'primary_branch_id' => $this->branchA->id,
            'name' => 'Vikram Malhotra',
            'email' => 'trainer@ironcore.in',
            'phone' => '9822110001',
            'password' => bcrypt('Password@123'),
            'is_active' => true,
        ]);

        // 3. Member A
        $this->memberA = Member::create([
            'gym_id' => $this->gymA->id,
            'primary_branch_id' => $this->branchA->id,
            'assigned_trainer_id' => $this->trainer->id,
            'member_code' => 'ICF-001',
            'first_name' => 'Rahul',
            'last_name' => 'Patil',
            'phone' => '9822001111',
            'email' => 'rahul@ironcore.in',
            'status' => 'active',
        ]);

        $this->memberUserA = User::create([
            'gym_id' => $this->gymA->id,
            'role' => 'member',
            'primary_branch_id' => $this->branchA->id,
            'name' => 'Rahul Patil',
            'email' => 'rahul.user@ironcore.in',
            'phone' => '9822001111',
            'password' => bcrypt('Password@123'),
            'is_active' => true,
        ]);

        // 4. Gym B & Member B (Tenant Isolation)
        $this->gymB = Gym::create([
            'name' => 'Titan Fitness',
            'slug' => 'titan',
            'status' => 'active',
            'subscription_expires_at' => now()->addYear(),
        ]);
        $branchB = Branch::create([
            'gym_id' => $this->gymB->id,
            'name' => 'Titan Club',
            'code' => 'TITAN',
            'is_primary' => true,
            'is_active' => true,
        ]);

        $this->memberB = Member::create([
            'gym_id' => $this->gymB->id,
            'primary_branch_id' => $branchB->id,
            'member_code' => 'TITAN-001',
            'first_name' => 'Rohan',
            'last_name' => 'Verma',
            'phone' => '9833002222',
            'email' => 'rohan@titan.in',
            'status' => 'active',
        ]);

        $this->memberUserB = User::create([
            'gym_id' => $this->gymB->id,
            'role' => 'member',
            'primary_branch_id' => $branchB->id,
            'name' => 'Rohan Verma',
            'email' => 'rohan.user@titan.in',
            'phone' => '9833002222',
            'password' => bcrypt('Password@123'),
            'is_active' => true,
        ]);
    }

    public function test_01_authenticated_member_sees_own_dashboard_and_assigned_trainer(): void
    {
        $this->actingAs($this->memberUserA);

        $response = $this->getJson('/api/member-portal/fitness-today');

        $response->assertStatus(200)
            ->assertJsonPath('member.first_name', 'Rahul')
            ->assertJsonPath('trainer.name', 'Vikram Malhotra')
            ->assertJsonStructure([
                'today_date',
                'day_of_week',
                'member' => ['id', 'first_name', 'full_name'],
                'water' => ['target_ml', 'consumed_ml', 'percent'],
                'progress_overview',
                'attendance_summary',
            ]);
    }

    public function test_02_member_cannot_access_another_members_fitness_data(): void
    {
        // Member B attempts to pass Member A's member_id
        $this->actingAs($this->memberUserB);

        $response = $this->getJson('/api/member-portal/fitness-today?member_id=' . $this->memberA->id);

        $response->assertStatus(200);
        // The endpoint resolves the authenticated user's member, never allowing cross-tenant member spoofing
        $this->assertEquals($this->memberB->id, $response->json('member.id'));
    }

    public function test_03_member_today_workout_resolution(): void
    {
        // Assign a workout plan to Member A
        $todayName = now()->format('l');
        MemberWorkoutPlan::create([
            'gym_id' => $this->gymA->id,
            'branch_id' => $this->branchA->id,
            'member_id' => $this->memberA->id,
            'trainer_id' => $this->trainer->id,
            'title' => 'Hypertrophy Split',
            'goal' => 'muscle_hypertrophy',
            'difficulty' => 'intermediate',
            'status' => 'active',
            'is_active' => true,
            'days_per_week' => 4,
            'schedule' => [
                [
                    'day_name' => $todayName . ' - Chest & Triceps',
                    'is_rest_day' => false,
                    'exercises' => [
                        [
                            'name' => 'Barbell Bench Press',
                            'sets' => 3,
                            'reps' => '10-12',
                            'target_weight_kg' => 60,
                            'rest_seconds' => 60,
                        ],
                        [
                            'name' => 'Incline Dumbbell Press',
                            'sets' => 3,
                            'reps' => '12',
                            'target_weight_kg' => 20,
                            'rest_seconds' => 60,
                        ],
                    ],
                ],
            ],
        ]);

        $this->actingAs($this->memberUserA);
        $response = $this->getJson('/api/member-portal/fitness-today');

        $response->assertStatus(200)
            ->assertJsonPath('today_workout.plan_title', 'Hypertrophy Split')
            ->assertJsonPath('today_workout.exercises.0.name', 'Barbell Bench Press')
            ->assertJsonPath('today_workout.status', 'not_started');
    }

    public function test_04_member_logs_workout_set_and_completes_session(): void
    {
        $plan = MemberWorkoutPlan::create([
            'gym_id' => $this->gymA->id,
            'branch_id' => $this->branchA->id,
            'member_id' => $this->memberA->id,
            'trainer_id' => $this->trainer->id,
            'title' => 'Full Body Blast',
            'status' => 'active',
            'is_active' => true,
            'exercises' => [],
        ]);

        $this->actingAs($this->memberUserA);

        // 1. Log Set 1
        $resSet1 = $this->postJson('/api/member-portal/workout-session/log-set', [
            'workout_plan_id' => $plan->id,
            'day_name' => 'Leg Day',
            'exercise_name' => 'Barbell Squat',
            'set_number' => 1,
            'reps' => 10,
            'weight_kg' => 80,
        ]);
        $resSet1->assertStatus(200);

        // Verify session created in progress
        $session = MemberWorkoutSession::where('member_id', $this->memberA->id)->first();
        $this->assertNotNull($session);
        $this->assertEquals('in_progress', $session->status);
        $this->assertCount(1, $session->set_logs);

        // 2. Complete workout session
        $resComplete = $this->postJson('/api/member-portal/workout-session/complete', [
            'workout_plan_id' => $plan->id,
            'day_name' => 'Leg Day',
            'duration_minutes' => 50,
            'rating' => 5,
            'notes' => 'Felt strong, good depth on squats!',
        ]);

        $resComplete->assertStatus(200);
        $session->refresh();
        $this->assertEquals('completed', $session->status);
        $this->assertEquals(50, $session->duration_minutes);
        $this->assertEquals(5, $session->rating);
    }

    public function test_05_water_intake_tracking_and_increment(): void
    {
        $this->actingAs($this->memberUserA);

        // 1. Initial water is 0
        $resInitial = $this->getJson('/api/member-portal/fitness-today');
        $resInitial->assertStatus(200)
            ->assertJsonPath('water.consumed_ml', 0);

        // 2. One-tap add 250ml
        $resAdd1 = $this->postJson('/api/member-portal/water-log', [
            'amount_ml' => 250,
            'action' => 'add',
        ]);
        $resAdd1->assertStatus(200)
            ->assertJsonPath('water.consumed_ml', 250);

        // 3. One-tap add another 250ml -> 500ml
        $resAdd2 = $this->postJson('/api/member-portal/water-log', [
            'amount_ml' => 250,
            'action' => 'add',
        ]);
        $resAdd2->assertStatus(200)
            ->assertJsonPath('water.consumed_ml', 500);

        // Database verified
        $log = MemberWaterLog::where('member_id', $this->memberA->id)->first();
        $this->assertEquals(500, $log->consumed_ml);
    }

    public function test_06_member_diet_plan_and_meal_completion_toggle(): void
    {
        $diet = MemberDietPlan::create([
            'gym_id' => $this->gymA->id,
            'branch_id' => $this->branchA->id,
            'member_id' => $this->memberA->id,
            'trainer_id' => $this->trainer->id,
            'title' => 'Lean Muscle Nutrition',
            'status' => 'active',
            'dietary_preference' => 'vegetarian',
            'target_calories' => 2200,
            'target_protein_g' => 140,
            'target_carbs_g' => 240,
            'target_fat_g' => 60,
            'water_target_ml' => 3000,
            'meals' => [
                [
                    'slot' => 'breakfast',
                    'slot_title' => 'Breakfast',
                    'time' => '08:00 AM',
                    'items' => [
                        ['food_name' => 'Oats with Milk', 'quantity' => '60g', 'calories' => 320],
                    ],
                ],
                [
                    'slot' => 'lunch',
                    'slot_title' => 'Lunch',
                    'time' => '01:30 PM',
                    'items' => [
                        ['food_name' => 'Paneer & Brown Rice', 'quantity' => '150g', 'calories' => 550],
                    ],
                ],
            ],
        ]);

        $this->actingAs($this->memberUserA);

        // Toggle breakfast as eaten
        $resToggle = $this->postJson('/api/member-portal/meal-log/toggle', [
            'diet_plan_id' => $diet->id,
            'meal_slot' => 'breakfast',
            'is_completed' => true,
        ]);

        $resToggle->assertStatus(200)
            ->assertJsonPath('is_completed', true);

        // Verify in fitnessToday
        $resToday = $this->getJson('/api/member-portal/fitness-today');
        $resToday->assertStatus(200)
            ->assertJsonPath('today_diet.completed_meals_count', 1)
            ->assertJsonPath('today_diet.completion_percent', 50)
            ->assertJsonPath('water.target_ml', 3000);
    }

    public function test_07_member_self_measurement_and_progress_trends(): void
    {
        $this->actingAs($this->memberUserA);

        // Record measurement
        $resLog = $this->postJson('/api/member-portal/record-progress', [
            'weight_kg' => 78.5,
            'waist_cm' => 84.0,
            'chest_cm' => 102.0,
            'arms_cm' => 38.0,
            'notes' => 'Month 1 progress check',
        ]);

        $resLog->assertStatus(201)
            ->assertJsonPath('log.weight_kg', '78.50');

        // Retrieve my progress
        $resProgress = $this->getJson('/api/member-portal/my-progress');
        $resProgress->assertStatus(200);
        $this->assertEquals(78.5, (float) $resProgress->json('stats.current_weight'));
    }

    public function test_08_member_fitness_goals_creation_and_progress(): void
    {
        $this->actingAs($this->memberUserA);

        $resGoal = $this->postJson('/api/member-portal/goals', [
            'title' => 'Reach 75 kg Target Weight',
            'category' => 'weight',
            'start_value' => 82.0,
            'current_value' => 78.0,
            'target_value' => 75.0,
            'unit' => 'kg',
            'notes' => 'Healthy steady fat loss',
        ]);

        $resGoal->assertStatus(201)
            ->assertJsonPath('goal.title', 'Reach 75 kg Target Weight');

        $goal = MemberFitnessGoal::where('member_id', $this->memberA->id)->first();
        // Start: 82, Target: 75 (total diff = 7). Current: 78 (achieved diff = 4). Percent: (4/7) * 100 = 57%
        $this->assertEquals(57, $goal->progress_percent);
    }

    public function test_09_attendance_calendar_returns_visited_dates(): void
    {
        $this->actingAs($this->memberUserA);

        // Mark 2 check-ins on different days
        AttendanceLog::create([
            'gym_id' => $this->gymA->id,
            'branch_id' => $this->branchA->id,
            'member_id' => $this->memberA->id,
            'person_type' => 'member',
            'check_in_at' => now(),
            'method' => 'qr_code',
        ]);

        $resAtt = $this->getJson('/api/member-portal/attendance');
        $resAtt->assertStatus(200)
            ->assertJsonPath('total_visits_this_month', 1)
            ->assertJsonStructure([
                'visited_dates',
                'streak_days',
                'last_check_in',
            ]);
        $this->assertContains(now()->toDateString(), $resAtt->json('visited_dates'));
    }

    public function test_10_30_day_progress_summary_report(): void
    {
        $this->actingAs($this->memberUserA);

        // Create 1 progress log
        MemberProgressLog::create([
            'gym_id' => $this->gymA->id,
            'member_id' => $this->memberA->id,
            'log_date' => now()->toDateString(),
            'weight_kg' => 77.0,
        ]);

        $resSummary = $this->getJson('/api/member-portal/summary-30-days');
        $resSummary->assertStatus(200)
            ->assertJsonPath('days', 30);
        $this->assertEquals(77.0, (float) $resSummary->json('current_weight'));
    }
}
