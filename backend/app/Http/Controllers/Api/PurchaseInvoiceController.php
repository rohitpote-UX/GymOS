<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\InventoryMovement;
use App\Models\Product;
use App\Models\ProductBatch;
use App\Models\ProductBranchStock;
use App\Models\PurchaseInvoice;
use App\Models\PurchaseInvoiceItem;
use App\Models\Supplier;
use App\Models\SupplierLedger;
use App\Models\SupplierPayment;
use App\Support\CurrentBranch;
use App\Support\CurrentGym;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PurchaseInvoiceController extends Controller
{
    public function index(Request $request)
    {
        $branchId = $request->query('branch_id') ?: CurrentBranch::id();

        $query = PurchaseInvoice::with([
            'supplier:id,name,company_name,phone',
            'branch:id,name,code',
            'receiver:id,name',
            'items.product:id,name,brand,sku,barcode',
        ]);

        if ($branchId) {
            $query->where('branch_id', $branchId);
        }

        if ($request->filled('supplier_id')) {
            $query->where('supplier_id', $request->query('supplier_id'));
        }

        if ($request->filled('payment_status')) {
            $query->where('payment_status', $request->query('payment_status'));
        }

        if ($request->filled('status')) {
            $query->where('status', $request->query('status'));
        }

        if ($request->filled('from')) {
            $query->whereDate('invoice_date', '>=', $request->query('from'));
        }

        if ($request->filled('to')) {
            $query->whereDate('invoice_date', '<=', $request->query('to'));
        }

        if ($request->filled('search')) {
            $search = $request->query('search');
            $query->where('invoice_number', 'like', "%{$search}%");
        }

        $perPage = (int) $request->query('per_page', 20);
        $invoices = $query->latest('invoice_date')->latest('id')->paginate($perPage);

        $totalAmount = (clone $query)->sum('total_amount');
        $totalPaid = (clone $query)->sum('paid_amount');
        $totalUnpaid = max(0, $totalAmount - $totalPaid);

        return response()->json([
            'invoices' => $invoices,
            'summary' => [
                'total_invoices' => $invoices->total(),
                'total_amount' => round($totalAmount, 2),
                'total_paid' => round($totalPaid, 2),
                'total_unpaid' => round($totalUnpaid, 2),
            ]
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'branch_id' => 'nullable|exists:branches,id',
            'supplier_id' => 'required|exists:suppliers,id',
            'invoice_number' => 'nullable|string|max:80',
            'invoice_date' => 'nullable|date',
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|exists:products,id',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.unit_cost' => 'required|numeric|min:0',
            'items.*.tax_percent' => 'nullable|numeric|min:0|max:100',
            'items.*.batch_number' => 'nullable|string|max:80',
            'items.*.manufacturing_date' => 'nullable|date',
            'items.*.expiry_date' => 'nullable|date',
            'items.*.selling_price' => 'nullable|numeric|min:0',
            'tax_amount' => 'nullable|numeric|min:0',
            'discount_amount' => 'nullable|numeric|min:0',
            'paid_amount' => 'nullable|numeric|min:0',
            'payment_mode' => 'nullable|string|in:cash,upi,bank_transfer,card,cheque',
            'notes' => 'nullable|string',
        ]);

        $gymId = CurrentGym::require();
        $branchId = $validated['branch_id'] ?? CurrentBranch::require();
        $supplier = Supplier::findOrFail($validated['supplier_id']);

        $invoice = DB::transaction(function () use ($gymId, $branchId, $supplier, $validated, $request) {
            $invoiceNumber = $validated['invoice_number'] ?? null;
            if (!$invoiceNumber) {
                $count = PurchaseInvoice::where('gym_id', $gymId)->count();
                $invoiceNumber = 'PUR-' . date('Y') . '-' . str_pad((string) ($count + 1), 5, '0', STR_PAD_LEFT);
            }

            $subtotal = 0;
            $itemsData = [];

            foreach ($validated['items'] as $item) {
                $qty = (int) $item['quantity'];
                $unitCost = (float) $item['unit_cost'];
                $itemSubtotal = round($qty * $unitCost, 2);
                $taxPct = (float) ($item['tax_percent'] ?? 0);
                $taxAmt = round($itemSubtotal * ($taxPct / 100), 2);
                $totalAmt = round($itemSubtotal + $taxAmt, 2);

                $subtotal += $itemSubtotal;

                $itemsData[] = [
                    'product_id' => $item['product_id'],
                    'quantity' => $qty,
                    'unit_cost' => $unitCost,
                    'tax_percent' => $taxPct,
                    'tax_amount' => $taxAmt,
                    'total_amount' => $totalAmt,
                    'subtotal' => $itemSubtotal,
                    'batch_number' => $item['batch_number'] ?? null,
                    'manufacturing_date' => $item['manufacturing_date'] ?? null,
                    'expiry_date' => $item['expiry_date'] ?? null,
                    'selling_price' => $item['selling_price'] ?? null,
                ];
            }

            $discountAmount = (float) ($validated['discount_amount'] ?? 0);
            $taxAmount = (float) ($validated['tax_amount'] ?? array_sum(array_column($itemsData, 'tax_amount')));
            $totalAmount = max(0, round($subtotal + $taxAmount - $discountAmount, 2));
            $paidAmount = min($totalAmount, (float) ($validated['paid_amount'] ?? 0));

            $paymentStatus = 'unpaid';
            if ($paidAmount >= $totalAmount && $totalAmount > 0) {
                $paymentStatus = 'paid';
            } elseif ($paidAmount > 0) {
                $paymentStatus = 'partial';
            }

            $invoice = PurchaseInvoice::create([
                'gym_id' => $gymId,
                'branch_id' => $branchId,
                'supplier_id' => $supplier->id,
                'invoice_number' => $invoiceNumber,
                'invoice_date' => $validated['invoice_date'] ?? now()->toDateString(),
                'subtotal' => $subtotal,
                'tax_amount' => $taxAmount,
                'discount_amount' => $discountAmount,
                'total_amount' => $totalAmount,
                'paid_amount' => $paidAmount,
                'status' => 'received',
                'payment_status' => $paymentStatus,
                'notes' => $validated['notes'] ?? null,
                'received_by_user_id' => $request->user()->id,
            ]);

            // Process each item and apply Weighted Average Cost (WAC)
            foreach ($itemsData as $item) {
                $product = Product::findOrFail($item['product_id']);

                PurchaseInvoiceItem::create([
                    'gym_id' => $gymId,
                    'purchase_invoice_id' => $invoice->id,
                    'product_id' => $item['product_id'],
                    'batch_number' => $item['batch_number'],
                    'manufacturing_date' => $item['manufacturing_date'],
                    'expiry_date' => $item['expiry_date'],
                    'quantity' => $item['quantity'],
                    'unit_cost' => $item['unit_cost'],
                    'subtotal' => $item['subtotal'],
                    'tax_percent' => $item['tax_percent'],
                    'tax_amount' => $item['tax_amount'],
                    'total_amount' => $item['total_amount'],
                ]);

                // Pessimistic lock or create branch stock record
                $branchStock = ProductBranchStock::where('branch_id', $branchId)
                    ->where('product_id', $product->id)
                    ->lockForUpdate()
                    ->first();

                $oldQty = $branchStock ? $branchStock->quantity : 0;
                $oldCost = $branchStock ? (float) $branchStock->cost_price : (float) $product->cost_price;
                $newQty = $item['quantity'];
                $newCost = $item['unit_cost'];

                // Weighted Average Cost calculation:
                // new_cost = ((oldQty * oldCost) + (newQty * newCost)) / (oldQty + newQty)
                $combinedQty = $oldQty + $newQty;
                if ($combinedQty > 0) {
                    $wac = round((($oldQty * $oldCost) + ($newQty * $newCost)) / $combinedQty, 2);
                } else {
                    $wac = $newCost;
                }

                if (!$branchStock) {
                    $branchStock = ProductBranchStock::create([
                        'gym_id' => $gymId,
                        'branch_id' => $branchId,
                        'product_id' => $product->id,
                        'quantity' => $newQty,
                        'cost_price' => $wac,
                        'selling_price' => $item['selling_price'] ?? $product->selling_price,
                    ]);
                } else {
                    $branchStock->update([
                        'quantity' => $combinedQty,
                        'cost_price' => $wac,
                        'selling_price' => $item['selling_price'] ?? $branchStock->selling_price,
                    ]);
                }

                // Update product global WAC cost_price
                $product->update([
                    'cost_price' => $wac,
                    'selling_price' => $item['selling_price'] ?? $product->selling_price,
                ]);

                // Batch handling
                $batchId = null;
                if (!empty($item['batch_number'])) {
                    $batch = ProductBatch::firstOrCreate(
                        [
                            'gym_id' => $gymId,
                            'branch_id' => $branchId,
                            'product_id' => $product->id,
                            'batch_number' => $item['batch_number'],
                        ],
                        [
                            'supplier_id' => $supplier->id,
                            'manufacturing_date' => $item['manufacturing_date'],
                            'expiry_date' => $item['expiry_date'],
                            'cost_price' => $newCost,
                            'selling_price' => $item['selling_price'] ?? $product->selling_price,
                            'initial_quantity' => 0,
                            'current_quantity' => 0,
                        ]
                    );

                    $batch->increment('initial_quantity', $newQty);
                    $batch->increment('current_quantity', $newQty);
                    $batchId = $batch->id;
                }

                // Record Inventory Movement (Audit trail)
                InventoryMovement::create([
                    'gym_id' => $gymId,
                    'branch_id' => $branchId,
                    'product_id' => $product->id,
                    'product_batch_id' => $batchId,
                    'type' => 'purchase',
                    'reference_type' => 'purchase_invoice',
                    'reference_id' => $invoice->id,
                    'quantity_change' => $newQty,
                    'quantity_before' => $oldQty,
                    'quantity_after' => $combinedQty,
                    'unit_cost' => $newCost,
                    'total_cost' => round($newQty * $newCost, 2),
                    'notes' => "Stock purchase: Invoice #{$invoiceNumber} from {$supplier->name}",
                    'user_id' => $request->user()->id,
                ]);
            }

            // Record debit in supplier ledger (Gym owes supplier)
            SupplierLedger::create([
                'gym_id' => $gymId,
                'supplier_id' => $supplier->id,
                'branch_id' => $branchId,
                'transaction_type' => 'purchase_invoice',
                'reference_id' => $invoice->id,
                'reference_number' => $invoiceNumber,
                'debit' => $totalAmount,
                'credit' => 0,
                'running_balance' => (float) $supplier->outstanding_balance + $totalAmount,
                'transaction_date' => $invoice->invoice_date,
                'notes' => "Purchase Invoice #{$invoiceNumber}",
                'created_by_user_id' => $request->user()->id,
            ]);

            // If an upfront payment was made
            if ($paidAmount > 0) {
                $paymentCount = SupplierPayment::where('gym_id', $gymId)->count();
                $paymentNumber = 'SPAY-' . date('Y') . '-' . str_pad((string) ($paymentCount + 1), 5, '0', STR_PAD_LEFT);

                $payment = SupplierPayment::create([
                    'gym_id' => $gymId,
                    'branch_id' => $branchId,
                    'supplier_id' => $supplier->id,
                    'payment_number' => $paymentNumber,
                    'amount' => $paidAmount,
                    'payment_mode' => $validated['payment_mode'] ?? 'bank_transfer',
                    'payment_date' => $invoice->invoice_date,
                    'reference_id' => $invoiceNumber,
                    'notes' => "Payment towards Invoice #{$invoiceNumber}",
                    'paid_by_user_id' => $request->user()->id,
                ]);

                SupplierLedger::create([
                    'gym_id' => $gymId,
                    'supplier_id' => $supplier->id,
                    'branch_id' => $branchId,
                    'transaction_type' => 'payment',
                    'reference_id' => $payment->id,
                    'reference_number' => $paymentNumber,
                    'debit' => 0,
                    'credit' => $paidAmount,
                    'running_balance' => max(0, (float) $supplier->outstanding_balance + $totalAmount - $paidAmount),
                    'transaction_date' => $invoice->invoice_date,
                    'notes' => "Payment for Invoice #{$invoiceNumber}",
                    'created_by_user_id' => $request->user()->id,
                ]);
            }

            $supplier->recalculateBalances();

            AuditLog::record('purchase_invoice.created', [
                'invoice_id' => $invoice->id,
                'invoice_number' => $invoiceNumber,
                'supplier_id' => $supplier->id,
                'total_amount' => $totalAmount,
                'items_count' => count($itemsData),
            ]);

            return $invoice;
        });

        $invoice->load(['items.product', 'supplier', 'branch']);

        return response()->json([
            'message' => 'Purchase invoice recorded and stock updated successfully',
            'invoice' => $invoice,
        ], 201);
    }

    public function show($id)
    {
        $invoice = PurchaseInvoice::with([
            'supplier',
            'branch:id,name,code',
            'receiver:id,name',
            'items.product',
        ])->findOrFail($id);

        return response()->json([
            'invoice' => $invoice,
        ]);
    }
}
