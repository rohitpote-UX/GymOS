<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Suppliers
        Schema::create('suppliers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('gym_id')->constrained('gyms')->cascadeOnDelete();
            $table->string('name', 150);
            $table->string('company_name', 150)->nullable();
            $table->string('contact_person', 100)->nullable();
            $table->string('phone', 30)->index();
            $table->string('email', 150)->nullable();
            $table->string('gstin', 30)->nullable();
            $table->text('address')->nullable();
            $table->string('city', 80)->nullable();
            $table->text('bank_details')->nullable();
            $table->decimal('total_purchased', 12, 2)->default(0);
            $table->decimal('total_paid', 12, 2)->default(0);
            $table->decimal('outstanding_balance', 12, 2)->default(0)->index();
            $table->text('notes')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();

            $table->index(['gym_id', 'is_active']);
        });

        // 2. Supplier Ledgers
        Schema::create('supplier_ledgers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('gym_id')->constrained('gyms')->cascadeOnDelete();
            $table->foreignId('supplier_id')->constrained('suppliers')->cascadeOnDelete();
            $table->foreignId('branch_id')->nullable()->constrained('branches')->nullOnDelete();
            $table->string('transaction_type', 40); // purchase_invoice, payment, return, adjustment
            $table->unsignedBigInteger('reference_id')->nullable();
            $table->string('reference_number', 80)->nullable();
            $table->decimal('debit', 12, 2)->default(0); // purchases/bills
            $table->decimal('credit', 12, 2)->default(0); // payments to supplier
            $table->decimal('running_balance', 12, 2)->default(0);
            $table->date('transaction_date')->index();
            $table->text('notes')->nullable();
            $table->foreignId('created_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['gym_id', 'supplier_id', 'transaction_date']);
        });

        // 3. Supplier Payments
        Schema::create('supplier_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('gym_id')->constrained('gyms')->cascadeOnDelete();
            $table->foreignId('branch_id')->nullable()->constrained('branches')->nullOnDelete();
            $table->foreignId('supplier_id')->constrained('suppliers')->cascadeOnDelete();
            $table->string('payment_number', 50)->index();
            $table->decimal('amount', 12, 2);
            $table->string('payment_mode', 30)->default('bank_transfer'); // cash, upi, bank_transfer, card, cheque
            $table->date('payment_date')->index();
            $table->string('reference_id', 100)->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('paid_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['gym_id', 'supplier_id', 'payment_date']);
        });

        // 4. Products Master
        Schema::create('products', function (Blueprint $table) {
            $table->id();
            $table->foreignId('gym_id')->constrained('gyms')->cascadeOnDelete();
            $table->string('name', 150);
            $table->string('brand', 100)->nullable()->index();
            $table->string('category', 60)->default('sports_nutrition')->index();
            // Categories: whey_protein, mass_gainers, creatine, pre_workout, sports_nutrition,
            // protein_bars, energy_drinks, shakers, gym_accessories, gym_merchandise, custom
            $table->string('sku', 60)->nullable()->index();
            $table->string('barcode', 80)->nullable()->index();
            $table->string('image_url', 255)->nullable();
            $table->longText('photo_data')->nullable(); // Base64 image
            $table->string('size', 40)->nullable(); // e.g. 1kg, 2kg, 500g, Large, Medium
            $table->string('weight', 40)->nullable();
            $table->string('flavour', 60)->nullable(); // Chocolate, Vanilla, Watermelon, etc.
            $table->decimal('cost_price', 10, 2)->default(0); // Weighted Average Cost (WAC)
            $table->decimal('selling_price', 10, 2)->default(0);
            $table->decimal('mrp', 10, 2)->default(0);
            $table->decimal('tax_percent', 5, 2)->default(18.00); // GST % (e.g. 18%)
            $table->foreignId('default_supplier_id')->nullable()->constrained('suppliers')->nullOnDelete();
            $table->unsignedInteger('min_stock_alert')->default(5);
            $table->boolean('is_active')->default(true)->index();
            $table->text('description')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['gym_id', 'category', 'is_active']);
        });

        // 5. Product Stock per Branch
        Schema::create('product_branch_stocks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('gym_id')->constrained('gyms')->cascadeOnDelete();
            $table->foreignId('branch_id')->constrained('branches')->cascadeOnDelete();
            $table->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $table->integer('quantity')->default(0);
            $table->decimal('cost_price', 10, 2)->default(0);
            $table->decimal('selling_price', 10, 2)->default(0);
            $table->timestamps();

            $table->unique(['branch_id', 'product_id']);
            $table->index(['gym_id', 'branch_id', 'product_id']);
        });

        // 6. Product Batches (Batch Number, Manufacturing & Expiry tracking)
        Schema::create('product_batches', function (Blueprint $table) {
            $table->id();
            $table->foreignId('gym_id')->constrained('gyms')->cascadeOnDelete();
            $table->foreignId('branch_id')->constrained('branches')->cascadeOnDelete();
            $table->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $table->foreignId('supplier_id')->nullable()->constrained('suppliers')->nullOnDelete();
            $table->string('batch_number', 80)->index();
            $table->date('manufacturing_date')->nullable();
            $table->date('expiry_date')->nullable()->index();
            $table->decimal('cost_price', 10, 2)->default(0);
            $table->decimal('selling_price', 10, 2)->default(0);
            $table->integer('initial_quantity')->default(0);
            $table->integer('current_quantity')->default(0);
            $table->timestamps();

            $table->index(['gym_id', 'branch_id', 'product_id', 'expiry_date']);
        });

        // 7. Purchase Invoices (Stock Purchases)
        Schema::create('purchase_invoices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('gym_id')->constrained('gyms')->cascadeOnDelete();
            $table->foreignId('branch_id')->constrained('branches')->cascadeOnDelete();
            $table->foreignId('supplier_id')->constrained('suppliers')->cascadeOnDelete();
            $table->string('invoice_number', 80)->index();
            $table->date('invoice_date')->index();
            $table->decimal('subtotal', 12, 2)->default(0);
            $table->decimal('tax_amount', 12, 2)->default(0);
            $table->decimal('discount_amount', 12, 2)->default(0);
            $table->decimal('total_amount', 12, 2)->default(0);
            $table->decimal('paid_amount', 12, 2)->default(0);
            $table->string('status', 30)->default('received'); // draft, received, cancelled
            $table->string('payment_status', 30)->default('unpaid'); // paid, partial, unpaid
            $table->text('notes')->nullable();
            $table->foreignId('received_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['gym_id', 'branch_id', 'invoice_date']);
        });

        // 8. Purchase Invoice Line Items
        Schema::create('purchase_invoice_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('gym_id')->constrained('gyms')->cascadeOnDelete();
            $table->foreignId('purchase_invoice_id')->constrained('purchase_invoices')->cascadeOnDelete();
            $table->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $table->string('batch_number', 80)->nullable();
            $table->date('manufacturing_date')->nullable();
            $table->date('expiry_date')->nullable();
            $table->integer('quantity');
            $table->decimal('unit_cost', 10, 2);
            $table->decimal('subtotal', 10, 2);
            $table->decimal('tax_percent', 5, 2)->default(0);
            $table->decimal('tax_amount', 10, 2)->default(0);
            $table->decimal('total_amount', 10, 2);
            $table->timestamps();

            $table->index(['gym_id', 'purchase_invoice_id', 'product_id']);
        });

        // 9. Point of Sale (POS) Orders
        Schema::create('pos_orders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('gym_id')->constrained('gyms')->cascadeOnDelete();
            $table->foreignId('branch_id')->constrained('branches')->cascadeOnDelete();
            $table->string('order_number', 60)->index(); // POS-2026-0001
            $table->foreignId('member_id')->nullable()->constrained('members')->nullOnDelete();
            $table->string('customer_name', 120)->nullable();
            $table->string('customer_phone', 30)->nullable();
            $table->decimal('subtotal', 10, 2)->default(0);
            $table->decimal('discount_amount', 10, 2)->default(0);
            $table->decimal('tax_amount', 10, 2)->default(0);
            $table->decimal('total_amount', 10, 2)->default(0);
            $table->decimal('paid_amount', 10, 2)->default(0);
            $table->decimal('balance_due', 10, 2)->default(0);
            $table->string('payment_method', 30)->default('upi'); // cash, upi, card, bank_transfer, split
            $table->string('payment_status', 30)->default('paid'); // paid, partial, refunded
            $table->string('status', 30)->default('completed'); // completed, refunded, cancelled
            $table->date('order_date')->index();
            $table->text('notes')->nullable();
            $table->foreignId('billed_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['gym_id', 'branch_id', 'order_date']);
            $table->index(['gym_id', 'member_id', 'order_date']);
        });

        // 10. POS Order Line Items
        Schema::create('pos_order_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('gym_id')->constrained('gyms')->cascadeOnDelete();
            $table->foreignId('pos_order_id')->constrained('pos_orders')->cascadeOnDelete();
            $table->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $table->foreignId('product_batch_id')->nullable()->constrained('product_batches')->nullOnDelete();
            $table->integer('quantity');
            $table->decimal('unit_cost_at_sale', 10, 2)->default(0); // Captured WAC cost at time of sale for exact COGS
            $table->decimal('unit_price', 10, 2);
            $table->decimal('discount_amount', 10, 2)->default(0);
            $table->decimal('tax_percent', 5, 2)->default(0);
            $table->decimal('tax_amount', 10, 2)->default(0);
            $table->decimal('total_amount', 10, 2);
            $table->timestamps();

            $table->index(['gym_id', 'pos_order_id', 'product_id']);
        });

        // 11. POS Customer Refunds / Returns
        Schema::create('pos_refunds', function (Blueprint $table) {
            $table->id();
            $table->foreignId('gym_id')->constrained('gyms')->cascadeOnDelete();
            $table->foreignId('branch_id')->constrained('branches')->cascadeOnDelete();
            $table->foreignId('pos_order_id')->constrained('pos_orders')->cascadeOnDelete();
            $table->string('refund_number', 60)->index();
            $table->decimal('amount', 10, 2);
            $table->string('payment_mode', 30)->default('cash');
            $table->date('refund_date')->index();
            $table->text('reason')->nullable();
            $table->boolean('restock_items')->default(true);
            $table->foreignId('refunded_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['gym_id', 'branch_id', 'refund_date']);
        });

        // 12. Permanent Inventory Movements Ledger (Audit trail for every stock change)
        Schema::create('inventory_movements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('gym_id')->constrained('gyms')->cascadeOnDelete();
            $table->foreignId('branch_id')->constrained('branches')->cascadeOnDelete();
            $table->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $table->foreignId('product_batch_id')->nullable()->constrained('product_batches')->nullOnDelete();
            $table->string('type', 40); // opening_stock, purchase, sale, adjustment, transfer_in, transfer_out, damaged, expired, supplier_return, customer_return
            $table->string('reference_type', 40)->nullable(); // purchase_invoice, pos_order, stock_adjustment, stock_transfer, pos_refund
            $table->unsignedBigInteger('reference_id')->nullable();
            $table->integer('quantity_change'); // positive (inflow) or negative (outflow)
            $table->integer('quantity_before');
            $table->integer('quantity_after');
            $table->decimal('unit_cost', 10, 2)->default(0);
            $table->decimal('total_cost', 10, 2)->default(0);
            $table->text('notes')->nullable();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['gym_id', 'branch_id', 'product_id', 'created_at']);
        });

        // 13. Inter-Branch Stock Transfers
        Schema::create('stock_transfers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('gym_id')->constrained('gyms')->cascadeOnDelete();
            $table->string('transfer_number', 60)->index();
            $table->foreignId('from_branch_id')->constrained('branches')->cascadeOnDelete();
            $table->foreignId('to_branch_id')->constrained('branches')->cascadeOnDelete();
            $table->date('transfer_date')->index();
            $table->string('status', 30)->default('completed'); // pending, completed, cancelled
            $table->text('notes')->nullable();
            $table->foreignId('initiated_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('received_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['gym_id', 'from_branch_id', 'to_branch_id']);
        });

        // 14. Stock Transfer Line Items
        Schema::create('stock_transfer_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('gym_id')->constrained('gyms')->cascadeOnDelete();
            $table->foreignId('stock_transfer_id')->constrained('stock_transfers')->cascadeOnDelete();
            $table->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $table->integer('quantity');
            $table->decimal('unit_cost', 10, 2)->default(0);
            $table->timestamps();

            $table->index(['gym_id', 'stock_transfer_id', 'product_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stock_transfer_items');
        Schema::dropIfExists('stock_transfers');
        Schema::dropIfExists('inventory_movements');
        Schema::dropIfExists('pos_refunds');
        Schema::dropIfExists('pos_order_items');
        Schema::dropIfExists('pos_orders');
        Schema::dropIfExists('purchase_invoice_items');
        Schema::dropIfExists('purchase_invoices');
        Schema::dropIfExists('product_batches');
        Schema::dropIfExists('product_branch_stocks');
        Schema::dropIfExists('products');
        Schema::dropIfExists('supplier_payments');
        Schema::dropIfExists('supplier_ledgers');
        Schema::dropIfExists('suppliers');
    }
};
