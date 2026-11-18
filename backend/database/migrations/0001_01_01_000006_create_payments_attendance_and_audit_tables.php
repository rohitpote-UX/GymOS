<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Member Payments & POS Transactions
        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('gym_id')->constrained('gyms')->cascadeOnDelete();
            $table->foreignId('branch_id')->constrained('branches')->cascadeOnDelete();
            $table->foreignId('member_id')->constrained('members')->cascadeOnDelete();
            $table->foreignId('member_membership_id')->nullable()->constrained('member_memberships')->nullOnDelete();
            $table->string('receipt_number', 50)->nullable();
            $table->uuid('client_uuid')->nullable()->unique(); // Idempotent offline outbox sync!
            $table->decimal('amount', 10, 2);
            $table->enum('payment_method', ['cash', 'upi', 'card', 'bank_transfer', 'cheque'])->default('cash');
            $table->date('payment_date');
            $table->string('reference_id', 100)->nullable(); // UPI Ref / Txn ID / Cheque #
            $table->enum('status', ['completed', 'pending', 'refunded'])->default('completed')->index();
            $table->text('notes')->nullable();
            $table->foreignId('collected_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['gym_id', 'branch_id', 'payment_date']);
            $table->index(['gym_id', 'receipt_number']);
        });

        // Member Check-in / Attendance Logs
        Schema::create('attendance_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('gym_id')->constrained('gyms')->cascadeOnDelete();
            $table->foreignId('branch_id')->constrained('branches')->cascadeOnDelete();
            $table->foreignId('member_id')->constrained('members')->cascadeOnDelete();
            $table->uuid('client_uuid')->nullable()->unique(); // Idempotent offline check-in!
            $table->dateTime('check_in_at');
            $table->dateTime('check_out_at')->nullable();
            $table->enum('method', ['front_desk', 'qr_scan', 'biometric', 'manual'])->default('front_desk');
            $table->foreignId('verified_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['gym_id', 'branch_id', 'check_in_at']);
        });

        // Audit Logs (Tenant & Platform level)
        Schema::create('audit_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('gym_id')->nullable()->constrained('gyms')->cascadeOnDelete();
            $table->foreignId('branch_id')->nullable()->constrained('branches')->nullOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('event', 80)->index();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->json('payload')->nullable();
            $table->timestamps();

            $table->index(['gym_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('audit_logs');
        Schema::dropIfExists('attendance_logs');
        Schema::dropIfExists('payments');
    }
};
