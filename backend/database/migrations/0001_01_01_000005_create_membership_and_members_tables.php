<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Gym customer membership packages (e.g. Monthly Standard, 3 Months Transformation, Annual VIP)
        Schema::create('membership_plans', function (Blueprint $table) {
            $table->id();
            $table->foreignId('gym_id')->constrained('gyms')->cascadeOnDelete();
            $table->foreignId('branch_id')->nullable()->constrained('branches')->cascadeOnDelete(); // null = all branches
            $table->string('name', 120);
            $table->string('code', 30)->nullable();
            $table->unsignedInteger('duration_days')->default(30);
            $table->decimal('price', 10, 2);
            $table->decimal('admission_fee', 10, 2)->default(0);
            $table->decimal('tax_percent', 5, 2)->default(0);
            $table->text('description')->nullable();
            $table->json('features')->nullable();
            $table->boolean('is_active')->default(true)->index();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['gym_id', 'is_active']);
        });

        // Gym Members
        Schema::create('members', function (Blueprint $table) {
            $table->id();
            $table->foreignId('gym_id')->constrained('gyms')->cascadeOnDelete();
            $table->foreignId('primary_branch_id')->constrained('branches')->cascadeOnDelete();
            $table->string('member_code', 40); // e.g. MEM-001
            $table->string('first_name', 80);
            $table->string('last_name', 80)->nullable();
            $table->string('email', 150)->nullable();
            $table->string('phone', 30);
            $table->enum('gender', ['male', 'female', 'other'])->nullable();
            $table->date('dob')->nullable();
            $table->text('address')->nullable();
            $table->string('emergency_contact_name', 100)->nullable();
            $table->string('emergency_contact_phone', 30)->nullable();
            $table->string('blood_group', 10)->nullable();
            $table->enum('status', ['active', 'inactive', 'expired', 'frozen'])->default('active')->index();
            $table->date('joined_date')->nullable();
            $table->string('avatar_url', 255)->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->unique(['gym_id', 'member_code']);
            $table->index(['gym_id', 'phone']);
            $table->index(['gym_id', 'primary_branch_id', 'status']);
        });

        // Member Subscriptions (Memberships assigned to members)
        Schema::create('member_memberships', function (Blueprint $table) {
            $table->id();
            $table->foreignId('gym_id')->constrained('gyms')->cascadeOnDelete();
            $table->foreignId('branch_id')->constrained('branches')->cascadeOnDelete();
            $table->foreignId('member_id')->constrained('members')->cascadeOnDelete();
            $table->foreignId('membership_plan_id')->constrained('membership_plans')->cascadeOnDelete();
            $table->date('start_date');
            $table->date('end_date')->index();
            $table->enum('status', ['active', 'expired', 'cancelled', 'frozen'])->default('active')->index();
            $table->decimal('price_paid', 10, 2);
            $table->decimal('discount_amount', 10, 2)->default(0);
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['gym_id', 'branch_id', 'status']);
            $table->index(['gym_id', 'end_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('member_memberships');
        Schema::dropIfExists('members');
        Schema::dropIfExists('membership_plans');
    }
};
