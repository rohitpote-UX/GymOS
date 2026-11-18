<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\InventoryMovement;
use App\Models\Member;
use App\Models\MemberLedger;
use App\Models\PosOrder;
use App\Models\PosOrderItem;
use App\Models\PosRefund;
use App\Models\Product;
use App\Models\ProductBatch;
use App\Models\ProductBranchStock;
use App\Support\CurrentBranch;
use App\Support\CurrentGym;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class PosController extends Controller
{
    public function checkout(Request $request)
    {
        $validated = $request->validate([
            'branch_id' => 'nullable|exists:branches,id',
            'member_id' => 'nullable|exists:members,id',
            'customer_name' => 'nullable|string|max:120',
            'customer_phone' => 'nullable|string|max:30',
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|exists:products,id',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.unit_price' => 'nullable|numeric|min:0',
            'items.*.discount_amount' => 'nullable|numeric|min:0',
            'items.*.product_batch_id' => 'nullable|exists:product_batches,id',
            'order_discount' => 'nullable|numeric|min:0',
            'payment_method' => 'required|string|in:cash,upi,card,bank_transfer,split',
            'paid_amount' => 'required|numeric|min:0',
            'notes' => 'nullable|string',
        ]);

        $gymId = CurrentGym::require();
        $branchId = $validated['branch_id'] ?? CurrentBranch::require();

        $member = null;
        if (!empty($validated['member_id'])) {
            $member = Member::findOrFail($validated['member_id']);
        }

        $order = DB::transaction(function () use ($gymId, $branchId, $member, $validated, $request) {
            // Generate sequential order number
            $orderCount = PosOrder::where('gym_id', $gymId)->count();
            $orderNumber = 'POS-' . date('Y') . '-' . str_pad((string) ($orderCount + 1), 5, '0', STR_PAD_LEFT);

            $subtotal = 0;
            $itemsTax = 0;
            $itemsDiscount = 0;
            $processedItems = [];

            // 1. Validate stocks and acquire pessimistic locks
            foreach ($validated['items'] as $item) {
                $product = Product::findOrFail($item['product_id']);
                $requestedQty = (int) $item['quantity'];

                $branchStock = ProductBranchStock::where('branch_id', $branchId)
                    ->where('product_id', $product->id)
                    ->lockForUpdate()
                    ->first();

                $availableStock = $branchStock ? $branchStock->quantity : 0;

                // Strict invariant: Never permit negative inventory!
                if ($availableStock < $requestedQty) {
                    throw ValidationException::withMessages([
                        'items' => ["Insufficient stock for product '{$product->name}'. Available: {$availableStock}, Requested: {$requestedQty}."]
                    ]);
                }

                $unitPrice = isset($item['unit_price']) && $item['unit_price'] !== null
                    ? (float) $item['unit_price']
                    : (float) ($branchStock->selling_price ?? $product->selling_price);

                $unitCost = $branchStock ? (float) $branchStock->cost_price : (float) $product->cost_price;
                $lineDiscount = (float) ($item['discount_amount'] ?? 0);
                $lineSubtotal = round(($unitPrice * $requestedQty) - $lineDiscount, 2);

                $taxPercent = (float) $product->tax_percent;
                $lineTax = round($lineSubtotal * ($taxPercent / 100), 2);
                $lineTotal = round($lineSubtotal + $lineTax, 2);

                $subtotal += ($unitPrice * $requestedQty);
                $itemsDiscount += $lineDiscount;
                $itemsTax += $lineTax;

                $processedItems[] = [
                    'product' => $product,
                    'branch_stock' => $branchStock,
                    'quantity' => $requestedQty,
                    'unit_cost' => $unitCost,
                    'unit_price' => $unitPrice,
                    'discount_amount' => $lineDiscount,
                    'tax_percent' => $taxPercent,
                    'tax_amount' => $lineTax,
                    'total_amount' => $lineTotal,
                    'batch_id' => $item['product_batch_id'] ?? null,
                ];
            }

            $orderDiscount = (float) ($validated['order_discount'] ?? 0);
            $totalDiscount = round($itemsDiscount + $orderDiscount, 2);
            $totalAmount = max(0, round(($subtotal - $totalDiscount) + $itemsTax, 2));

            $paidAmount = (float) $validated['paid_amount'];
            $balanceDue = max(0, round($totalAmount - $paidAmount, 2));

            // Only registered members may have an outstanding balance due
            if ($balanceDue > 0 && !$member) {
                throw ValidationException::withMessages([
                    'paid_amount' => ['Walk-in customers cannot have an outstanding balance. Full payment is required.']
                ]);
            }

            $paymentStatus = $balanceDue <= 0 ? 'paid' : 'partial';

            $order = PosOrder::create([
                'gym_id' => $gymId,
                'branch_id' => $branchId,
                'order_number' => $orderNumber,
                'member_id' => $member?->id,
                'customer_name' => $member ? $member->full_name : ($validated['customer_name'] ?? 'Walk-in Customer'),
                'customer_phone' => $member ? $member->phone : ($validated['customer_phone'] ?? null),
                'subtotal' => $subtotal,
                'discount_amount' => $totalDiscount,
                'tax_amount' => $itemsTax,
                'total_amount' => $totalAmount,
                'paid_amount' => min($totalAmount, $paidAmount),
                'balance_due' => $balanceDue,
                'payment_method' => $validated['payment_method'],
                'payment_status' => $paymentStatus,
                'status' => 'completed',
                'order_date' => now()->toDateString(),
                'notes' => $validated['notes'] ?? null,
                'billed_by_user_id' => $request->user()->id,
            ]);

            // Deduct stock, record line items, and audit inventory movements
            foreach ($processedItems as $pItem) {
                $branchStock = $pItem['branch_stock'];
                $product = $pItem['product'];
                $qty = $pItem['quantity'];

                $qtyBefore = $branchStock->quantity;
                $qtyAfter = $qtyBefore - $qty;

                // Deduct stock
                $branchStock->update(['quantity' => $qtyAfter]);

                // Deduct from batch if batch specified or available FIFO
                $batchId = $pItem['batch_id'];
                if (!$batchId) {
                    $availableBatch = ProductBatch::where('branch_id', $branchId)
                        ->where('product_id', $product->id)
                        ->where('current_quantity', '>', 0)
                        ->orderBy('expiry_date', 'asc')
                        ->first();
                    if ($availableBatch) {
                        $batchId = $availableBatch->id;
                        $availableBatch->decrement('current_quantity', min($availableBatch->current_quantity, $qty));
                    }
                } else {
                    $batch = ProductBatch::find($batchId);
                    if ($batch) {
                        $batch->decrement('current_quantity', min($batch->current_quantity, $qty));
                    }
                }

                // Create Order Item with unit_cost_at_sale captured
                PosOrderItem::create([
                    'gym_id' => $gymId,
                    'pos_order_id' => $order->id,
                    'product_id' => $product->id,
                    'product_batch_id' => $batchId,
                    'quantity' => $qty,
                    'unit_cost_at_sale' => $pItem['unit_cost'], // Exact COGS capture
                    'unit_price' => $pItem['unit_price'],
                    'discount_amount' => $pItem['discount_amount'],
                    'tax_percent' => $pItem['tax_percent'],
                    'tax_amount' => $pItem['tax_amount'],
                    'total_amount' => $pItem['total_amount'],
                ]);

                // Record permanent stock movement (negative change for sale)
                InventoryMovement::create([
                    'gym_id' => $gymId,
                    'branch_id' => $branchId,
                    'product_id' => $product->id,
                    'product_batch_id' => $batchId,
                    'type' => 'sale',
                    'reference_type' => 'pos_order',
                    'reference_id' => $order->id,
                    'quantity_change' => -$qty,
                    'quantity_before' => $qtyBefore,
                    'quantity_after' => $qtyAfter,
                    'unit_cost' => $pItem['unit_cost'],
                    'total_cost' => round($qty * $pItem['unit_cost'], 2),
                    'notes' => "POS Order #{$orderNumber}",
                    'user_id' => $request->user()->id,
                ]);
            }

            // Sync with member financial ledger if assigned
            if ($member) {
                // Post charge for total order amount
                MemberLedger::create([
                    'gym_id' => $gymId,
                    'branch_id' => $branchId,
                    'member_id' => $member->id,
                    'type' => 'charge',
                    'reference_type' => 'pos_order',
                    'reference_id' => $order->id,
                    'description' => "Store POS Sale: Order #{$orderNumber}",
                    'debit' => $totalAmount,
                    'credit' => 0,
                    'running_balance' => (float) $member->outstanding_balance + $balanceDue,
                    'transaction_date' => $order->order_date,
                    'created_by_user_id' => $request->user()->id,
                ]);

                // Post payment credit if paid amount > 0
                if ($paidAmount > 0) {
                    MemberLedger::create([
                        'gym_id' => $gymId,
                        'branch_id' => $branchId,
                        'member_id' => $member->id,
                        'type' => 'payment',
                        'reference_type' => 'pos_order',
                        'reference_id' => $order->id,
                        'description' => "POS Payment for Order #{$orderNumber} via " . strtoupper($validated['payment_method']),
                        'debit' => 0,
                        'credit' => min($totalAmount, $paidAmount),
                        'running_balance' => (float) $member->outstanding_balance + $balanceDue,
                        'transaction_date' => $order->order_date,
                        'created_by_user_id' => $request->user()->id,
                    ]);
                }

                $member->recalculateBalances();
            }

            AuditLog::record('pos.sale_completed', [
                'order_id' => $order->id,
                'order_number' => $orderNumber,
                'total_amount' => $totalAmount,
                'paid_amount' => $paidAmount,
                'balance_due' => $balanceDue,
                'payment_method' => $order->payment_method,
                'items_count' => count($processedItems),
            ]);

            return $order;
        });

        $order->load(['items.product', 'member:id,first_name,last_name,member_code,phone', 'cashier:id,name', 'branch:id,name,code']);

        return response()->json([
            'message' => 'Sale completed successfully',
            'order' => $order,
        ], 201);
    }

    public function orders(Request $request)
    {
        $branchId = $request->query('branch_id') ?: CurrentBranch::id();

        $query = PosOrder::with([
            'member:id,first_name,last_name,member_code,phone',
            'branch:id,name,code',
            'cashier:id,name',
            'items.product:id,name,brand,sku,barcode',
            'refunds',
        ]);

        if ($branchId) {
            $query->where('branch_id', $branchId);
        }

        if ($request->filled('member_id')) {
            $query->where('member_id', $request->query('member_id'));
        }

        if ($request->filled('status')) {
            $query->where('status', $request->query('status'));
        }

        if ($request->filled('payment_status')) {
            $query->where('payment_status', $request->query('payment_status'));
        }

        if ($request->filled('payment_method')) {
            $query->where('payment_method', $request->query('payment_method'));
        }

        if ($request->filled('from')) {
            $query->whereDate('order_date', '>=', $request->query('from'));
        }

        if ($request->filled('to')) {
            $query->whereDate('order_date', '<=', $request->query('to'));
        }

        if ($request->filled('search')) {
            $search = $request->query('search');
            $query->where(function ($q) use ($search) {
                $q->where('order_number', 'like', "%{$search}%")
                    ->orWhere('customer_name', 'like', "%{$search}%")
                    ->orWhere('customer_phone', 'like', "%{$search}%");
            });
        }

        $perPage = (int) $request->query('per_page', 20);
        $orders = $query->latest('order_date')->latest('id')->paginate($perPage);

        $totalSales = (clone $query)->where('status', '!=', 'cancelled')->sum('total_amount');
        $totalCollected = (clone $query)->where('status', '!=', 'cancelled')->sum('paid_amount');
        $totalDues = (clone $query)->where('status', '!=', 'cancelled')->sum('balance_due');

        return response()->json([
            'orders' => $orders,
            'summary' => [
                'total_orders' => $orders->total(),
                'total_sales' => round($totalSales, 2),
                'total_collected' => round($totalCollected, 2),
                'total_dues' => round($totalDues, 2),
            ]
        ]);
    }

    public function show($id)
    {
        $order = PosOrder::with([
            'member',
            'branch:id,name,code',
            'cashier:id,name',
            'items.product',
            'refunds.refunder:id,name',
        ])->findOrFail($id);

        return response()->json([
            'order' => $order,
        ]);
    }

    public function refund(Request $request, $id)
    {
        $order = PosOrder::with('items')->findOrFail($id);

        if ($order->status === 'refunded') {
            return response()->json(['message' => 'Order is already refunded'], 422);
        }

        $validated = $request->validate([
            'amount' => 'required|numeric|min:0.01|max:' . $order->paid_amount,
            'payment_mode' => 'required|string|in:cash,upi,bank_transfer,card',
            'reason' => 'required|string|max:255',
            'restock_items' => 'nullable|boolean',
        ]);

        $gymId = CurrentGym::require();
        $restockItems = $validated['restock_items'] ?? true;

        $refund = DB::transaction(function () use ($gymId, $order, $validated, $restockItems, $request) {
            $refundCount = PosRefund::where('gym_id', $gymId)->count();
            $refundNumber = 'REF-' . date('Y') . '-' . str_pad((string) ($refundCount + 1), 5, '0', STR_PAD_LEFT);

            $refund = PosRefund::create([
                'gym_id' => $gymId,
                'branch_id' => $order->branch_id,
                'pos_order_id' => $order->id,
                'refund_number' => $refundNumber,
                'amount' => $validated['amount'],
                'payment_mode' => $validated['payment_mode'],
                'refund_date' => now()->toDateString(),
                'reason' => $validated['reason'],
                'restock_items' => $restockItems,
                'refunded_by_user_id' => $request->user()->id,
            ]);

            // Restock items back to branch inventory
            if ($restockItems) {
                foreach ($order->items as $item) {
                    $branchStock = ProductBranchStock::where('branch_id', $order->branch_id)
                        ->where('product_id', $item->product_id)
                        ->first();

                    if ($branchStock) {
                        $qtyBefore = $branchStock->quantity;
                        $branchStock->increment('quantity', $item->quantity);

                        // Record permanent stock movement
                        InventoryMovement::create([
                            'gym_id' => $gymId,
                            'branch_id' => $order->branch_id,
                            'product_id' => $item->product_id,
                            'product_batch_id' => $item->product_batch_id,
                            'type' => 'customer_return',
                            'reference_type' => 'pos_refund',
                            'reference_id' => $refund->id,
                            'quantity_change' => $item->quantity,
                            'quantity_before' => $qtyBefore,
                            'quantity_after' => $qtyBefore + $item->quantity,
                            'unit_cost' => $item->unit_cost_at_sale,
                            'total_cost' => round($item->quantity * (float) $item->unit_cost_at_sale, 2),
                            'notes' => "Customer return & restock from POS Order #{$order->order_number}",
                            'user_id' => $request->user()->id,
                        ]);
                    }
                }
            }

            // Sync with member financial ledger if member order
            if ($order->member_id) {
                $member = Member::find($order->member_id);
                if ($member) {
                    MemberLedger::create([
                        'gym_id' => $gymId,
                        'branch_id' => $order->branch_id,
                        'member_id' => $member->id,
                        'type' => 'refund',
                        'reference_type' => 'pos_refund',
                        'reference_id' => $refund->id,
                        'description' => "POS Return Refund #{$refundNumber} for Order #{$order->order_number}",
                        'debit' => 0,
                        'credit' => $validated['amount'],
                        'running_balance' => (float) $member->outstanding_balance,
                        'transaction_date' => now()->toDateString(),
                        'created_by_user_id' => $request->user()->id,
                    ]);

                    $member->recalculateBalances();
                }
            }

            $order->update([
                'status' => 'refunded',
                'payment_status' => 'refunded',
            ]);

            AuditLog::record('pos.refund_issued', [
                'order_id' => $order->id,
                'refund_id' => $refund->id,
                'refund_number' => $refundNumber,
                'amount' => $refund->amount,
                'restock_items' => $restockItems,
            ]);

            return $refund;
        });

        return response()->json([
            'message' => 'Refund processed successfully',
            'refund' => $refund,
            'order' => $order->fresh(),
        ]);
    }
}
