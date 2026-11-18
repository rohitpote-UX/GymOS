<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Expense;
use App\Support\CurrentBranch;
use App\Support\CurrentGym;
use Illuminate\Http\Request;

class ExpenseController extends Controller
{
    public function index(Request $request)
    {
        $query = Expense::with(['branch:id,name,code', 'recorder:id,name']);

        $branchId = $request->query('branch_id') ?: CurrentBranch::id();
        if ($branchId) {
            $query->where('branch_id', $branchId);
        }

        if ($request->filled('category')) {
            $query->where('category', $request->input('category'));
        }

        if ($request->filled('payment_mode')) {
            $query->where('payment_mode', $request->input('payment_mode'));
        }

        if ($request->filled('from')) {
            $query->whereDate('expense_date', '>=', $request->input('from'));
        }

        if ($request->filled('to')) {
            $query->whereDate('expense_date', '<=', $request->input('to'));
        }

        $expenses = $query->latest('expense_date')->latest('id')->paginate($request->input('per_page', 25));

        // Category summary breakdown
        $categorySummary = (clone $query)
            ->selectRaw('category, sum(amount) as total')
            ->groupBy('category')
            ->pluck('total', 'category');

        $totalAmount = (clone $query)->sum('amount');

        return response()->json([
            'expenses' => $expenses,
            'summary' => [
                'total_amount' => (float) $totalAmount,
                'by_category' => $categorySummary,
            ],
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'category' => ['required', 'in:rent,salaries,electricity,maintenance,marketing,cleaning,equipment,other'],
            'title' => ['required', 'string', 'max:150'],
            'amount' => ['required', 'numeric', 'min:0.01'],
            'payment_mode' => ['required', 'in:cash,upi,bank_transfer,card,cheque'],
            'expense_date' => ['nullable', 'date'],
            'vendor_name' => ['nullable', 'string', 'max:120'],
            'bill_number' => ['nullable', 'string', 'max:60'],
            'notes' => ['nullable', 'string'],
            'branch_id' => ['nullable', 'exists:branches,id'],
        ]);

        $branchId = $validated['branch_id'] ?? CurrentBranch::id();
        if (!$branchId) {
            return response()->json(['message' => 'Branch context is required for expense entry.'], 422);
        }

        $expense = Expense::create([
            'gym_id' => CurrentGym::require(),
            'branch_id' => $branchId,
            'category' => $validated['category'],
            'title' => $validated['title'],
            'amount' => $validated['amount'],
            'payment_mode' => $validated['payment_mode'],
            'expense_date' => $validated['expense_date'] ?? now()->toDateString(),
            'vendor_name' => $validated['vendor_name'] ?? null,
            'bill_number' => $validated['bill_number'] ?? null,
            'notes' => $validated['notes'] ?? null,
            'recorded_by_user_id' => $request->user()->id,
        ]);

        AuditLog::record('expense.created', [
            'expense_id' => $expense->id,
            'category' => $expense->category,
            'amount' => $expense->amount,
        ], $branchId);

        return response()->json($expense->load(['branch', 'recorder']), 201);
    }

    public function show(int $id)
    {
        $expense = Expense::with(['branch', 'recorder'])->findOrFail($id);

        return response()->json($expense);
    }

    public function destroy(int $id)
    {
        $expense = Expense::findOrFail($id);
        $expense->delete();

        AuditLog::record('expense.deleted', [
            'expense_id' => $expense->id,
            'amount' => $expense->amount,
        ], $expense->branch_id);

        return response()->json(['message' => 'Expense deleted successfully.']);
    }
}
