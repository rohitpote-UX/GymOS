<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\Gym;
use App\Models\InventoryMovement;
use App\Models\Member;
use App\Models\PosOrder;
use App\Models\PosOrderItem;
use App\Models\Product;
use App\Models\ProductBatch;
use App\Models\ProductBranchStock;
use App\Models\PurchaseInvoice;
use App\Models\SaasPlan;
use App\Models\Supplier;
use App\Models\SupplierPayment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class InventoryAndPosTest extends TestCase
{
    use RefreshDatabase;

    protected Gym $gym;
    protected Branch $branchMain;
    protected Branch $branchSub;
    protected User $owner;
    protected string $token;

    protected function setUp(): void
    {
        parent::setUp();

        $plan = SaasPlan::create([
            'name' => 'Pro Club',
            'code' => 'pro',
            'price' => 4999.00,
            'interval' => 'month',
            'branch_limit' => 5,
            'member_limit' => 1000,
            'is_active' => true,
        ]);

        $this->gym = Gym::create([
            'name' => 'MuscleFactory Gym',
            'slug' => 'musclefactory',
            'email' => 'contact@musclefactory.in',
            'phone' => '9800011122',
            'status' => Gym::STATUS_ACTIVE,
            'saas_plan_id' => $plan->id,
            'subscription_expires_at' => now()->addDays(60),
        ]);

        $this->branchMain = Branch::create([
            'gym_id' => $this->gym->id,
            'name' => 'Central Hub',
            'code' => 'CH01',
            'is_main' => true,
            'is_active' => true,
        ]);

        $this->branchSub = Branch::create([
            'gym_id' => $this->gym->id,
            'name' => 'North Annex',
            'code' => 'NA02',
            'is_main' => false,
            'is_active' => true,
        ]);

        $this->owner = User::create([
            'gym_id' => $this->gym->id,
            'name' => 'Gym Owner Vikram',
            'email' => 'vikram@musclefactory.in',
            'password' => bcrypt('password123'),
            'role' => User::ROLE_GYM_OWNER,
            'is_active' => true,
        ]);

        $this->token = $this->owner->createToken('test-token')->plainTextToken;
    }

    protected function authHeaders(int $branchId = null): array
    {
        return [
            'Authorization' => "Bearer {$this->token}",
            'X-Gym-Id' => (string) $this->gym->id,
            'X-Branch-Id' => (string) ($branchId ?: $this->branchMain->id),
            'Accept' => 'application/json',
        ];
    }

    public function test_can_create_product_with_opening_stock_and_movement(): void
    {
        $response = $this->postJson('/api/products', [
            'name' => 'ON Gold Standard Whey 1kg',
            'brand' => 'Optimum Nutrition',
            'category' => 'whey_protein',
            'sku' => 'ON-1KG-WHEY',
            'barcode' => '890987654321',
            'cost_price' => 2500.00,
            'selling_price' => 3200.00,
            'mrp' => 3600.00,
            'tax_percent' => 18.00,
            'min_stock_alert' => 5,
            'opening_stock' => 10,
            'branch_id' => $this->branchMain->id,
        ], $this->authHeaders());

        $response->assertStatus(201)
            ->assertJsonPath('product.name', 'ON Gold Standard Whey 1kg')
            ->assertJsonPath('product.cost_price', '2500.00');

        $productId = $response->json('product.id');

        // Verify branch stock
        $this->assertDatabaseHas('product_branch_stocks', [
            'gym_id' => $this->gym->id,
            'branch_id' => $this->branchMain->id,
            'product_id' => $productId,
            'quantity' => 10,
        ]);

        // Verify permanent inventory movement audit log
        $this->assertDatabaseHas('inventory_movements', [
            'gym_id' => $this->gym->id,
            'branch_id' => $this->branchMain->id,
            'product_id' => $productId,
            'type' => 'opening_stock',
            'quantity_change' => 10,
            'quantity_after' => 10,
        ]);
    }

    public function test_purchase_invoice_calculates_weighted_average_cost_accurately(): void
    {
        // 1. Create product with initial stock: 10 units @ 2000 cost = 20,000
        $product = Product::create([
            'gym_id' => $this->gym->id,
            'name' => 'Biozyme Whey 1kg',
            'category' => 'whey_protein',
            'cost_price' => 2000.00,
            'selling_price' => 2800.00,
        ]);

        ProductBranchStock::create([
            'gym_id' => $this->gym->id,
            'branch_id' => $this->branchMain->id,
            'product_id' => $product->id,
            'quantity' => 10,
            'cost_price' => 2000.00,
            'selling_price' => 2800.00,
        ]);

        $supplier = Supplier::create([
            'gym_id' => $this->gym->id,
            'name' => 'MuscleBlaze India',
            'phone' => '9876543210',
        ]);

        // 2. Buy 10 new units @ 2600 each
        // Weighted Average Cost should become: ((10 * 2000) + (10 * 2600)) / (10 + 10) = 46,000 / 20 = 2300.00
        $response = $this->postJson('/api/purchase-invoices', [
            'supplier_id' => $supplier->id,
            'branch_id' => $this->branchMain->id,
            'invoice_date' => now()->toDateString(),
            'items' => [
                [
                    'product_id' => $product->id,
                    'quantity' => 10,
                    'unit_cost' => 2600.00,
                    'tax_percent' => 0,
                    'batch_number' => 'BATCH-MB-101',
                ]
            ],
            'paid_amount' => 15000.00,
            'payment_mode' => 'bank_transfer',
        ], $this->authHeaders());

        $response->assertStatus(201);

        // Verify updated WAC in stock and product
        $stock = ProductBranchStock::where('product_id', $product->id)->first();
        $this->assertEquals(20, $stock->quantity);
        $this->assertEquals(2300.00, (float) $stock->cost_price);

        $freshProduct = $product->fresh();
        $this->assertEquals(2300.00, (float) $freshProduct->cost_price);

        // Verify supplier ledger updated
        $freshSupplier = $supplier->fresh();
        $this->assertEquals(26000.00, (float) $freshSupplier->total_purchased);
        $this->assertEquals(15000.00, (float) $freshSupplier->total_paid);
        $this->assertEquals(11000.00, (float) $freshSupplier->outstanding_balance);
    }

    public function test_pos_checkout_deducts_stock_and_snapshots_unit_cost_for_cogs(): void
    {
        $product = Product::create([
            'gym_id' => $this->gym->id,
            'name' => 'Creatine 250g',
            'category' => 'creatine',
            'cost_price' => 600.00,
            'selling_price' => 999.00,
            'tax_percent' => 18.00,
        ]);

        ProductBranchStock::create([
            'gym_id' => $this->gym->id,
            'branch_id' => $this->branchMain->id,
            'product_id' => $product->id,
            'quantity' => 15,
            'cost_price' => 600.00,
            'selling_price' => 999.00,
        ]);

        $response = $this->postJson('/api/pos/checkout', [
            'branch_id' => $this->branchMain->id,
            'customer_name' => 'Ramesh Kumar',
            'customer_phone' => '9898989898',
            'items' => [
                [
                    'product_id' => $product->id,
                    'quantity' => 2,
                    'unit_price' => 999.00,
                ]
            ],
            'payment_method' => 'upi',
            'paid_amount' => 2357.64, // (2 * 999) + 18% tax
        ], $this->authHeaders());

        $response->assertStatus(201)
            ->assertJsonPath('order.payment_status', 'paid');

        // Verify inventory deducted
        $stock = ProductBranchStock::where('product_id', $product->id)->first();
        $this->assertEquals(13, $stock->quantity);

        // Verify COGS unit_cost_at_sale was snapshotted
        $orderItem = PosOrderItem::where('product_id', $product->id)->first();
        $this->assertEquals(600.00, (float) $orderItem->unit_cost_at_sale);

        // Verify inventory movement
        $this->assertDatabaseHas('inventory_movements', [
            'gym_id' => $this->gym->id,
            'product_id' => $product->id,
            'type' => 'sale',
            'quantity_change' => -2,
            'quantity_before' => 15,
            'quantity_after' => 13,
        ]);
    }

    public function test_cannot_sell_more_than_available_stock_negative_inventory_prevented(): void
    {
        $product = Product::create([
            'gym_id' => $this->gym->id,
            'name' => 'Cellucor C4 Pre-Workout',
            'category' => 'pre_workout',
            'cost_price' => 1800.00,
            'selling_price' => 2400.00,
        ]);

        ProductBranchStock::create([
            'gym_id' => $this->gym->id,
            'branch_id' => $this->branchMain->id,
            'product_id' => $product->id,
            'quantity' => 3, // Only 3 in stock
            'cost_price' => 1800.00,
            'selling_price' => 2400.00,
        ]);

        // Attempting to buy 5 units should fail with 422
        $response = $this->postJson('/api/pos/checkout', [
            'branch_id' => $this->branchMain->id,
            'customer_name' => 'Anil Kapoor',
            'items' => [
                [
                    'product_id' => $product->id,
                    'quantity' => 5, // Greater than available 3
                ]
            ],
            'payment_method' => 'cash',
            'paid_amount' => 12000.00,
        ], $this->authHeaders());

        $response->assertStatus(422)
            ->assertJsonValidationErrors('items');

        // Verify stock remains untouched at 3
        $stock = ProductBranchStock::where('product_id', $product->id)->first();
        $this->assertEquals(3, $stock->quantity);
    }

    public function test_pos_partial_payment_for_member_updates_member_financial_ledger(): void
    {
        $member = Member::create([
            'gym_id' => $this->gym->id,
            'primary_branch_id' => $this->branchMain->id,
            'member_code' => 'MEM-VO-001',
            'first_name' => 'Vivek',
            'last_name' => 'Oberoi',
            'phone' => '9877788899',
            'status' => 'active',
            'joined_date' => now()->toDateString(),
        ]);

        $product = Product::create([
            'gym_id' => $this->gym->id,
            'name' => 'Steel Shaker Bottle',
            'category' => 'shakers',
            'cost_price' => 300.00,
            'selling_price' => 600.00,
            'tax_percent' => 0,
        ]);

        ProductBranchStock::create([
            'gym_id' => $this->gym->id,
            'branch_id' => $this->branchMain->id,
            'product_id' => $product->id,
            'quantity' => 10,
            'cost_price' => 300.00,
            'selling_price' => 600.00,
        ]);

        // Total 1200, but member pays only 500 now, leaves 700 balance due
        $response = $this->postJson('/api/pos/checkout', [
            'branch_id' => $this->branchMain->id,
            'member_id' => $member->id,
            'items' => [
                [
                    'product_id' => $product->id,
                    'quantity' => 2,
                    'unit_price' => 600.00,
                ]
            ],
            'payment_method' => 'upi',
            'paid_amount' => 500.00,
        ], $this->authHeaders());

        $response->assertStatus(201)
            ->assertJsonPath('order.balance_due', '700.00')
            ->assertJsonPath('order.payment_status', 'partial');

        // Member outstanding balance must now equal 700
        $freshMember = $member->fresh();
        $this->assertEquals(700.00, (float) $freshMember->outstanding_balance);

        // Member ledger charge record must exist
        $this->assertDatabaseHas('member_ledgers', [
            'gym_id' => $this->gym->id,
            'member_id' => $member->id,
            'type' => 'charge',
            'debit' => 1200.00,
        ]);
    }

    public function test_pos_refund_restocks_inventory_and_logs_movement(): void
    {
        $product = Product::create([
            'gym_id' => $this->gym->id,
            'name' => 'Lifting Straps',
            'category' => 'gym_accessories',
            'cost_price' => 200.00,
            'selling_price' => 450.00,
            'tax_percent' => 0,
        ]);

        ProductBranchStock::create([
            'gym_id' => $this->gym->id,
            'branch_id' => $this->branchMain->id,
            'product_id' => $product->id,
            'quantity' => 10,
            'cost_price' => 200.00,
            'selling_price' => 450.00,
        ]);

        // Sale of 2 units
        $saleResponse = $this->postJson('/api/pos/checkout', [
            'branch_id' => $this->branchMain->id,
            'customer_name' => 'Test Customer',
            'items' => [
                ['product_id' => $product->id, 'quantity' => 2, 'unit_price' => 450.00]
            ],
            'payment_method' => 'cash',
            'paid_amount' => 900.00,
        ], $this->authHeaders());

        $orderId = $saleResponse->json('order.id');
        $this->assertEquals(8, ProductBranchStock::where('product_id', $product->id)->first()->quantity);

        // Refund order
        $refundResponse = $this->postJson("/api/pos/orders/{$orderId}/refund", [
            'amount' => 900.00,
            'payment_mode' => 'cash',
            'reason' => 'Customer changed mind',
            'restock_items' => true,
        ], $this->authHeaders());

        $refundResponse->assertStatus(200);

        // Stock restored back to 10
        $this->assertEquals(10, ProductBranchStock::where('product_id', $product->id)->first()->quantity);

        // Movement record
        $this->assertDatabaseHas('inventory_movements', [
            'gym_id' => $this->gym->id,
            'product_id' => $product->id,
            'type' => 'customer_return',
            'quantity_change' => 2,
        ]);
    }

    public function test_stock_adjustment_damaged_stock_and_negative_adjustment_prevention(): void
    {
        $product = Product::create([
            'gym_id' => $this->gym->id,
            'name' => 'Protein Shaker Plastic',
            'category' => 'shakers',
            'cost_price' => 150.00,
            'selling_price' => 300.00,
        ]);

        ProductBranchStock::create([
            'gym_id' => $this->gym->id,
            'branch_id' => $this->branchMain->id,
            'product_id' => $product->id,
            'quantity' => 5,
            'cost_price' => 150.00,
            'selling_price' => 300.00,
        ]);

        // 1. Valid write-off of 2 damaged shakers
        $adjResponse = $this->postJson('/api/inventory/adjust', [
            'product_id' => $product->id,
            'branch_id' => $this->branchMain->id,
            'adjustment_type' => 'damaged',
            'quantity_change' => -2,
            'notes' => 'Cracked in transit',
        ], $this->authHeaders());

        $adjResponse->assertStatus(200);
        $this->assertEquals(3, ProductBranchStock::where('product_id', $product->id)->first()->quantity);

        // 2. Invalid adjustment: attempting to deduct 5 when only 3 remain must fail with 422
        $invalidAdj = $this->postJson('/api/inventory/adjust', [
            'product_id' => $product->id,
            'branch_id' => $this->branchMain->id,
            'adjustment_type' => 'damaged',
            'quantity_change' => -5,
            'notes' => 'Excess deduction',
        ], $this->authHeaders());

        $invalidAdj->assertStatus(422)
            ->assertJsonValidationErrors('quantity_change');
    }

    public function test_inter_branch_stock_transfer(): void
    {
        $product = Product::create([
            'gym_id' => $this->gym->id,
            'name' => 'Gym T-Shirt Black (L)',
            'category' => 'gym_merchandise',
            'cost_price' => 350.00,
            'selling_price' => 699.00,
        ]);

        ProductBranchStock::create([
            'gym_id' => $this->gym->id,
            'branch_id' => $this->branchMain->id,
            'product_id' => $product->id,
            'quantity' => 20,
            'cost_price' => 350.00,
            'selling_price' => 699.00,
        ]);

        // Transfer 6 units from Central Hub to North Annex
        $response = $this->postJson('/api/inventory/transfers', [
            'from_branch_id' => $this->branchMain->id,
            'to_branch_id' => $this->branchSub->id,
            'items' => [
                ['product_id' => $product->id, 'quantity' => 6]
            ],
            'notes' => 'Restocking North Annex branch',
        ], $this->authHeaders());

        $response->assertStatus(201);

        // Central hub now has 14
        $this->assertEquals(14, ProductBranchStock::where('branch_id', $this->branchMain->id)->where('product_id', $product->id)->first()->quantity);

        // North annex now has 6
        $this->assertEquals(6, ProductBranchStock::where('branch_id', $this->branchSub->id)->where('product_id', $product->id)->first()->quantity);

        // Verify transfer_out and transfer_in movements exist
        $this->assertDatabaseHas('inventory_movements', [
            'gym_id' => $this->gym->id,
            'branch_id' => $this->branchMain->id,
            'type' => 'transfer_out',
            'quantity_change' => -6,
        ]);

        $this->assertDatabaseHas('inventory_movements', [
            'gym_id' => $this->gym->id,
            'branch_id' => $this->branchSub->id,
            'type' => 'transfer_in',
            'quantity_change' => 6,
        ]);
    }

    public function test_profitability_overview_returns_correct_cogs_and_margins(): void
    {
        $product = Product::create([
            'gym_id' => $this->gym->id,
            'name' => 'Whey Isolate',
            'category' => 'whey_protein',
            'cost_price' => 4000.00,
            'selling_price' => 6000.00,
            'tax_percent' => 0,
        ]);

        ProductBranchStock::create([
            'gym_id' => $this->gym->id,
            'branch_id' => $this->branchMain->id,
            'product_id' => $product->id,
            'quantity' => 10,
            'cost_price' => 4000.00,
            'selling_price' => 6000.00,
        ]);

        // Sale of 2 units: Revenue = 12000, COGS = 8000, Gross Profit = 4000, Margin = 33.33%
        $this->postJson('/api/pos/checkout', [
            'branch_id' => $this->branchMain->id,
            'customer_name' => 'Karan',
            'items' => [
                ['product_id' => $product->id, 'quantity' => 2, 'unit_price' => 6000.00]
            ],
            'payment_method' => 'card',
            'paid_amount' => 12000.00,
        ], $this->authHeaders());

        $response = $this->getJson('/api/profitability/overview', $this->authHeaders());

        $response->assertStatus(200);

        $kpis = $response->json('kpis');
        $this->assertEquals(12000.00, (float) $kpis['period_supplement_revenue']);
        $this->assertEquals(8000.00, (float) $kpis['period_cogs']);
        $this->assertEquals(4000.00, (float) $kpis['period_gross_profit']);
        $this->assertEquals(33.33, (float) $kpis['period_gross_margin_percent']);
        // Remaining 8 units @ 4000 cost = 32000 valuation
        $this->assertEquals(32000.00, (float) $kpis['inventory_cost_valuation']);
    }

    public function test_multi_tenant_isolation_gym_b_cannot_access_gym_a_inventory(): void
    {
        // Product in Gym A
        $productA = Product::create([
            'gym_id' => $this->gym->id,
            'name' => 'Gym A Secret Blend',
            'category' => 'custom',
            'cost_price' => 1000.00,
            'selling_price' => 1500.00,
        ]);

        // Create Gym B and User B
        $gymB = Gym::create([
            'name' => 'Rival Fitness Club',
            'slug' => 'rivalfit',
            'status' => Gym::STATUS_ACTIVE,
        ]);

        $branchB = Branch::create([
            'gym_id' => $gymB->id,
            'name' => 'Rival Main',
            'code' => 'RF01',
            'is_main' => true,
            'is_active' => true,
        ]);

        $ownerB = User::create([
            'gym_id' => $gymB->id,
            'name' => 'Owner B',
            'email' => 'ownerb@rivalfit.in',
            'password' => bcrypt('password123'),
            'role' => User::ROLE_GYM_OWNER,
            'is_active' => true,
        ]);

        $tokenB = $ownerB->createToken('token-b')->plainTextToken;

        $headersB = [
            'Authorization' => "Bearer {$tokenB}",
            'X-Gym-Id' => (string) $gymB->id,
            'X-Branch-Id' => (string) $branchB->id,
            'Accept' => 'application/json',
        ];

        // Gym B accessing Gym A's product directly must return 404
        $response = $this->getJson("/api/products/{$productA->id}", $headersB);
        $response->assertStatus(404);

        // Gym B product list must not contain Gym A's product
        $listResponse = $this->getJson('/api/products', $headersB);
        $listResponse->assertStatus(200);
        $names = collect($listResponse->json('products.data'))->pluck('name');
        $this->assertFalse($names->contains('Gym A Secret Blend'));
    }
}
