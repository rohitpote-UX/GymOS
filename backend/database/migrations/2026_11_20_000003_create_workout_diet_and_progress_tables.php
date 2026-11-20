<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Exercise Library
        Schema::create('exercises', function (Blueprint $table) {
            $table->id();
            $table->foreignId('gym_id')->nullable()->constrained('gyms')->cascadeOnDelete();
            $table->string('name', 150);
            $table->string('name_mr', 150)->nullable();
            $table->string('name_hi', 150)->nullable();
            $table->string('category', 40)->default('full_body'); // chest, back, shoulders, biceps, triceps, legs, core, cardio, full_body, mobility
            $table->string('target_muscle_group', 100)->nullable();
            $table->string('equipment_required', 60)->default('bodyweight'); // barbell, dumbbell, cable, machine, bodyweight, kettlebell, resistance_band
            $table->string('difficulty_level', 20)->default('intermediate'); // beginner, intermediate, advanced
            $table->text('instructions')->nullable();
            $table->text('common_mistakes')->nullable();
            $table->text('safety_notes')->nullable();
            $table->unsignedInteger('default_sets')->default(3);
            $table->string('default_reps', 30)->default('10-12');
            $table->unsignedInteger('default_rest_seconds')->default(60);
            $table->string('image_url', 255)->nullable();
            $table->string('video_url', 255)->nullable();
            $table->boolean('is_system')->default(false);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['gym_id', 'category', 'is_active']);
        });

        // 2. Workout Templates (Ready-made & Custom)
        Schema::create('workout_templates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('gym_id')->nullable()->constrained('gyms')->cascadeOnDelete();
            $table->foreignId('created_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('title', 150);
            $table->string('goal', 60)->default('general_fitness'); // beginner_fitness, weight_loss, muscle_hypertrophy, strength_training, general_fitness, home_workout, push_pull_legs, upper_lower
            $table->string('difficulty', 20)->default('intermediate'); // beginner, intermediate, advanced
            $table->unsignedInteger('days_per_week')->default(4);
            $table->string('split_type', 60)->nullable(); // PPL, Upper/Lower, Bro Split, Full Body
            $table->text('description')->nullable();
            $table->json('schedule'); // Array of routine days: [{day_name: 'Day 1 - Chest & Triceps', is_rest_day: false, exercises: [...]}]
            $table->boolean('is_system')->default(false);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['gym_id', 'goal', 'is_active']);
        });

        // 3. Member Workout Sessions / Logs (Day completion & set records)
        Schema::create('member_workout_sessions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('gym_id')->constrained('gyms')->cascadeOnDelete();
            $table->foreignId('branch_id')->nullable()->constrained('branches')->nullOnDelete();
            $table->foreignId('member_id')->constrained('members')->cascadeOnDelete();
            $table->foreignId('workout_plan_id')->nullable()->constrained('member_workout_plans')->nullOnDelete();
            $table->date('session_date')->index();
            $table->string('day_name', 100); // e.g. "Monday - Chest & Triceps" or "Day 1"
            $table->string('status', 30)->default('completed'); // in_progress, completed, skipped
            $table->unsignedInteger('duration_minutes')->default(45);
            $table->json('set_logs')->nullable(); // [{exercise_id, exercise_name, set_number, reps, weight_kg, completed: true}]
            $table->text('notes')->nullable();
            $table->unsignedTinyInteger('rating')->nullable(); // 1-5
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();

            $table->index(['gym_id', 'member_id', 'session_date']);
        });

        // 4. Food Library & Nutrition Database
        Schema::create('foods', function (Blueprint $table) {
            $table->id();
            $table->foreignId('gym_id')->nullable()->constrained('gyms')->cascadeOnDelete();
            $table->string('name', 150);
            $table->string('name_mr', 150)->nullable();
            $table->string('name_hi', 150)->nullable();
            $table->decimal('serving_size', 8, 2)->default(1.0);
            $table->string('serving_unit', 40)->default('grams'); // piece, katori_bowl, grams, ml, scoop, tbsp
            $table->decimal('calories', 8, 2);
            $table->decimal('protein_g', 8, 2)->default(0);
            $table->decimal('carbs_g', 8, 2)->default(0);
            $table->decimal('fat_g', 8, 2)->default(0);
            $table->decimal('fiber_g', 8, 2)->default(0);
            $table->string('category', 50)->default('general'); // grains, dairy, poultry_meat, lentils_dal, vegetables, fruits, nuts_seeds, supplements
            $table->json('dietary_tags')->nullable(); // ['veg', 'high_protein', 'gluten_free', etc.]
            $table->boolean('is_system')->default(false);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['gym_id', 'category', 'is_active']);
        });

        // 5. Diet Templates (Ready-made starting plans)
        Schema::create('diet_templates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('gym_id')->nullable()->constrained('gyms')->cascadeOnDelete();
            $table->foreignId('created_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('title', 150);
            $table->string('goal', 60)->default('balanced'); // balanced, muscle_gain, fat_loss, weight_management, vegetarian, high_protein, general_fitness
            $table->string('dietary_preference', 40)->default('vegetarian'); // vegetarian, non_vegetarian, vegan, eggetarian
            $table->unsignedInteger('target_calories')->default(2000);
            $table->unsignedInteger('target_protein_g')->default(120);
            $table->unsignedInteger('target_carbs_g')->default(220);
            $table->unsignedInteger('target_fat_g')->default(60);
            $table->json('meals'); // [{slot: 'breakfast', time: '08:30 AM', items: [{food_id, name, quantity, unit, calories, protein, carbs, fat, prep_notes}]}]
            $table->boolean('is_system')->default(false);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['gym_id', 'goal', 'is_active']);
        });

        // 6. Member Diet Plans
        Schema::create('member_diet_plans', function (Blueprint $table) {
            $table->id();
            $table->foreignId('gym_id')->constrained('gyms')->cascadeOnDelete();
            $table->foreignId('branch_id')->nullable()->constrained('branches')->nullOnDelete();
            $table->foreignId('member_id')->constrained('members')->cascadeOnDelete();
            $table->foreignId('trainer_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('title', 150);
            $table->string('goal', 60)->default('balanced');
            $table->string('dietary_preference', 40)->default('vegetarian');
            $table->text('food_allergies')->nullable();
            $table->text('food_preferences')->nullable();
            $table->unsignedInteger('target_calories')->default(2000);
            $table->unsignedInteger('target_protein_g')->default(120);
            $table->unsignedInteger('target_carbs_g')->default(220);
            $table->unsignedInteger('target_fat_g')->default(60);
            $table->json('meals'); // Array of meal slots with items and nutrition totals
            $table->unsignedInteger('version')->default(1);
            $table->foreignId('parent_plan_id')->nullable()->constrained('member_diet_plans')->nullOnDelete();
            $table->string('status', 30)->default('active'); // draft, active, paused, completed, archived
            $table->date('start_date');
            $table->date('end_date')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['gym_id', 'member_id', 'status']);
        });

        // 7. Member Daily Meal Logs
        Schema::create('member_meal_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('gym_id')->constrained('gyms')->cascadeOnDelete();
            $table->foreignId('member_id')->constrained('members')->cascadeOnDelete();
            $table->foreignId('diet_plan_id')->nullable()->constrained('member_diet_plans')->nullOnDelete();
            $table->date('log_date')->index();
            $table->string('meal_slot', 40); // early_morning, breakfast, mid_morning, lunch, evening_snack, pre_workout, post_workout, dinner
            $table->boolean('is_completed')->default(true);
            $table->json('consumed_items')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['gym_id', 'member_id', 'log_date']);
        });

        // 8. Add extra fields to member_workout_plans
        Schema::table('member_workout_plans', function (Blueprint $table) {
            $table->foreignId('branch_id')->nullable()->after('gym_id')->constrained('branches')->nullOnDelete();
            $table->string('status', 30)->default('active')->after('difficulty'); // draft, active, paused, completed, archived
            $table->unsignedInteger('version')->default(1)->after('status');
            $table->foreignId('parent_plan_id')->nullable()->after('version')->constrained('member_workout_plans')->nullOnDelete();
            $table->json('schedule')->nullable()->after('exercises');
        });

        // 9. Add extra fields to member_progress_logs
        Schema::table('member_progress_logs', function (Blueprint $table) {
            $table->decimal('height_cm', 5, 1)->nullable()->after('log_date');
            $table->decimal('hips_cm', 5, 1)->nullable()->after('waist_cm');
            $table->decimal('thighs_cm', 5, 1)->nullable()->after('arms_cm');
            $table->decimal('calves_cm', 5, 1)->nullable()->after('thighs_cm');
            $table->string('photo_url', 255)->nullable()->after('notes');
            $table->string('logged_by_role', 30)->default('trainer')->after('logged_by_user_id');
        });
    }

    public function down(): void
    {
        Schema::table('member_progress_logs', function (Blueprint $table) {
            $table->dropColumn(['height_cm', 'hips_cm', 'thighs_cm', 'calves_cm', 'photo_url', 'logged_by_role']);
        });

        Schema::table('member_workout_plans', function (Blueprint $table) {
            $table->dropForeign(['branch_id']);
            $table->dropForeign(['parent_plan_id']);
            $table->dropColumn(['branch_id', 'status', 'version', 'parent_plan_id', 'schedule']);
        });

        Schema::dropIfExists('member_meal_logs');
        Schema::dropIfExists('member_diet_plans');
        Schema::dropIfExists('diet_templates');
        Schema::dropIfExists('foods');
        Schema::dropIfExists('member_workout_sessions');
        Schema::dropIfExists('workout_templates');
        Schema::dropIfExists('exercises');
    }
};
