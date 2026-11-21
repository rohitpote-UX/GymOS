<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Structured Exercise Categories & Equipment
        Schema::create('exercise_categories', function (Blueprint $table) {
            $table->id();
            $table->string('name', 100);
            $table->string('name_mr', 100)->nullable();
            $table->string('name_hi', 100)->nullable();
            $table->string('slug', 100)->unique();
            $table->enum('type', ['muscle_group', 'exercise_type', 'equipment'])->default('muscle_group');
            $table->string('icon', 60)->nullable();
            $table->text('description')->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['type', 'sort_order', 'is_active']);
        });

        // 2. Extend existing exercises table with code, secondary muscles, and video relation
        Schema::table('exercises', function (Blueprint $table) {
            $table->string('code', 80)->nullable()->after('id')->unique();
            $table->json('secondary_muscles')->nullable()->after('target_muscle_group');
            $table->string('exercise_type', 60)->default('strength_training')->after('secondary_muscles');
            $table->json('equipment_types')->nullable()->after('equipment_required');
            $table->unsignedBigInteger('default_video_id')->nullable()->after('video_url');
            $table->string('thumbnail_url', 500)->nullable()->after('image_url');
        });

        // 3. Exercise Category Mappings (Many-to-Many)
        Schema::create('exercise_category_mappings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('exercise_id')->constrained('exercises')->cascadeOnDelete();
            $table->foreignId('category_id')->constrained('exercise_categories')->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['exercise_id', 'category_id']);
        });

        // 4. Video Providers (Extensible adapter configurations)
        Schema::create('video_providers', function (Blueprint $table) {
            $table->id();
            $table->string('name', 80); // youtube, vimeo, direct_upload, custom_adapter
            $table->string('code', 50)->unique();
            $table->boolean('is_enabled')->default(true);
            $table->boolean('supports_embed')->default(true);
            $table->boolean('supports_upload')->default(false);
            $table->text('commercial_terms_notes')->nullable();
            $table->json('config')->nullable();
            $table->timestamps();
        });

        // 5. Centralized Exercise Videos (Global Platform Library & Gym-Specific Custom Videos)
        Schema::create('exercise_videos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('exercise_id')->constrained('exercises')->cascadeOnDelete();
            $table->foreignId('gym_id')->nullable()->constrained('gyms')->cascadeOnDelete(); // null = Global Platform Library
            $table->foreignId('created_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('title', 200);
            $table->text('description')->nullable();
            $table->string('provider', 50)->default('youtube'); // youtube, direct_upload, vimeo, provider_adapter
            $table->text('video_url');
            $table->string('video_id', 150)->nullable(); // e.g. YouTube Video ID
            $table->text('embed_url')->nullable(); // Privacy-enhanced embed URL
            $table->string('thumbnail_url', 500)->nullable();
            $table->unsignedInteger('duration_seconds')->nullable();
            $table->string('aspect_ratio', 20)->default('16:9');
            $table->string('content_source', 60)->default('youtube'); // youtube, licensed_provider, original_owned, gym_custom
            $table->string('rights_status', 60)->default('public_embed_allowed'); // public_embed_allowed, licensed_commercial, platform_owned, gym_owned
            $table->string('creator_name', 150)->nullable();
            $table->text('attribution_text')->nullable();
            $table->enum('status', ['approved', 'pending_review', 'rejected', 'deactivated'])->default('approved');
            $table->boolean('is_primary')->default(false);
            $table->string('language', 10)->default('en');
            $table->boolean('is_active')->default(true);
            $table->timestamp('last_health_check_at')->nullable();
            $table->enum('health_status', ['healthy', 'playback_error', 'unverified'])->default('unverified');
            $table->text('health_error_message')->nullable();
            $table->timestamps();

            $table->index(['exercise_id', 'gym_id', 'is_active', 'status']);
            $table->index(['health_status', 'is_active']);
        });

        // 6. Gym Exercise Video Overrides (Strict gym priority mapping)
        Schema::create('gym_exercise_video_overrides', function (Blueprint $table) {
            $table->id();
            $table->foreignId('gym_id')->constrained('gyms')->cascadeOnDelete();
            $table->foreignId('exercise_id')->constrained('exercises')->cascadeOnDelete();
            $table->foreignId('exercise_video_id')->constrained('exercise_videos')->cascadeOnDelete();
            $table->foreignId('created_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->boolean('is_active')->default(true);
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->unique(['gym_id', 'exercise_id']);
        });

        // 7. Video Health Checks & Audit History
        Schema::create('video_health_checks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('exercise_video_id')->constrained('exercise_videos')->cascadeOnDelete();
            $table->integer('status_code')->nullable();
            $table->boolean('is_playable')->default(true);
            $table->json('response_payload')->nullable();
            $table->text('error_message')->nullable();
            $table->foreignId('checked_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('checked_at');
            $table->timestamps();

            $table->index(['exercise_video_id', 'checked_at']);
        });

        // 8. Gym settings for video library moderation & permissions
        Schema::table('gyms', function (Blueprint $table) {
            $table->json('video_library_settings')->nullable()->after('settings');
        });
    }

    public function down(): void
    {
        Schema::table('gyms', function (Blueprint $table) {
            $table->dropColumn('video_library_settings');
        });

        Schema::dropIfExists('video_health_checks');
        Schema::dropIfExists('gym_exercise_video_overrides');
        Schema::dropIfExists('exercise_videos');
        Schema::dropIfExists('video_providers');
        Schema::dropIfExists('exercise_category_mappings');

        Schema::table('exercises', function (Blueprint $table) {
            $table->dropColumn([
                'code',
                'secondary_muscles',
                'exercise_type',
                'equipment_types',
                'default_video_id',
                'thumbnail_url',
            ]);
        });

        Schema::dropIfExists('exercise_categories');
    }
};
