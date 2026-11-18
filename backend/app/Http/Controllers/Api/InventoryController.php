<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\InventoryMovement;
use App\Models\Product;
use App\Models\ProductBatch;
use App\Models\ProductBranchStock;
use App\Models\StockTransfer;
use App\Models\StockTransferItem;
use App\Support\CurrentBranch;
use App\Support\CurrentGym;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class InventoryController extends Controller
{
    public function movements(Request $request)
    {
        $branchId = $request->query('branch_id') ?: CurrentBranch::id();

        $query = InventoryMovement::with([
            'product:id,name,brand,sku,barcode,category',
            'branch:id,name,code',
            'user:id,name',
            'batch:id,batch_number,expiry_date',
        ]);

        if ($branchId) {
            $query->where('branch_id', $branchId);
        }

        if ($request->filled('product_id')) {
            $query->where('product_id', $request->query('product_id'));
        }

        if ($request->filled('type')) {
            $query->where('type', $request->query('type'));
        }

        if ($request->filled('from')) {
            $query->whereDate('created_at', '>=', $request->query('from'));
        }

        if ($request->filled('to')) {
            $query->whereDate('created_at', '<=', $request->query('to'));
        }

        $perPage = (int) $request->query('per_page', 25);
        $movements = $query->latest('id')->paginate($perPage);

        return response()->json([
            'movements' => $movements,
        ]);
    }

    public function adjustStock(Request $request)
    {
        $validated = $request->validate([
            'product_id' => 'required|exists:products,id',
            'branch_id' => 'nullable|exists:branches,id',
            'product_batch_id' => 'nullable|exists:product_batches,id',
            'adjustment_type' => 'required|string|in:damaged,expired,audit_count,supplier_return,adjustment',
            'quantity_change' => 'required|integer|not_in:0',
            'notes' => 'required|string|max:255',
        ]);

        $gymId = CurrentGym::require();
        $branchId = $validated['branch_id'] ?? CurrentBranch::require();
        $product = Product::findOrFail($validated['product_id']);
        $qtyChange = (int) $validated['quantity_change'];

        $movement = DB::transaction(function () use ($gymId, $branchId, $product, $validated, $qtyChange, $request) {
            $branchStock = ProductBranchStock::firstOrCreate(
                ['branch_id' => $branchId, 'product_id' => $product->id],
                [
                    'gym_id' => $gymId,
                    'quantity' => 0,
                    'cost_price' => $product->cost_price,
                    'selling_price' => $product->selling_price,
                ]
            );

            // Reload with lock
            $branchStock = ProductBranchStock::where('id', $branchStock->id)->lockForUpdate()->first();

            $qtyBefore = $branchStock->quantity;
            $qtyAfter = $qtyBefore + $qtyChange;

            // Invariant: Stock cannot become negative
            if ($qtyAfter < 0) {
                throw ValidationException::withMessages([
                    'quantity_change' => ["Stock adjustment cannot result in negative inventory. Current: {$qtyBefore}, Requested change: {$qtyChange}."]
                ]);
            }

            $branchStock->update(['quantity' => $qtyAfter]);

            // Adjust batch if specified
            $batchId = $validated['product_batch_id'] ?? null;
            if ($batchId) {
                $batch = ProductBatch::where('id', $batchId)->lockForUpdate()->first();
                if ($batch) {
                    $batchNewQty = max(0, $batch->current_quantity + $qtyChange);
                    $batch->update(['current_quantity' => $batchNewQty]);
                }
            }

            $unitCost = (float) $branchStock->cost_price;
            $totalCost = round(abs($qtyChange) * $unitCost, 2);

            $movement = InventoryMovement::create([
                'gym_id' => $gymId,
                'branch_id' => $branchId,
                'product_id' => $product->id,
                'product_batch_id' => $batchId,
                'type' => $validated['adjustment_type'],
                'reference_type' => 'stock_adjustment',
                'quantity_change' => $qtyChange,
                'quantity_before' => $qtyBefore,
                'quantity_after' => $qtyAfter,
                'unit_cost' => $unitCost,
                'total_cost' => $totalCost,
                'notes' => $validated['notes'],
                'user_id' => $request->user()->id,
            ]);

            AuditLog::record('inventory.adjusted', [
                'product_id' => $product->id,
                'branch_id' => $branchId,
                'type' => $validated['adjustment_type'],
                'quantity_change' => $qtyChange,
                'qty_after' => $qtyAfter,
            ]);

            return $movement;
        });

        return response()->json([
            'message' => 'Stock adjusted successfully',
            'movement' => $movement->load(['product', 'branch', 'user']),
        ]);
    }

    public function lowStockAlerts(Request $request)
    {
        $branchId = $request->query('branch_id') ?: CurrentBranch::id();

        $query = DB::table('products')
            ->join('product_branch_stocks', 'products.id', '=', 'product_branch_stocks.product_id')
            ->join('branches', 'product_branch_stocks.branch_id', '=', 'branches.id')
            ->leftJoin('suppliers', 'products.default_supplier_id', '=', 'suppliers.id')
            ->where('products.gym_id', CurrentGym::require())
            ->where('products.is_active', true)
            ->where('products.deleted_at', null)
            ->whereColumn('product_branch_stocks.quantity', '<=', 'products.min_stock_alert')
            ->select([
                'products.id as product_id',
                'products.name as product_name',
                'products.brand',
                'products.category',
                'products.sku',
                'products.barcode',
                'products.min_stock_alert',
                'products.cost_price',
                'products.selling_price',
                'product_branch_stocks.branch_id',
                'branches.name as branch_name',
                'product_branch_stocks.quantity as current_quantity',
                'suppliers.name as default_supplier_name',
                'suppliers.phone as supplier_phone',
            ]);

        if ($branchId) {
            $query->where('product_branch_stocks.branch_id', $branchId);
        }

        $lowStockItems = $query->orderBy('product_branch_stocks.quantity', 'asc')->get();

        return response()->json([
            'low_stock_count' => $lowStockItems->count(),
            'items' => $lowStockItems,
        ]);
    }

    public function expiringAlerts(Request $request)
    {
        $branchId = $request->query('branch_id') ?: CurrentBranch::id();
        $days = (int) $request->query('days', 30);
        $cutoffDate = Carbon::today()->addDays($days)->toDateString();

        $query = ProductBatch::with([
            'product:id,name,brand,category,sku',
            'branch:id,name,code',
            'supplier:id,name,phone',
        ])
        ->where('gym_id', CurrentGym::require())
        ->where('current_quantity', '>', 0)
        ->whereNotNull('expiry_date')
        ->whereDate('expiry_date', '<=', $cutoffDate);

        if ($branchId) {
            $query->where('branch_id', $branchId);
        }

        $expiringBatches = $query->orderBy('expiry_date', 'asc')->get()->map(function ($batch) {
            $expiry = Carbon::parse($batch->expiry_date);
            $now = Carbon::today();
            $daysLeft = $now->diffInDays($expiry, false);

            return [
                'batch_id' => $batch->id,
                'batch_number' => $batch->batch_number,
                'product_id' => $batch->product_id,
                'product_name' => $batch->product?->name,
                'brand' => $batch->product?->brand,
                'category' => $batch->product?->category,
                'branch_name' => $batch->branch?->name,
                'manufacturing_date' => $batch->manufacturing_date?->toDateString(),
                'expiry_date' => $batch->expiry_date?->toDateString(),
                'days_remaining' => (int) $daysLeft,
                'is_expired' => $daysLeft < 0,
                'current_quantity' => $batch->current_quantity,
                'cost_price' => (float) $batch->cost_price,
                'stock_value' => round($batch->current_quantity * (float) $batch->cost_price, 2),
                'supplier_name' => $batch->supplier?->name,
                'supplier_phone' => $batch->supplier?->phone,
            ];
        });

        return response()->json([
            'expiring_count' => $expiringBatches->count(),
            'threshold_days' => $days,
            'batches' => $expiringBatches,
        ]);
    }

    public function transferStock(Request $request)
    {
        $validated = $request->validate([
            'from_branch_id' => 'required|exists:branches,id',
            'to_branch_id' => 'required|exists:branches,id|different:from_branch_id',
            'transfer_date' => 'nullable|date',
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|exists:products,id',
            'items.*.quantity' => 'required|integer|min:1',
            'notes' => 'nullable|string',
        ]);

        $gymId = CurrentGym::require();

        $transfer = DB::transaction(function () use ($gymId, $validated, $request) {
            $fromBranchId = $validated['from_branch_id'];
            $toBranchId = $validated['to_branch_id'];

            // 1. Verify stocks at source branch
            $checkedItems = [];
            foreach ($validated['items'] as $item) {
                $product = Product::findOrFail($item['product_id']);
                $qty = (int) $item['quantity'];

                $sourceStock = ProductBranchStock::where('branch_id', $fromBranchId)
                    ->where('product_id', $product->id)
                    ->lockForUpdate()
                    ->first();

                $available = $sourceStock ? $sourceStock->quantity : 0;
                if ($available < $qty) {
                    throw ValidationException::withMessages([
                        'items' => ["Source branch does not have enough stock for '{$product->name}'. Available: {$available}, Requested: {$qty}."]
                    ]);
                }

                $checkedItems[] = [
                    'product' => $product,
                    'source_stock' => $sourceStock,
                    'quantity' => $qty,
                    'unit_cost' => (float) ($sourceStock->cost_price ?? $product->cost_price),
                ];
            }

            // 2. Create Stock Transfer record
            $count = StockTransfer::where('gym_id', $gymId)->count();
            $transferNumber = 'TRF-' . date('Y') . '-' . str_pad((string) ($count + 1), 5, '0', STR_PAD_LEFT);

            $transfer = StockTransfer::create([
                'gym_id' => $gymId,
                'transfer_number' => $transferNumber,
                'from_branch_id' => $fromBranchId,
                'to_branch_id' => $toBranchId,
                'transfer_date' => $validated['transfer_date'] ?? now()->toDateString(),
                'status' => 'completed',
                'notes' => $validated['notes'] ?? null,
                'initiated_by_user_id' => $request->user()->id,
                'received_by_user_id' => $request->user()->id,
            ]);

            // 3. Move inventory and record dual audit trail movements
            foreach ($checkedItems as $cItem) {
                $product = $cItem['product'];
                $qty = $cItem['quantity'];
                $unitCost = $cItem['unit_cost'];
                $sourceStock = $cItem['source_stock'];

                // Deduct from source branch
                $fromBefore = $sourceStock->quantity;
                $sourceStock->decrement('quantity', $qty);
                $fromAfter = $fromBefore - $qty;

                InventoryMovement::create([
                    'gym_id' => $gymId,
                    'branch_id' => $fromBranchId,
                    'product_id' => $product->id,
                    'type' => 'transfer_out',
                    'reference_type' => 'stock_transfer',
                    'reference_id' => $transfer->id,
                    'quantity_change' => -$qty,
                    'quantity_before' => $fromBefore,
                    'quantity_after' => $fromAfter,
                    'unit_cost' => $unitCost,
                    'total_cost' => round($qty * $unitCost, 2),
                    'notes' => "Inter-branch transfer OUT to branch #{$toBranchId} (Transfer #{$transferNumber})",
                    'user_id' => $request->user()->id,
                ]);

                // Add to destination branch
                $destStock = ProductBranchStock::firstOrCreate(
                    ['branch_id' => $toBranchId, 'product_id' => $product->id],
                    [
                        'gym_id' => $gymId,
                        'quantity' => 0,
                        'cost_price' => $unitCost,
                        'selling_price' => $sourceStock->selling_price,
                    ]
                );

                $destStock = ProductBranchStock::where('id', $destStock->id)->lockForUpdate()->first();
                $toBefore = $destStock->quantity;
                $destStock->increment('quantity', $qty);
                $toAfter = $toBefore + $qty;

                InventoryMovement::create([
                    'gym_id' => $gymId,
                    'branch_id' => $toBranchId,
                    'product_id' => $product->id,
                    'type' => 'transfer_in',
                    'reference_type' => 'stock_transfer',
                    'reference_id' => $transfer->id,
                    'quantity_change' => $qty,
                    'quantity_before' => $toBefore,
                    'quantity_after' => $toAfter,
                    'unit_cost' => $unitCost,
                    'total_cost' => round($qty * $unitCost, 2),
                    'notes' => "Inter-branch transfer IN from branch #{$fromBranchId} (Transfer #{$transferNumber})",
                    'user_id' => $request->user()->id,
                ]);

                StockTransferItem::create([
                    'gym_id' => $gymId,
                    'stock_transfer_id' => $transfer->id,
                    'product_id' => $product->id,
                    'quantity' => $qty,
                    'unit_cost' => $unitCost,
                ]);
            }

            AuditLog::record('inventory.transferred', [
                'transfer_number' => $transferNumber,
                'from_branch_id' => $fromBranchId,
                'to_branch_id' => $toBranchId,
                'items_count' => count($checkedItems),
            ]);

            return $transfer;
        });

        return response()->json([
            'message' => 'Stock transfer completed successfully',
            'transfer' => $transfer->load(['fromBranch:id,name', 'toBranch:id,name', 'items.product']),
        ], 201);
    }
}
