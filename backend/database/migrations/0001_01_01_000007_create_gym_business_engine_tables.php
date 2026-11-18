<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Expand `users` with staff compensation and trainer profile fields
        Schema::table('users', function (Blueprint $table) {
            $table->decimal('base_salary', 10, 2)->default(0)->after('avatar_url');
            $table->decimal('commission_percent', 5, 2)->default(0)->after('base_salary');
            $table->decimal('pt_session_rate', 10, 2)->default(0)->after('commission_percent');
            $table->string('specialization', 150)->nullable()->after('pt_session_rate');
            $table->text('bio')->nullable()->after('specialization');
            $table->string('emergency_contact_phone', 30)->nullable()->after('bio');
            $table->date('joined_date')->nullable()->after('emergency_contact_phone');
        });

        // 2. Expand `membership_plans` with categories, PT sessions, freeze allowances
        Schema::table('membership_plans', function (Blueprint $table) {
            $table->string('category', 40)->default('monthly')->after('code')->index();
            $table->unsignedInteger('pt_sessions_count')->default(0)->after('duration_days');
            $table->unsignedInteger('max_freeze_days')->default(0)->after('pt_sessions_count');
            $table->string('plan_type', 40)->default('regular')->after('max_freeze_days');
        });

        // 3. Expand `members` with assigned trainer, photograph data, and calculated balances
        Schema::table('members', function (Blueprint $table) {
            $table->foreignId('assigned_trainer_id')->nullable()->after('primary_branch_id')->constrained('users')->nullOnDelete();
            $table->longText('photo_data')->nullable()->after('avatar_url'); // Base64 photograph
            $table->decimal('total_fees_billed', 12, 2)->default(0)->after('notes');
            $table->decimal('total_fees_paid', 12, 2)->default(0)->after('total_fees_billed');
            $table->decimal('outstanding_balance', 12, 2)->default(0)->after('total_fees_paid')->index();
        });

        // 4. Expand `member_memberships` with financial breakdown, freeze tracking, extensions & cancellations
        Schema::table('member_memberships', function (Blueprint $table) {
            $table->foreignId('assigned_trainer_id')->nullable()->after('membership_plan_id')->constrained('users')->nullOnDelete();
            $table->decimal('total_price', 10, 2)->default(0)->after('assigned_trainer_id');
            $table->decimal('final_price', 10, 2)->default(0)->after('discount_amount');
            $table->decimal('balance_due', 10, 2)->default(0)->after('price_paid');
            $table->string('category', 40)->default('monthly')->after('status')->index();
            $table->unsignedInteger('total_pt_sessions')->default(0)->after('category');
            $table->unsignedInteger('completed_pt_sessions')->default(0)->after('total_pt_sessions');
            // Freeze Tracking
            $table->date('freeze_start_date')->nullable()->after('completed_pt_sessions');
            $table->date('freeze_end_date')->nullable()->after('freeze_start_date');
            $table->unsignedInteger('freeze_days_used')->default(0)->after('freeze_end_date');
            $table->string('freeze_reason', 255)->nullable()->after('freeze_days_used');
            // Extensions
            $table->unsignedInteger('extended_days')->default(0)->after('freeze_reason');
            $table->string('extension_reason', 255)->nullable()->after('extended_days');
            // Cancellations & Refunds
            $table->timestamp('cancelled_at')->nullable()->after('extension_reason');
            $table->string('cancellation_reason', 255)->nullable()->after('cancelled_at');
            $table->decimal('refund_amount', 10, 2)->default(0)->after('cancellation_reason');
        });

        // 5. Expand `payments` with payment types (payments, refunds, advances), discounts & running balance
        Schema::table('payments', function (Blueprint $table) {
            $table->enum('type', ['payment', 'refund', 'advance', 'adjustment'])->default('payment')->after('receipt_number')->index();
            $table->foreignId('refund_payment_id')->nullable()->after('type')->constrained('payments')->nullOnDelete();
            $table->decimal('discount_amount', 10, 2)->default(0)->after('amount');
            $table->decimal('balance_after_payment', 10, 2)->default(0)->after('discount_amount');
        });

        // 6. Member Financial Ledger (Debits, Credits, Running Balances)
        Schema::create('member_ledgers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('gym_id')->constrained('gyms')->cascadeOnDelete();
            $table->foreignId('branch_id')->constrained('branches')->cascadeOnDelete();
            $table->foreignId('member_id')->constrained('members')->cascadeOnDelete();
            $table->enum('type', ['charge', 'payment', 'refund', 'discount_credit'])->index();
            $table->string('reference_type', 40)->nullable(); // membership, payment, manual
            $table->unsignedBigInteger('reference_id')->nullable();
            $table->string('description', 255);
            $table->decimal('debit', 10, 2)->default(0);  // charges
            $table->decimal('credit', 10, 2)->default(0); // payments/discounts
            $table->decimal('running_balance', 10, 2)->default(0);
            $table->date('transaction_date')->index();
            $table->foreignId('created_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['gym_id', 'member_id', 'transaction_date']);
        });

        // 7. Freeze History Audit
        Schema::create('member_membership_freezes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('gym_id')->constrained('gyms')->cascadeOnDelete();
            $table->foreignId('member_membership_id')->constrained('member_memberships')->cascadeOnDelete();
            $table->date('freeze_date');
            $table->date('unfreeze_date')->nullable();
            $table->unsignedInteger('days')->default(0);
            $table->string('reason', 255)->nullable();
            $table->foreignId('processed_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        // 8. Expense Management
        Schema::create('expenses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('gym_id')->constrained('gyms')->cascadeOnDelete();
            $table->foreignId('branch_id')->constrained('branches')->cascadeOnDelete();
            $table->enum('category', [
                'rent',
                'salaries',
                'electricity',
                'maintenance',
                'marketing',
                'cleaning',
                'equipment',
                'other'
            ])->index();
            $table->string('title', 150);
            $table->decimal('amount', 10, 2);
            $table->enum('payment_mode', ['cash', 'upi', 'bank_transfer', 'card', 'cheque'])->default('cash');
            $table->date('expense_date')->index();
            $table->string('vendor_name', 120)->nullable();
            $table->string('bill_number', 60)->nullable();
            $table->text('notes')->nullable();
            $table->string('receipt_url', 255)->nullable();
            $table->foreignId('recorded_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['gym_id', 'branch_id', 'expense_date']);
        });

        // 9. Daily Cash Register Closing
        Schema::create('daily_cash_closings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('gym_id')->constrained('gyms')->cascadeOnDelete();
            $table->foreignId('branch_id')->constrained('branches')->cascadeOnDelete();
            $table->date('closing_date')->index();
            $table->foreignId('opened_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('closed_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->decimal('opening_cash', 10, 2)->default(0);
            $table->decimal('cash_collected', 10, 2)->default(0);
            $table->decimal('cash_expenses', 10, 2)->default(0);
            $table->decimal('expected_cash_in_hand', 10, 2)->default(0);
            $table->decimal('actual_cash_in_hand', 10, 2)->default(0);
            $table->decimal('cash_discrepancy', 10, 2)->default(0);
            $table->decimal('total_upi_collected', 10, 2)->default(0);
            $table->decimal('total_card_collected', 10, 2)->default(0);
            $table->decimal('total_bank_transfer_collected', 10, 2)->default(0);
            $table->enum('status', ['open', 'closed'])->default('open')->index();
            $table->text('notes')->nullable();
            $table->timestamp('closed_at')->nullable();
            $table->timestamps();

            $table->unique(['gym_id', 'branch_id', 'closing_date']);
        });

        // 10. Leads CRM
        Schema::create('leads', function (Blueprint $table) {
            $table->id();
            $table->foreignId('gym_id')->constrained('gyms')->cascadeOnDelete();
            $table->foreignId('branch_id')->constrained('branches')->cascadeOnDelete();
            $table->string('name', 120);
            $table->string('phone', 30)->index();
            $table->string('email', 150)->nullable();
            $table->enum('gender', ['male', 'female', 'other'])->nullable();
            $table->enum('source', [
                'walk_in',
                'instagram',
                'google',
                'referral',
                'website',
                'phone_enquiry',
                'other'
            ])->default('walk_in')->index();
            $table->enum('fitness_goal', [
                'weight_loss',
                'muscle_gain',
                'general_fitness',
                'bodybuilding',
                'personal_training',
                'other'
            ])->default('general_fitness');
            $table->foreignId('interested_plan_id')->nullable()->constrained('membership_plans')->nullOnDelete();
            $table->foreignId('assigned_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->enum('status', ['new', 'contacted', 'trial_booked', 'converted', 'lost'])->default('new')->index();
            $table->date('followup_date')->nullable()->index();
            $table->date('trial_date')->nullable();
            $table->enum('trial_status', ['pending', 'completed', 'no_show'])->nullable();
            $table->enum('lost_reason', [
                'too_expensive',
                'joined_another_gym',
                'distance_location',
                'no_response',
                'timing_issue',
                'other'
            ])->nullable();
            $table->foreignId('converted_member_id')->nullable()->constrained('members')->nullOnDelete();
            $table->timestamp('converted_at')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['gym_id', 'branch_id', 'status']);
        });

        // 11. Lead Follow-up History
        Schema::create('lead_followups', function (Blueprint $table) {
            $table->id();
            $table->foreignId('gym_id')->constrained('gyms')->cascadeOnDelete();
            $table->foreignId('lead_id')->constrained('leads')->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->date('followup_date');
            $table->enum('type', ['call', 'whatsapp', 'in_person', 'email'])->default('call');
            $table->text('summary');
            $table->date('next_followup_date')->nullable();
            $table->timestamps();

            $table->index(['gym_id', 'lead_id', 'followup_date']);
        });

        // 12. Personal Training Sessions
        Schema::create('pt_sessions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('gym_id')->constrained('gyms')->cascadeOnDelete();
            $table->foreignId('branch_id')->constrained('branches')->cascadeOnDelete();
            $table->foreignId('member_id')->constrained('members')->cascadeOnDelete();
            $table->foreignId('trainer_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('member_membership_id')->nullable()->constrained('member_memberships')->nullOnDelete();
            $table->date('session_date')->index();
            $table->time('start_time')->nullable();
            $table->time('end_time')->nullable();
            $table->unsignedInteger('duration_minutes')->default(60);
            $table->enum('status', ['scheduled', 'completed', 'cancelled', 'no_show'])->default('scheduled')->index();
            $table->text('trainer_notes')->nullable();
            $table->text('client_feedback')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();

            $table->index(['gym_id', 'trainer_id', 'session_date']);
        });

        // 13. Staff Leave Records
        Schema::create('staff_leaves', function (Blueprint $table) {
            $table->id();
            $table->foreignId('gym_id')->constrained('gyms')->cascadeOnDelete();
            $table->foreignId('branch_id')->nullable()->constrained('branches')->nullOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->enum('leave_type', ['sick', 'casual', 'annual', 'unpaid'])->default('casual');
            $table->date('start_date');
            $table->date('end_date');
            $table->unsignedInteger('days_count')->default(1);
            $table->text('reason')->nullable();
            $table->enum('status', ['pending', 'approved', 'rejected'])->default('pending')->index();
            $table->foreignId('approved_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['gym_id', 'user_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('staff_leaves');
        Schema::dropIfExists('pt_sessions');
        Schema::dropIfExists('lead_followups');
        Schema::dropIfExists('leads');
        Schema::dropIfExists('daily_cash_closings');
        Schema::dropIfExists('expenses');
        Schema::dropIfExists('member_membership_freezes');
        Schema::dropIfExists('member_ledgers');

        Schema::table('payments', function (Blueprint $table) {
            $table->dropForeign(['refund_payment_id']);
            $table->dropColumn(['type', 'refund_payment_id', 'discount_amount', 'balance_after_payment']);
        });

        Schema::table('member_memberships', function (Blueprint $table) {
            $table->dropForeign(['assigned_trainer_id']);
            $table->dropColumn([
                'assigned_trainer_id', 'total_price', 'final_price', 'balance_due',
                'category', 'total_pt_sessions', 'completed_pt_sessions',
                'freeze_start_date', 'freeze_end_date', 'freeze_days_used', 'freeze_reason',
                'extended_days', 'extension_reason', 'cancelled_at', 'cancellation_reason', 'refund_amount'
            ]);
        });

        Schema::table('members', function (Blueprint $table) {
            $table->dropForeign(['assigned_trainer_id']);
            $table->dropColumn(['assigned_trainer_id', 'photo_data', 'total_fees_billed', 'total_fees_paid', 'outstanding_balance']);
        });

        Schema::table('membership_plans', function (Blueprint $table) {
            $table->dropColumn(['category', 'pt_sessions_count', 'max_freeze_days', 'plan_type']);
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['base_salary', 'commission_percent', 'pt_session_rate', 'specialization', 'bio', 'emergency_contact_phone', 'joined_date']);
        });
    }
};
