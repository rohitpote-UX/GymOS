<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Invoices Table
        Schema::create('invoices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('gym_id')->constrained('gyms')->cascadeOnDelete();
            $table->foreignId('branch_id')->constrained('branches')->cascadeOnDelete();
            $table->foreignId('member_id')->constrained('members')->cascadeOnDelete();
            $table->foreignId('member_membership_id')->nullable()->constrained('member_memberships')->nullOnDelete();
            $table->foreignId('pos_order_id')->nullable()->constrained('pos_orders')->nullOnDelete();
            $table->string('invoice_number', 50)->index();
            $table->date('invoice_date');
            $table->date('due_date')->index();
            $table->decimal('subtotal', 10, 2)->default(0);
            $table->enum('discount_type', ['none', 'fixed', 'percentage'])->default('none');
            $table->decimal('discount_value', 10, 2)->default(0);
            $table->decimal('discount_amount', 10, 2)->default(0);
            $table->string('discount_reason', 255)->nullable();
            $table->foreignId('discount_approved_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->decimal('tax_rate', 5, 2)->default(0);
            $table->decimal('tax_amount', 10, 2)->default(0);
            $table->decimal('total_amount', 10, 2)->default(0); // final payable
            $table->decimal('paid_amount', 10, 2)->default(0);
            $table->decimal('balance_due', 10, 2)->default(0);
            $table->enum('status', ['paid', 'partially_paid', 'unpaid', 'overdue', 'cancelled'])->default('unpaid')->index();
            $table->text('notes')->nullable();
            $table->string('razorpay_order_id', 100)->nullable()->index();
            $table->foreignId('created_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['gym_id', 'branch_id', 'status']);
            $table->index(['gym_id', 'due_date']);
            $table->index(['gym_id', 'invoice_number']);
            $table->index(['member_id', 'status']);
        });

        // 2. Payment Allocations Table
        Schema::create('payment_allocations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('gym_id')->constrained('gyms')->cascadeOnDelete();
            $table->foreignId('payment_id')->constrained('payments')->cascadeOnDelete();
            $table->foreignId('invoice_id')->constrained('invoices')->cascadeOnDelete();
            $table->decimal('amount', 10, 2);
            $table->dateTime('allocated_at');
            $table->foreignId('allocated_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['gym_id', 'invoice_id']);
            $table->index(['gym_id', 'payment_id']);
        });

        // 3. Expand payments table with invoice_id if missing
        if (!Schema::hasColumn('payments', 'invoice_id')) {
            Schema::table('payments', function (Blueprint $table) {
                $table->foreignId('invoice_id')->nullable()->after('member_membership_id')->constrained('invoices')->nullOnDelete();
            });
        }

        // 4. Discount Audits Table
        Schema::create('discount_audits', function (Blueprint $table) {
            $table->id();
            $table->foreignId('gym_id')->constrained('gyms')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('invoice_id')->nullable()->constrained('invoices')->nullOnDelete();
            $table->string('discount_type', 30)->default('fixed');
            $table->decimal('discount_value', 10, 2)->default(0);
            $table->decimal('discount_amount', 10, 2)->default(0);
            $table->string('reason', 255)->nullable();
            $table->foreignId('approved_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->enum('status', ['approved', 'rejected', 'auto_approved'])->default('auto_approved');
            $table->timestamps();

            $table->index(['gym_id', 'created_at']);
        });

        // 5. Payment Reminders Table
        Schema::create('payment_reminders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('gym_id')->constrained('gyms')->cascadeOnDelete();
            $table->foreignId('branch_id')->constrained('branches')->cascadeOnDelete();
            $table->foreignId('member_id')->constrained('members')->cascadeOnDelete();
            $table->foreignId('invoice_id')->constrained('invoices')->cascadeOnDelete();
            $table->string('phone', 25);
            $table->string('channel', 25)->default('whatsapp');
            $table->string('language', 10)->default('en');
            $table->decimal('amount_due', 10, 2);
            $table->text('message');
            $table->enum('status', ['sent', 'failed', 'delivered'])->default('sent');
            $table->foreignId('sent_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['gym_id', 'invoice_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payment_reminders');
        Schema::dropIfExists('discount_audits');
        if (Schema::hasColumn('payments', 'invoice_id')) {
            Schema::table('payments', function (Blueprint $table) {
                $table->dropForeign(['invoice_id']);
                $table->dropColumn('invoice_id');
            });
        }
        Schema::dropIfExists('payment_allocations');
        Schema::dropIfExists('invoices');
    }
};
