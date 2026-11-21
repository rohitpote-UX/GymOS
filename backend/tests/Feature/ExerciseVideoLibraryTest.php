<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\Exercise;
use App\Models\ExerciseCategory;
use App\Models\ExerciseVideo;
use App\Models\Gym;
use App\Models\GymExerciseVideoOverride;
use App\Models\Member;
use App\Models\MemberWorkoutPlan;
use App\Models\SaasPlan;
use App\Models\User;
use App\Services\ExerciseVideoResolverService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ExerciseVideoLibraryTest extends TestCase
{
    use RefreshDatabase;

    private User $superAdmin;
    private Gym $gymA;
    private Gym $gymB;
    private Branch $branchA;
    private Branch $branchB;
    private User $ownerA;
    private User $ownerB;
    private User $trainerA;
    private Member $memberA;
    private Member $memberB;
    private Exercise $squatExercise;

    protected function setUp(): void
    {
        parent::setUp();

        SaasPlan::create([
            'name' => 'Enterprise Plan',
            'code' => 'enterprise',
            'price' => 5999,
            'billing_cycle' => 'monthly',
            'max_branches' => 5,
            'max_members' => 1000,
            'features' => ['all'],
            'is_active' => true,
        ]);

        // Platform Super Admin
        $this->superAdmin = User::create([
            'gym_id' => null,
            'name' => 'Platform Super Admin',
            'email' => 'superadmin@antigravityfit.com',
            'password' => bcrypt('AdminPass123'),
            'role' => User::ROLE_SUPER_ADMIN,
            'is_active' => true,
        ]);

        // Gym A (Pune)
        $this->gymA = Gym::create([
            'name' => 'PowerFit Gym Pune',
            'slug' => 'powerfit-pune',
            'currency' => 'INR',
            'status' => 'active',
        ]);
        $this->branchA = Branch::create([
            'gym_id' => $this->gymA->id,
            'name' => 'Kothrud Branch',
            'code' => 'KOT',
            'is_primary' => true,
            'is_active' => true,
        ]);
        $this->ownerA = User::create([
            'gym_id' => $this->gymA->id,
            'current_branch_id' => $this->branchA->id,
            'name' => 'Vikram Patil',
            'email' => 'vikram@powerfit.com',
            'password' => bcrypt('password123'),
            'role' => User::ROLE_GYM_OWNER,
            'is_active' => true,
        ]);
        $this->trainerA = User::create([
            'gym_id' => $this->gymA->id,
            'current_branch_id' => $this->branchA->id,
            'name' => 'Trainer Amit',
            'email' => 'amit@powerfit.com',
            'password' => bcrypt('password123'),
            'role' => User::ROLE_TRAINER,
            'is_active' => true,
        ]);
        $this->memberA = Member::create([
            'gym_id' => $this->gymA->id,
            'primary_branch_id' => $this->branchA->id,
            'member_code' => 'MEM-A-001',
            'first_name' => 'Rohan',
            'last_name' => 'Deshmukh',
            'phone' => '9820011111',
            'membership_status' => 'active',
        ]);

        // Gym B (Mumbai)
        $this->gymB = Gym::create([
            'name' => 'IronCore Gym Mumbai',
            'slug' => 'ironcore-mumbai',
            'currency' => 'INR',
            'status' => 'active',
        ]);
        $this->branchB = Branch::create([
            'gym_id' => $this->gymB->id,
            'name' => 'Bandra Branch',
            'code' => 'BDR',
            'is_primary' => true,
            'is_active' => true,
        ]);
        $this->ownerB = User::create([
            'gym_id' => $this->gymB->id,
            'current_branch_id' => $this->branchB->id,
            'name' => 'Sunil Shetty',
            'email' => 'sunil@ironcore.com',
            'password' => bcrypt('password123'),
            'role' => User::ROLE_GYM_OWNER,
            'is_active' => true,
        ]);
        $this->memberB = Member::create([
            'gym_id' => $this->gymB->id,
            'primary_branch_id' => $this->branchB->id,
            'member_code' => 'MEM-B-001',
            'first_name' => 'Karan',
            'last_name' => 'Malhotra',
            'phone' => '9820022222',
            'membership_status' => 'active',
        ]);

        // Create Leg Muscle Category
        ExerciseCategory::create([
            'name' => 'Legs',
            'name_mr' => 'पाय',
            'name_hi' => 'पैर',
            'slug' => 'legs',
            'type' => 'muscle_group',
            'sort_order' => 1,
            'is_active' => true,
        ]);

        // Create Squat Exercise
        $this->squatExercise = Exercise::create([
            'name' => 'Barbell Back Squat',
            'name_mr' => 'बार्बेल बॅक स्क्वॉट',
            'name_hi' => 'बारबेल बैक स्क्वाट',
            'code' => 'EX-LEG-01',
            'category' => 'legs',
            'target_muscle_group' => 'Quadriceps & Glutes',
            'exercise_type' => 'strength_training',
            'equipment_required' => 'barbells',
            'difficulty_level' => 'intermediate',
            'instructions' => 'Keep chest tall, push hips back, and squat until thighs are parallel to floor.',
            'safety_notes' => 'Do not allow knees to cave inward during ascent.',
            'is_system' => true,
            'is_active' => true,
        ]);
    }

    private function headers(Gym $gym, Branch $branch): array
    {
        return [
            'X-Gym-ID' => $gym->id,
            'X-Branch-ID' => $branch->id,
        ];
    }

    /**
     * Test Scenario 1: Super Admin publishes a global video for Squats.
     */
    public function test_01_super_admin_publishes_global_video(): void
    {
        Sanctum::actingAs($this->superAdmin);

        $response = $this->postJson('/api/admin/exercise-library/videos', [
            'exercise_id' => $this->squatExercise->id,
            'title' => 'How To Squat with Perfect Form',
            'provider' => 'youtube',
            'video_url' => 'https://www.youtube.com/watch?v=ultWZbUMPL8',
            'creator_name' => 'Alan Thrall',
            'attribution_text' => 'Alan Thrall / Untamed Strength',
            'rights_status' => 'public_embed_allowed',
            'content_source' => 'youtube',
            'duration_seconds' => 520,
            'is_primary' => true,
        ]);

        $response->assertStatus(201);
        $response->assertJsonPath('provider', 'youtube');
        $response->assertJsonPath('video_id', 'ultWZbUMPL8');
        $response->assertJsonPath('embed_url', 'https://www.youtube-nocookie.com/embed/ultWZbUMPL8?rel=0&modestbranding=1&enablejsapi=1');
        $this->assertNull($response->json('gym_id'));

        $this->assertDatabaseHas('exercise_videos', [
            'exercise_id' => $this->squatExercise->id,
            'gym_id' => null,
            'video_id' => 'ultWZbUMPL8',
            'status' => 'approved',
        ]);
    }

    /**
     * Test Scenarios 2 & 3: Two different gyms access the same exercise and both see the global tutorial.
     */
    public function test_02_and_03_both_gyms_see_global_tutorial_by_default(): void
    {
        // Seed global video
        $globalVideo = ExerciseVideo::create([
            'exercise_id' => $this->squatExercise->id,
            'gym_id' => null,
            'title' => 'Global Squat Tutorial',
            'provider' => 'youtube',
            'video_id' => 'ultWZbUMPL8',
            'video_url' => 'https://www.youtube.com/watch?v=ultWZbUMPL8',
            'embed_url' => 'https://www.youtube-nocookie.com/embed/ultWZbUMPL8?rel=0&modestbranding=1&enablejsapi=1',
            'thumbnail_url' => 'https://img.youtube.com/vi/ultWZbUMPL8/hqdefault.jpg',
            'content_source' => 'youtube',
            'rights_status' => 'public_embed_allowed',
            'status' => 'approved',
            'is_primary' => true,
            'is_active' => true,
            'health_status' => 'healthy',
        ]);
        $this->squatExercise->update(['default_video_id' => $globalVideo->id]);

        // Gym A accesses exercise library
        Sanctum::actingAs($this->ownerA);
        $resA = $this->getJson("/api/exercise-library/{$this->squatExercise->id}");
        $resA->assertStatus(200);
        $resA->assertJsonPath('resolved_video.has_playable_video', true);
        $resA->assertJsonPath('resolved_video.source_indicator', 'platform_global');
        $resA->assertJsonPath('resolved_video.video_id', 'ultWZbUMPL8');
        $resA->assertJsonPath('current_override', null);

        // Gym B accesses exercise library
        Sanctum::actingAs($this->ownerB);
        $resB = $this->getJson("/api/exercise-library/{$this->squatExercise->id}");
        $resB->assertStatus(200);
        $resB->assertJsonPath('resolved_video.has_playable_video', true);
        $resB->assertJsonPath('resolved_video.source_indicator', 'platform_global');
        $resB->assertJsonPath('resolved_video.video_id', 'ultWZbUMPL8');
        $resB->assertJsonPath('current_override', null);
    }

    /**
     * Test Scenarios 4, 5 & 6: Gym A uploads custom Squat tutorial.
     * Gym A members now see Gym A's tutorial. Gym B continues seeing global tutorial.
     */
    public function test_04_05_06_gym_a_custom_video_overrides_for_gym_a_only(): void
    {
        // 1. Setup global tutorial
        $globalVideo = ExerciseVideo::create([
            'exercise_id' => $this->squatExercise->id,
            'gym_id' => null,
            'title' => 'Global Squat Tutorial',
            'provider' => 'youtube',
            'video_id' => 'ultWZbUMPL8',
            'video_url' => 'https://www.youtube.com/watch?v=ultWZbUMPL8',
            'embed_url' => 'https://www.youtube-nocookie.com/embed/ultWZbUMPL8?rel=0&modestbranding=1&enablejsapi=1',
            'thumbnail_url' => 'https://img.youtube.com/vi/ultWZbUMPL8/hqdefault.jpg',
            'content_source' => 'youtube',
            'rights_status' => 'public_embed_allowed',
            'status' => 'approved',
            'is_primary' => true,
            'is_active' => true,
            'health_status' => 'healthy',
        ]);
        $this->squatExercise->update(['default_video_id' => $globalVideo->id]);

        // 2. Gym A uploads custom video
        Sanctum::actingAs($this->ownerA);
        $resUpload = $this->postJson("/api/exercise-library/{$this->squatExercise->id}/custom-video", [
            'title' => 'PowerFit Exclusive: Coach Vikram Squat Masterclass',
            'provider' => 'youtube',
            'video_url' => 'https://www.youtube.com/watch?v=bEv6CCg2BC8',
            'creator_name' => 'Coach Vikram',
            'set_as_active_override' => true,
        ]);

        $resUpload->assertStatus(201);
        $resUpload->assertJsonPath('resolved_video.source_indicator', 'gym_custom');
        $resUpload->assertJsonPath('resolved_video.video_id', 'bEv6CCg2BC8');

        // 3. Gym A member checks exercise library
        Sanctum::actingAs($this->ownerA);
        $resMemberA = $this->getJson("/api/member-portal/exercise-library?member_id={$this->memberA->id}&search=Squat", $this->headers($this->gymA, $this->branchA));
        $resMemberA->assertStatus(200);
        $itemsA = $resMemberA->json('exercises');
        $this->assertNotEmpty($itemsA);
        $this->assertEquals('gym_custom', $itemsA[0]['resolved_video']['source_indicator']);
        $this->assertEquals('bEv6CCg2BC8', $itemsA[0]['resolved_video']['video_id']);

        // 4. Gym B member checks exercise library (Gym B MUST still see global tutorial!)
        Sanctum::actingAs($this->ownerB);
        $resMemberB = $this->getJson("/api/member-portal/exercise-library?member_id={$this->memberB->id}&search=Squat", $this->headers($this->gymB, $this->branchB));
        $resMemberB->assertStatus(200);
        $itemsB = $resMemberB->json('exercises');
        $this->assertNotEmpty($itemsB);
        $this->assertEquals('platform_global', $itemsB[0]['resolved_video']['source_indicator']);
        $this->assertEquals('ultWZbUMPL8', $itemsB[0]['resolved_video']['video_id']);
    }

    /**
     * Test Scenarios 7 & 8: Gym A deactivates custom video and automatically returns to global tutorial.
     */
    public function test_07_08_gym_a_deactivates_override_and_returns_to_global_tutorial(): void
    {
        // Setup global
        ExerciseVideo::create([
            'exercise_id' => $this->squatExercise->id,
            'gym_id' => null,
            'title' => 'Global Squat Tutorial',
            'provider' => 'youtube',
            'video_id' => 'ultWZbUMPL8',
            'video_url' => 'https://www.youtube.com/watch?v=ultWZbUMPL8',
            'embed_url' => 'https://www.youtube-nocookie.com/embed/ultWZbUMPL8?rel=0&modestbranding=1&enablejsapi=1',
            'content_source' => 'youtube',
            'rights_status' => 'public_embed_allowed',
            'status' => 'approved',
            'is_primary' => true,
            'is_active' => true,
        ]);

        // Setup Gym A custom video and override
        $customVideo = ExerciseVideo::create([
            'exercise_id' => $this->squatExercise->id,
            'gym_id' => $this->gymA->id,
            'title' => 'Gym A Squat Tutorial',
            'provider' => 'youtube',
            'video_id' => 'bEv6CCg2BC8',
            'video_url' => 'https://www.youtube.com/watch?v=bEv6CCg2BC8',
            'embed_url' => 'https://www.youtube-nocookie.com/embed/bEv6CCg2BC8?rel=0&modestbranding=1&enablejsapi=1',
            'content_source' => 'gym_custom',
            'rights_status' => 'gym_owned',
            'status' => 'approved',
            'is_primary' => true,
            'is_active' => true,
        ]);

        GymExerciseVideoOverride::create([
            'gym_id' => $this->gymA->id,
            'exercise_id' => $this->squatExercise->id,
            'exercise_video_id' => $customVideo->id,
            'is_active' => true,
        ]);

        // Gym A owner restores platform default
        Sanctum::actingAs($this->ownerA);
        $resRestore = $this->postJson("/api/exercise-library/{$this->squatExercise->id}/restore-default");
        $resRestore->assertStatus(200);
        $resRestore->assertJsonPath('resolved_video.source_indicator', 'platform_global');
        $resRestore->assertJsonPath('resolved_video.video_id', 'ultWZbUMPL8');

        // Member A also automatically sees the global tutorial now
        Sanctum::actingAs($this->ownerA);
        $resMember = $this->getJson("/api/member-portal/exercise-library?member_id={$this->memberA->id}&search=Squat", $this->headers($this->gymA, $this->branchA));
        $items = $resMember->json('exercises');
        $this->assertEquals('platform_global', $items[0]['resolved_video']['source_indicator']);
        $this->assertEquals('ultWZbUMPL8', $items[0]['resolved_video']['video_id']);
    }

    /**
     * Test Scenarios 9 & 10: Super Admin updates global tutorial, and both gyms receive it instantly.
     */
    public function test_09_10_super_admin_updates_global_tutorial_propagates_to_all_unoverridden_gyms(): void
    {
        // 1. Initial global video
        $globalVideo = ExerciseVideo::create([
            'exercise_id' => $this->squatExercise->id,
            'gym_id' => null,
            'title' => 'Old Global Squat Tutorial',
            'provider' => 'youtube',
            'video_id' => 'oldVideoId123',
            'video_url' => 'https://www.youtube.com/watch?v=oldVideoId123',
            'embed_url' => 'https://www.youtube-nocookie.com/embed/oldVideoId123?rel=0&modestbranding=1&enablejsapi=1',
            'status' => 'approved',
            'is_primary' => true,
            'is_active' => true,
        ]);

        // 2. Super Admin adds new, higher quality global video
        Sanctum::actingAs($this->superAdmin);
        $resUpdate = $this->postJson('/api/admin/exercise-library/videos', [
            'exercise_id' => $this->squatExercise->id,
            'title' => 'Updated 4K Squat Masterclass Tutorial',
            'provider' => 'youtube',
            'video_url' => 'https://www.youtube.com/watch?v=newVideo4K999',
            'rights_status' => 'public_embed_allowed',
            'content_source' => 'youtube',
            'is_primary' => true,
        ]);
        $resUpdate->assertStatus(201);
        $resUpdate->assertJsonPath('video_id', 'newVideo4K999');

        // 3. Both Gym A and Gym B automatically resolve to the new tutorial without manual configuration
        $resolver = app(ExerciseVideoResolverService::class);
        $resolvedA = $resolver->resolveExerciseVideo($this->squatExercise->id, $this->gymA->id);
        $resolvedB = $resolver->resolveExerciseVideo($this->squatExercise->id, $this->gymB->id);

        $this->assertEquals('newVideo4K999', $resolvedA['video_id']);
        $this->assertEquals('newVideo4K999', $resolvedB['video_id']);
    }

    /**
     * Test Scenario 11: Member opens assigned workout and sees correct video.
     */
    public function test_11_member_opens_assigned_workout_sees_correct_video(): void
    {
        // Create global video
        ExerciseVideo::create([
            'exercise_id' => $this->squatExercise->id,
            'gym_id' => null,
            'title' => 'Squat Tutorial',
            'provider' => 'youtube',
            'video_id' => 'ultWZbUMPL8',
            'video_url' => 'https://www.youtube.com/watch?v=ultWZbUMPL8',
            'embed_url' => 'https://www.youtube-nocookie.com/embed/ultWZbUMPL8?rel=0&modestbranding=1&enablejsapi=1',
            'status' => 'approved',
            'is_primary' => true,
            'is_active' => true,
        ]);

        // Assign workout plan to member A
        Sanctum::actingAs($this->ownerA);
        MemberWorkoutPlan::create([
            'gym_id' => $this->gymA->id,
            'member_id' => $this->memberA->id,
            'trainer_id' => $this->trainerA->id,
            'title' => 'Leg Day Hypertrophy',
            'goal' => 'strength',
            'difficulty' => 'intermediate',
            'start_date' => now()->toDateString(),
            'status' => 'active',
            'schedule' => [
                [
                    'day_name' => now()->format('l'), // Today's day name
                    'is_rest_day' => false,
                    'exercises' => [
                        [
                            'exercise_id' => $this->squatExercise->id,
                            'name' => 'Barbell Back Squat',
                            'sets' => 4,
                            'reps' => '8-10',
                            'rest_seconds' => 90,
                        ],
                    ],
                ],
            ],
        ]);

        Sanctum::actingAs($this->ownerA);
        $response = $this->getJson("/api/member-portal/fitness-today?member_id={$this->memberA->id}", $this->headers($this->gymA, $this->branchA));
        $response->assertStatus(200);
        $response->assertJsonPath('today_workout.status', 'not_started');
        $exercises = $response->json('today_workout.exercises');
        $this->assertNotEmpty($exercises);
        $this->assertTrue($exercises[0]['has_playable_video']);
        $this->assertEquals('platform_global', $exercises[0]['video_source']);
        $this->assertEquals('https://www.youtube-nocookie.com/embed/ultWZbUMPL8?rel=0&modestbranding=1&enablejsapi=1', $exercises[0]['video_url']);
    }

    /**
     * Test Scenario 12: Fallback to instructions and image when video is missing or inactive.
     */
    public function test_12_fallback_to_instructions_only_when_no_video_exists(): void
    {
        $exerciseNoVideo = Exercise::create([
            'name' => 'Tibialis Raises',
            'code' => 'EX-LEG-99',
            'category' => 'legs',
            'instructions' => 'Lean against a wall, lift toes toward shins, pause for 1 second, lower slowly.',
            'safety_notes' => 'Do not lock out knees abruptly.',
            'image_url' => 'https://cdn.example.com/exercises/tibialis.jpg',
            'is_system' => true,
            'is_active' => true,
        ]);

        $resolver = app(ExerciseVideoResolverService::class);
        $resolved = $resolver->resolveExerciseVideo($exerciseNoVideo->id, $this->gymA->id);

        $this->assertFalse($resolved['has_playable_video']);
        $this->assertEquals('instructions_only', $resolved['source_indicator']);
        $this->assertEquals('Instructions Only', $resolved['source_label']);
        $this->assertStringContainsString('Lean against a wall', $resolved['instructions']);
    }

    /**
     * Test Scenario 13: Unauthorized users cannot modify global content.
     */
    public function test_13_unauthorized_users_blocked_from_super_admin_exercise_routes(): void
    {
        // Gym Owner tries to access Super Admin video library overview
        Sanctum::actingAs($this->ownerA);
        $resOwner = $this->getJson('/api/admin/exercise-library/overview');
        $resOwner->assertStatus(403);

        // Trainer tries to delete a global video
        Sanctum::actingAs($this->trainerA);
        $resTrainer = $this->deleteJson('/api/admin/exercise-library/videos/1');
        $resTrainer->assertStatus(403);

        // Front desk user tries to create a category
        $frontDesk = User::create([
            'gym_id' => $this->gymA->id,
            'primary_branch_id' => $this->branchA->id,
            'name' => 'Front Desk Staff',
            'email' => 'desk@powerfit.com',
            'password' => bcrypt('password123'),
            'role' => User::ROLE_FRONT_DESK,
            'is_active' => true,
        ]);
        Sanctum::actingAs($frontDesk);
        $resMember = $this->postJson('/api/admin/exercise-library/categories', [
            'name' => 'Hacker Category',
            'type' => 'muscle_group',
        ]);
        $resMember->assertStatus(403);
    }

    /**
     * Test Scenario 14: Cross-tenant isolation is strictly maintained.
     */
    public function test_14_cross_tenant_isolation_strictly_enforced(): void
    {
        // Gym A custom video
        $gymAVideo = ExerciseVideo::create([
            'exercise_id' => $this->squatExercise->id,
            'gym_id' => $this->gymA->id,
            'title' => 'Gym A Private Squat Tutorial',
            'provider' => 'youtube',
            'video_id' => 'privateA123',
            'video_url' => 'https://www.youtube.com/watch?v=privateA123',
            'embed_url' => 'https://www.youtube-nocookie.com/embed/privateA123',
            'status' => 'approved',
            'is_primary' => true,
            'is_active' => true,
        ]);

        // Gym B owner accesses exercise library: gym_videos list must NOT contain Gym A's private video!
        Sanctum::actingAs($this->ownerB);
        $res = $this->getJson("/api/exercise-library/{$this->squatExercise->id}");
        $res->assertStatus(200);

        $gymVideos = $res->json('gym_videos');
        foreach ($gymVideos as $v) {
            $this->assertNotEquals($this->gymA->id, $v['gym_id']);
            $this->assertNotEquals($gymAVideo->id, $v['id']);
        }
    }

    /**
     * Test Scenario 15: Multilingual names (English, Marathi, Hindi) work correctly.
     */
    public function test_15_multilingual_exercise_names(): void
    {
        $this->assertEquals('Barbell Back Squat', $this->squatExercise->name);
        $this->assertEquals('बार्बेल बॅक स्क्वॉट', $this->squatExercise->name_mr);
        $this->assertEquals('बारबेल बैक स्क्वाट', $this->squatExercise->name_hi);

        Sanctum::actingAs($this->ownerA);
        $response = $this->getJson('/api/exercise-library');
        $response->assertStatus(200);
        $squat = collect($response->json())->firstWhere('id', $this->squatExercise->id);

        $this->assertNotNull($squat);
        $this->assertEquals('बार्बेल बॅक स्क्वॉट', $squat['name_mr']);
        $this->assertEquals('बारबेल बैक स्क्वाट', $squat['name_hi']);
    }

    /**
     * Test Scenario 16: Privacy-enhanced embed URL generator for YouTube compliance.
     */
    public function test_16_privacy_enhanced_youtube_embed_generation(): void
    {
        $resolver = app(ExerciseVideoResolverService::class);

        $embed1 = $resolver->generateSafeEmbedUrl('youtube', 'rT7DgCr-3pg');
        $this->assertEquals('https://www.youtube-nocookie.com/embed/rT7DgCr-3pg?rel=0&modestbranding=1&enablejsapi=1', $embed1);

        $extractedId = $resolver->extractYouTubeId('https://youtu.be/ultWZbUMPL8?si=xyz123');
        $this->assertEquals('ultWZbUMPL8', $extractedId);
    }
}
