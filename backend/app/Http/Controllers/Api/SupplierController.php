<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Supplier;
use App\Models\SupplierLedger;
use App\Models\SupplierPayment;
use App\Support\CurrentBranch;
use App\Support\CurrentGym;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SupplierController extends Controller
{
    public function index(Request $request)
    {
        $query = Supplier::query();

        if ($request->filled('search')) {
            $search = $request->query('search');
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('company_name', 'like', "%{$search}%")
                    ->orWhere('contact_person', 'like', "%{$search}%")
                    ->orWhere('phone', 'like', "%{$search}%")
                    ->orWhere('gstin', 'like', "%{$search}%");
            });
        }

        if ($request->filled('is_active')) {
            $query->where('is_active', filter_var($request->query('is_active'), FILTER_VALIDATE_BOOLEAN));
        }

        $perPage = (int) $request->query('per_page', 20);
        $suppliers = $query->latest('id')->paginate($perPage);

        $totalPurchases = (float) Supplier::sum('total_purchased');
        $totalPaid = (float) Supplier::sum('total_paid');
        $totalOutstanding = (float) Supplier::sum('outstanding_balance');

        return response()->json([
            'suppliers' => $suppliers,
            'summary' => [
                'total_suppliers' => Supplier::count(),
                'total_purchased' => round($totalPurchases, 2),
                'total_paid' => round($totalPaid, 2),
                'total_outstanding' => round($totalOutstanding, 2),
            ]
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:150',
            'company_name' => 'nullable|string|max:150',
            'contact_person' => 'nullable|string|max:100',
            'phone' => 'required|string|max:30',
            'email' => 'nullable|email|max:150',
            'gstin' => 'nullable|string|max:30',
            'address' => 'nullable|string',
            'city' => 'nullable|string|max:80',
            'bank_details' => 'nullable|string',
            'notes' => 'nullable|string',
            'is_active' => 'nullable|boolean',
        ]);

        $supplier = Supplier::create([
            'gym_id' => CurrentGym::require(),
            'name' => $validated['name'],
            'company_name' => $validated['company_name'] ?? null,
            'contact_person' => $validated['contact_person'] ?? null,
            'phone' => $validated['phone'],
            'email' => $validated['email'] ?? null,
            'gstin' => $validated['gstin'] ?? null,
            'address' => $validated['address'] ?? null,
            'city' => $validated['city'] ?? null,
            'bank_details' => $validated['bank_details'] ?? null,
            'notes' => $validated['notes'] ?? null,
            'is_active' => $validated['is_active'] ?? true,
            'total_purchased' => 0,
            'total_paid' => 0,
            'outstanding_balance' => 0,
        ]);

        AuditLog::record('supplier.created', [
            'supplier_id' => $supplier->id,
            'name' => $supplier->name,
            'phone' => $supplier->phone,
        ]);

        return response()->json([
            'message' => 'Supplier created successfully',
            'supplier' => $supplier,
        ], 201);
    }

    public function show($id)
    {
        $supplier = Supplier::with([
            'purchases' => function ($q) {
                $q->latest('invoice_date')->limit(15);
            },
            'payments' => function ($q) {
                $q->latest('payment_date')->limit(15);
            },
            'ledgers' => function ($q) {
                $q->latest('transaction_date')->latest('id')->limit(30);
            }
        ])->findOrFail($id);

        return response()->json([
            'supplier' => $supplier,
        ]);
    }

    public function update(Request $request, $id)
    {
        $supplier = Supplier::findOrFail($id);

        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:150',
            'company_name' => 'nullable|string|max:150',
            'contact_person' => 'nullable|string|max:100',
            'phone' => 'sometimes|required|string|max:30',
            'email' => 'nullable|email|max:150',
            'gstin' => 'nullable|string|max:30',
            'address' => 'nullable|string',
            'city' => 'nullable|string|max:80',
            'bank_details' => 'nullable|string',
            'notes' => 'nullable|string',
            'is_active' => 'nullable|boolean',
        ]);

        $supplier->update($validated);

        AuditLog::record('supplier.updated', [
            'supplier_id' => $supplier->id,
            'name' => $supplier->name,
        ]);

        return response()->json([
            'message' => 'Supplier updated successfully',
            'supplier' => $supplier,
        ]);
    }

    public function destroy($id)
    {
        $supplier = Supplier::findOrFail($id);
        $supplier->delete();

        AuditLog::record('supplier.deleted', [
            'supplier_id' => $id,
            'name' => $supplier->name,
        ]);

        return response()->json([
            'message' => 'Supplier deleted successfully',
        ]);
    }

    public function ledger(Request $request, $id)
    {
        $supplier = Supplier::findOrFail($id);

        $query = $supplier->ledgers()->with(['branch:id,name', 'creator:id,name']);

        if ($request->filled('from')) {
            $query->whereDate('transaction_date', '>=', $request->query('from'));
        }

        if ($request->filled('to')) {
            $query->whereDate('transaction_date', '<=', $request->query('to'));
        }

        $perPage = (int) $request->query('per_page', 25);
        $ledgers = $query->latest('transaction_date')->latest('id')->paginate($perPage);

        return response()->json([
            'supplier' => $supplier,
            'ledgers' => $ledgers,
        ]);
    }

    public function recordPayment(Request $request, $id)
    {
        $supplier = Supplier::findOrFail($id);

        $validated = $request->validate([
            'branch_id' => 'nullable|exists:branches,id',
            'amount' => 'required|numeric|min:1',
            'payment_mode' => 'required|string|in:cash,upi,bank_transfer,card,cheque',
            'payment_date' => 'nullable|date',
            'reference_id' => 'nullable|string|max:100',
            'notes' => 'nullable|string',
        ]);

        $branchId = $validated['branch_id'] ?? CurrentBranch::id();
        $gymId = CurrentGym::require();

        $payment = DB::transaction(function () use ($supplier, $validated, $branchId, $gymId, $request) {
            $paymentCount = SupplierPayment::where('gym_id', $gymId)->count();
            $paymentNumber = 'SPAY-' . date('Y') . '-' . str_pad((string) ($paymentCount + 1), 5, '0', STR_PAD_LEFT);

            $payment = SupplierPayment::create([
                'gym_id' => $gymId,
                'branch_id' => $branchId,
                'supplier_id' => $supplier->id,
                'payment_number' => $paymentNumber,
                'amount' => $validated['amount'],
                'payment_mode' => $validated['payment_mode'],
                'payment_date' => $validated['payment_date'] ?? now()->toDateString(),
                'reference_id' => $validated['reference_id'] ?? null,
                'notes' => $validated['notes'] ?? null,
                'paid_by_user_id' => $request->user()->id,
            ]);

            // Supplier ledger: Credit reduces what the gym owes the supplier
            $newBalance = max(0, (float) $supplier->outstanding_balance - (float) $validated['amount']);

            SupplierLedger::create([
                'gym_id' => $gymId,
                'supplier_id' => $supplier->id,
                'branch_id' => $branchId,
                'transaction_type' => 'payment',
                'reference_id' => $payment->id,
                'reference_number' => $paymentNumber,
                'debit' => 0,
                'credit' => $validated['amount'],
                'running_balance' => $newBalance,
                'transaction_date' => $payment->payment_date,
                'notes' => "Payment via " . strtoupper($validated['payment_mode']) . ($validated['reference_id'] ? " (Ref: {$validated['reference_id']})" : ''),
                'created_by_user_id' => $request->user()->id,
            ]);

            $supplier->recalculateBalances();

            AuditLog::record('supplier.payment_recorded', [
                'supplier_id' => $supplier->id,
                'payment_number' => $paymentNumber,
                'amount' => $payment->amount,
                'payment_mode' => $payment->payment_mode,
            ]);

            return $payment;
        });

        return response()->json([
            'message' => 'Supplier payment recorded successfully',
            'payment' => $payment,
            'supplier' => $supplier->fresh(),
        ], 201);
    }
}
