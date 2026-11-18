<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Razorpay SaaS Orders
        Schema::create('saas_orders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('gym_id')->constrained('gyms')->cascadeOnDelete();
            $table->foreignId('saas_plan_id')->constrained('saas_plans')->cascadeOnDelete();
            $table->string('razorpay_order_id', 60)->unique();
            $table->decimal('amount', 10, 2);
            $table->string('currency', 10)->default('INR');
            $table->enum('interval', ['month', 'year'])->default('month');
            $table->enum('status', ['created', 'paid', 'failed', 'cancelled'])->default('created')->index();
            $table->string('receipt', 50)->nullable();
            $table->json('meta')->nullable();
            $table->timestamps();
        });

        // Razorpay SaaS Successful Payments (idempotent via razorpay_payment_id)
        Schema::create('saas_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('gym_id')->constrained('gyms')->cascadeOnDelete();
            $table->foreignId('saas_order_id')->nullable()->constrained('saas_orders')->nullOnDelete();
            $table->foreignId('saas_plan_id')->constrained('saas_plans')->cascadeOnDelete();
            $table->string('razorpay_payment_id', 60)->unique();
            $table->string('razorpay_order_id', 60)->nullable()->index();
            $table->decimal('amount', 10, 2);
            $table->string('currency', 10)->default('INR');
            $table->string('payment_method', 30)->nullable();
            $table->timestamp('period_start')->nullable();
            $table->timestamp('period_end')->nullable();
            $table->json('payload')->nullable();
            $table->timestamps();

            $table->index(['gym_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('saas_payments');
        Schema::dropIfExists('saas_orders');
    }
};
