<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Create gym_qr_codes table
        Schema::create('gym_qr_codes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('gym_id')->constrained('gyms')->cascadeOnDelete();
            $table->foreignId('branch_id')->constrained('branches')->cascadeOnDelete();
            $table->string('token', 80)->unique();
            $table->string('code', 40)->unique();
            $table->string('name')->default('Front Entrance QR');
            $table->boolean('is_active')->default(true);
            $table->boolean('require_location')->default(false);
            $table->decimal('latitude', 10, 7)->nullable();
            $table->decimal('longitude', 10, 7)->nullable();
            $table->unsignedInteger('radius_meters')->default(150);
            $table->boolean('require_staff_confirmation')->default(false);
            $table->boolean('rotating_mode')->default(false);
            $table->unsignedBigInteger('scan_count')->default(0);
            $table->dateTime('last_scanned_at')->nullable();
            $table->foreignId('created_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->dateTime('deactivated_at')->nullable();
            $table->timestamps();

            $table->index(['gym_id', 'branch_id', 'is_active']);
            $table->index(['token', 'is_active']);
        });

        // 2. Add gym_qr_code_id and location coordinates to attendance_logs
        Schema::table('attendance_logs', function (Blueprint $table) {
            $table->foreignId('gym_qr_code_id')->nullable()->constrained('gym_qr_codes')->nullOnDelete();
            $table->decimal('latitude', 10, 7)->nullable();
            $table->decimal('longitude', 10, 7)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('attendance_logs', function (Blueprint $table) {
            $table->dropForeign(['gym_qr_code_id']);
            $table->dropColumn(['gym_qr_code_id', 'latitude', 'longitude']);
        });

        Schema::dropIfExists('gym_qr_codes');
    }
};
