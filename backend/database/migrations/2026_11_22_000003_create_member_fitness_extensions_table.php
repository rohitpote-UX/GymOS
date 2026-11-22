<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 1. Daily Member Water Intake Logs
        if (!Schema::hasTable('member_water_logs')) {
            Schema::create('member_water_logs', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('gym_id')->index();
                $table->unsignedBigInteger('member_id')->index();
                $table->date('log_date')->index();
                $table->unsignedInteger('target_ml')->default(2500);
                $table->unsignedInteger('consumed_ml')->default(0);
                $table->timestamps();

                $table->unique(['gym_id', 'member_id', 'log_date'], 'uniq_member_water_day');
                $table->foreign('gym_id')->references('id')->on('gyms')->onDelete('cascade');
                $table->foreign('member_id')->references('id')->on('members')->onDelete('cascade');
            });
        }

        // 2. Member Fitness Goals
        if (!Schema::hasTable('member_fitness_goals')) {
            Schema::create('member_fitness_goals', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('gym_id')->index();
                $table->unsignedBigInteger('member_id')->index();
                $table->unsignedBigInteger('created_by_user_id')->nullable();
                $table->string('title', 120);
                $table->string('category', 40)->default('weight'); // weight, muscle_gain, fat_loss, strength, consistency
                $table->decimal('start_value', 8, 2)->nullable();
                $table->decimal('target_value', 8, 2)->nullable();
                $table->decimal('current_value', 8, 2)->nullable();
                $table->string('unit', 20)->default('kg');
                $table->date('start_date')->nullable();
                $table->date('target_date')->nullable();
                $table->string('status', 30)->default('in_progress'); // in_progress, achieved, paused, cancelled
                $table->text('notes')->nullable();
                $table->timestamps();

                $table->foreign('gym_id')->references('id')->on('gyms')->onDelete('cascade');
                $table->foreign('member_id')->references('id')->on('members')->onDelete('cascade');
            });
        }

        // 3. Optional water target column on diet plans if not exists
        if (Schema::hasTable('member_diet_plans') && !Schema::hasColumn('member_diet_plans', 'water_target_ml')) {
            Schema::table('member_diet_plans', function (Blueprint $table) {
                $table->unsignedInteger('water_target_ml')->nullable()->default(2500)->after('target_fat_g');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('member_water_logs');
        Schema::dropIfExists('member_fitness_goals');

        if (Schema::hasTable('member_diet_plans') && Schema::hasColumn('member_diet_plans', 'water_target_ml')) {
            Schema::table('member_diet_plans', function (Blueprint $table) {
                $table->dropColumn('water_target_ml');
            });
        }
    }
};
