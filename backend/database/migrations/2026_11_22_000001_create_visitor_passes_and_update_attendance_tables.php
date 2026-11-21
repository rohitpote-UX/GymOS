<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Visitor Passes Table
        Schema::create('visitor_passes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('gym_id')->constrained('gyms')->cascadeOnDelete();
            $table->foreignId('branch_id')->constrained('branches')->cascadeOnDelete();
            $table->string('pass_code', 60)->unique();
            $table->string('full_name', 120);
            $table->string('phone', 30)->index();
            $table->string('email', 150)->nullable();
            $table->string('gender', 20)->nullable();
            $table->string('emergency_contact', 30)->nullable();
            $table->decimal('base_amount', 10, 2);
            $table->decimal('gst_rate', 5, 2)->default(18.00);
            $table->decimal('gst_amount', 10, 2)->default(0.00);
            $table->decimal('total_amount', 10, 2);
            $table->string('currency', 5)->default('INR');
            $table->string('payment_method', 30)->default('razorpay'); // razorpay, cash, upi
            $table->string('payment_status', 30)->default('pending')->index(); // pending, paid, failed, refunded
            $table->string('razorpay_order_id', 100)->nullable()->index();
            $table->string('razorpay_payment_id', 100)->nullable()->index();
            $table->string('razorpay_signature', 255)->nullable();
            $table->date('valid_on')->index();
            $table->dateTime('check_in_at')->nullable();
            $table->dateTime('expires_at')->nullable();
            $table->unsignedBigInteger('attendance_log_id')->nullable();
            $table->foreignId('created_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['gym_id', 'branch_id', 'valid_on']);
            $table->index(['gym_id', 'payment_status', 'created_at']);
        });

        // 2. Modify attendance_logs table
        Schema::table('attendance_logs', function (Blueprint $table) {
            // Make member_id nullable for visitor attendance
            $table->unsignedBigInteger('member_id')->nullable()->change();
            $table->string('person_type', 20)->default('member')->index(); // member, visitor, staff
            $table->foreignId('visitor_pass_id')->nullable()->constrained('visitor_passes')->nullOnDelete();
            $table->string('qr_reference', 100)->nullable();
            $table->string('notes', 255)->nullable();
        });

        // 3. Add visitor pass & attendance settings to branches
        Schema::table('branches', function (Blueprint $table) {
            $table->boolean('visitor_pass_enabled')->default(true);
            $table->decimal('one_day_pass_price', 10, 2)->nullable();
            $table->decimal('one_day_pass_gst_rate', 5, 2)->default(18.00);
            $table->string('visitor_access_hours', 80)->default('06:00 AM - 10:00 PM');
        });
    }

    public function down(): void
    {
        Schema::table('branches', function (Blueprint $table) {
            $table->dropColumn([
                'visitor_pass_enabled',
                'one_day_pass_price',
                'one_day_pass_gst_rate',
                'visitor_access_hours',
            ]);
        });

        Schema::table('attendance_logs', function (Blueprint $table) {
            $table->dropForeign(['visitor_pass_id']);
            $table->dropColumn(['person_type', 'visitor_pass_id', 'qr_reference', 'notes']);
        });

        Schema::dropIfExists('visitor_passes');
    }
};
