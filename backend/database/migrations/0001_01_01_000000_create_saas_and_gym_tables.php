<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1. SaaS Platform Subscription Plans (Starter, Growth, Enterprise)
        Schema::create('saas_plans', function (Blueprint $table) {
            $table->id();
            $table->string('name', 100);
            $table->string('code', 50)->unique();
            $table->decimal('price', 10, 2);
            $table->enum('interval', ['month', 'year'])->default('month');
            $table->unsignedInteger('branch_limit')->default(1);
            $table->unsignedInteger('member_limit')->default(300);
            $table->json('features')->nullable();
            $table->boolean('is_active')->default(true);
            $table->unsignedInteger('sort_order')->default(0);
            $table->string('razorpay_plan_id', 60)->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        // 2. Gym Tenants
        Schema::create('gyms', function (Blueprint $table) {
            $table->id();
            $table->string('name', 150);
            $table->string('legal_name', 150)->nullable();
            $table->string('slug', 80)->unique();
            $table->string('email', 150)->nullable();
            $table->string('phone', 30)->nullable();
            $table->string('currency', 10)->default('INR');
            $table->enum('status', ['active', 'suspended', 'trial'])->default('trial')->index();
            $table->timestamp('trial_ends_at')->nullable();
            $table->foreignId('saas_plan_id')->nullable()->constrained('saas_plans')->nullOnDelete();
            $table->timestamp('subscription_expires_at')->nullable()->index();
            $table->enum('billing_cycle', ['monthly', 'yearly'])->default('monthly');
            $table->json('settings')->nullable();
            $table->json('branding')->nullable();
            $table->unsignedInteger('assets_version')->default(1);
            $table->timestamps();
            $table->softDeletes();
        });

        // 3. Gym Dynamic Brand Assets (Logos, Icons for PWA Manifest)
        Schema::create('gym_assets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('gym_id')->constrained('gyms')->cascadeOnDelete();
            $table->string('kind', 30); // logo, icon-192, icon-512, favicon
            $table->string('mime', 50);
            $table->longText('data');   // base64 data uri or raw base64
            $table->timestamps();

            $table->unique(['gym_id', 'kind']);
        });

        // 4. Gym Branches (Multi-Branch Locations)
        Schema::create('branches', function (Blueprint $table) {
            $table->id();
            $table->foreignId('gym_id')->constrained('gyms')->cascadeOnDelete();
            $table->string('name', 120);
            $table->string('code', 30)->nullable();
            $table->string('phone', 30)->nullable();
            $table->string('email', 150)->nullable();
            $table->text('address')->nullable();
            $table->string('city', 80)->nullable();
            $table->string('state', 80)->nullable();
            $table->string('pincode', 20)->nullable();
            $table->unsignedInteger('capacity')->nullable();
            $table->boolean('is_active')->default(true)->index();
            $table->boolean('is_primary')->default(false);
            $table->json('operating_hours')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['gym_id', 'is_active']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('branches');
        Schema::dropIfExists('gym_assets');
        Schema::dropIfExists('gyms');
        Schema::dropIfExists('saas_plans');
    }
};
