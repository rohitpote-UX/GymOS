<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Action Items (Intelligent Triage & Action Center)
        Schema::create('action_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('gym_id')->constrained('gyms')->cascadeOnDelete();
            $table->foreignId('branch_id')->nullable()->constrained('branches')->nullOnDelete();
            $table->string('type', 60); // expiring_membership, overdue_payment, inactive_member, low_stock, expiring_product, uncontacted_lead, pending_pt_session, unresolved_ticket
            $table->string('severity', 20)->default('info'); // critical, warning, info
            $table->string('title', 200);
            $table->text('description')->nullable();
            $table->string('reference_type', 50)->nullable();
            $table->unsignedBigInteger('reference_id')->nullable();
            $table->json('metadata')->nullable();
            $table->foreignId('assigned_to_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('status', 30)->default('pending'); // pending, in_progress, resolved, dismissed
            $table->date('due_date')->nullable();
            $table->timestamp('resolved_at')->nullable();
            $table->foreignId('resolved_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->text('resolution_notes')->nullable();
            $table->timestamps();

            $table->index(['gym_id', 'status', 'severity']);
            $table->index(['gym_id', 'type', 'status']);
        });

        // 2. WhatsApp Templates (Automated WhatsApp Business Platform Templates)
        Schema::create('whatsapp_templates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('gym_id')->constrained('gyms')->cascadeOnDelete();
            $table->string('template_name', 100);
            $table->string('category', 60); // welcome, payment_receipt, renewal_reminder, attendance, trial_booking, lead_followup, payment_due
            $table->string('language', 20)->default('en');
            $table->text('body_text');
            $table->json('variables')->nullable(); // e.g. ["member_name", "plan_name", "amount", "expiry_date"]
            $table->boolean('is_approved')->default(true);
            $table->string('provider_template_id', 120)->nullable();
            $table->string('status', 30)->default('approved'); // approved, pending, rejected
            $table->timestamps();

            $table->unique(['gym_id', 'category', 'language']);
        });

        // 3. WhatsApp Message Delivery Logs
        Schema::create('whatsapp_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('gym_id')->constrained('gyms')->cascadeOnDelete();
            $table->foreignId('branch_id')->nullable()->constrained('branches')->nullOnDelete();
            $table->foreignId('template_id')->nullable()->constrained('whatsapp_templates')->nullOnDelete();
            $table->string('template_name', 100)->nullable();
            $table->string('recipient_phone', 30)->index();
            $table->string('recipient_name', 120)->nullable();
            $table->string('category', 60)->index();
            $table->text('message_body');
            $table->json('variables_payload')->nullable();
            $table->string('status', 30)->default('queued'); // queued, sent, delivered, read, failed
            $table->string('provider_message_id', 120)->nullable()->index();
            $table->text('error_message')->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->timestamp('delivered_at')->nullable();
            $table->timestamp('read_at')->nullable();
            $table->timestamps();

            $table->index(['gym_id', 'status', 'created_at']);
        });

        // 4. Support Tickets (Separated: Gym-Member vs SaaS Platform Support)
        Schema::create('support_tickets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('gym_id')->constrained('gyms')->cascadeOnDelete();
            $table->foreignId('branch_id')->nullable()->constrained('branches')->nullOnDelete();
            $table->string('ticket_number', 60)->index(); // TKT-2026-0001
            $table->string('scope', 30)->default('gym_member'); // gym_member, saas_platform
            $table->foreignId('member_id')->nullable()->constrained('members')->nullOnDelete();
            $table->string('category', 60)->default('general'); // locker, equipment, billing, trainer, cleanliness, saas_feature, saas_billing, general
            $table->string('priority', 20)->default('medium'); // low, medium, high, urgent
            $table->string('subject', 200);
            $table->text('description');
            $table->string('status', 30)->default('open'); // open, in_progress, resolved, closed
            $table->foreignId('assigned_to_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('created_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->text('resolution_notes')->nullable();
            $table->timestamp('resolved_at')->nullable();
            $table->timestamps();

            $table->index(['gym_id', 'scope', 'status']);
        });

        // 5. Support Ticket Messages / Comments Thread
        Schema::create('support_ticket_messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('support_ticket_id')->constrained('support_tickets')->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('member_id')->nullable()->constrained('members')->nullOnDelete();
            $table->boolean('is_internal_note')->default(false);
            $table->text('message');
            $table->string('attachment_url', 255)->nullable();
            $table->timestamps();

            $table->index(['support_ticket_id', 'created_at']);
        });

        // 6. Member Workout Plans
        Schema::create('member_workout_plans', function (Blueprint $table) {
            $table->id();
            $table->foreignId('gym_id')->constrained('gyms')->cascadeOnDelete();
            $table->foreignId('member_id')->constrained('members')->cascadeOnDelete();
            $table->foreignId('trainer_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('title', 150);
            $table->string('goal', 80)->default('general_fitness'); // fat_loss, muscle_hypertrophy, strength_conditioning, general_fitness, rehab
            $table->string('difficulty', 30)->default('intermediate'); // beginner, intermediate, advanced
            $table->unsignedInteger('days_per_week')->default(4);
            $table->json('exercises'); // Array of routine days and exercises: [{day: "Day 1 - Chest & Triceps", exercises: [...]}]
            $table->text('notes')->nullable();
            $table->date('start_date');
            $table->date('end_date')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['gym_id', 'member_id', 'is_active']);
        });

        // 7. Member Progress Logs (Weight, Body Fat %, Measurements)
        Schema::create('member_progress_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('gym_id')->constrained('gyms')->cascadeOnDelete();
            $table->foreignId('member_id')->constrained('members')->cascadeOnDelete();
            $table->foreignId('logged_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->date('log_date')->index();
            $table->decimal('weight_kg', 5, 2)->nullable();
            $table->decimal('body_fat_percent', 4, 1)->nullable();
            $table->decimal('chest_cm', 5, 1)->nullable();
            $table->decimal('waist_cm', 5, 1)->nullable();
            $table->decimal('arms_cm', 5, 1)->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['gym_id', 'member_id', 'log_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('member_progress_logs');
        Schema::dropIfExists('member_workout_plans');
        Schema::dropIfExists('support_ticket_messages');
        Schema::dropIfExists('support_tickets');
        Schema::dropIfExists('whatsapp_logs');
        Schema::dropIfExists('whatsapp_templates');
        Schema::dropIfExists('action_items');
    }
};
