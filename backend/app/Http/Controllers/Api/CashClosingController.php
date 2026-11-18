<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\DailyCashClosing;
use App\Models\Expense;
use App\Models\Payment;
use App\Support\CurrentBranch;
use App\Support\CurrentGym;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CashClosingController extends Controller
{
    /**
     * Get or calculate today's cash register status for the active branch.
     */
    public function current(Request $request)
    {
        $branchId = $request->query('branch_id') ?: CurrentBranch::id();
        if (!$branchId) {
            return response()->json(['message' => 'Branch context required.'], 422);
        }

        $date = $request->query('date', now()->toDateString());

        // Check if closing record already exists for this branch & date
        $closing = DailyCashClosing::where('branch_id', $branchId)
            ->where('closing_date', $date)
            ->with(['openedBy:id,name', 'closedBy:id,name', 'branch:id,name'])
            ->first();

        // Calculate live payment collections for the day
        $collections = Payment::where('branch_id', $branchId)
            ->whereDate('payment_date', $date)
            ->where('status', 'completed')
            ->selectRaw('payment_method, sum(amount) as total')
            ->groupBy('payment_method')
            ->pluck('total', 'payment_method');

        $cashCollected = (float) ($collections['cash'] ?? 0);
        $upiCollected = (float) ($collections['upi'] ?? 0);
        $cardCollected = (float) ($collections['card'] ?? 0);
        $bankCollected = (float) ($collections['bank_transfer'] ?? 0);

        // Calculate cash expenses for the day
        $cashExpenses = (float) Expense::where('branch_id', $branchId)
            ->whereDate('expense_date', $date)
            ->where('payment_mode', 'cash')
            ->sum('amount');

        // Opening cash from yesterday or default
        $openingCash = $closing ? (float) $closing->opening_cash : 0;
        if (!$closing) {
            $prev = DailyCashClosing::where('branch_id', $branchId)
                ->where('closing_date', '<', $date)
                ->orderByDesc('closing_date')
                ->first();
            $openingCash = $prev ? (float) $prev->actual_cash_in_hand : 0;
        }

        $expectedCash = $openingCash + $cashCollected - $cashExpenses;

        return response()->json([
            'closing' => $closing,
            'summary' => [
                'branch_id' => $branchId,
                'closing_date' => $date,
                'opening_cash' => $openingCash,
                'cash_collected' => $cashCollected,
                'cash_expenses' => $cashExpenses,
                'expected_cash_in_hand' => $expectedCash,
                'total_upi_collected' => $upiCollected,
                'total_card_collected' => $cardCollected,
                'total_bank_transfer_collected' => $bankCollected,
                'total_collections' => $cashCollected + $upiCollected + $cardCollected + $bankCollected,
            ],
        ]);
    }

    /**
     * Submit / Close the Daily Cash Register.
     */
    public function close(Request $request)
    {
        $validated = $request->validate([
            'branch_id' => ['nullable', 'exists:branches,id'],
            'closing_date' => ['nullable', 'date'],
            'opening_cash' => ['required', 'numeric', 'min:0'],
            'actual_cash_in_hand' => ['required', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string'],
        ]);

        $branchId = $validated['branch_id'] ?? CurrentBranch::id();
        $date = $validated['closing_date'] ?? now()->toDateString();
        $userId = $request->user()->id;

        return DB::transaction(function () use ($validated, $branchId, $date, $userId) {
            // Live collections calculation
            $collections = Payment::where('branch_id', $branchId)
                ->whereDate('payment_date', $date)
                ->where('status', 'completed')
                ->selectRaw('payment_method, sum(amount) as total')
                ->groupBy('payment_method')
                ->pluck('total', 'payment_method');

            $cashCollected = (float) ($collections['cash'] ?? 0);
            $upiCollected = (float) ($collections['upi'] ?? 0);
            $cardCollected = (float) ($collections['card'] ?? 0);
            $bankCollected = (float) ($collections['bank_transfer'] ?? 0);

            $cashExpenses = (float) Expense::where('branch_id', $branchId)
                ->whereDate('expense_date', $date)
                ->where('payment_mode', 'cash')
                ->sum('amount');

            $openingCash = (float) $validated['opening_cash'];
            $actualCash = (float) $validated['actual_cash_in_hand'];
            $expectedCash = $openingCash + $cashCollected - $cashExpenses;
            $discrepancy = $actualCash - $expectedCash;

            $closing = DailyCashClosing::updateOrCreate(
                [
                    'gym_id' => CurrentGym::require(),
                    'branch_id' => $branchId,
                    'closing_date' => $date,
                ],
                [
                    'opened_by_user_id' => $userId,
                    'closed_by_user_id' => $userId,
                    'opening_cash' => $openingCash,
                    'cash_collected' => $cashCollected,
                    'cash_expenses' => $cashExpenses,
                    'expected_cash_in_hand' => $expectedCash,
                    'actual_cash_in_hand' => $actualCash,
                    'cash_discrepancy' => $discrepancy,
                    'total_upi_collected' => $upiCollected,
                    'total_card_collected' => $cardCollected,
                    'total_bank_transfer_collected' => $bankCollected,
                    'status' => 'closed',
                    'notes' => $validated['notes'] ?? null,
                    'closed_at' => now(),
                ]
            );

            AuditLog::record('cash_register.closed', [
                'closing_id' => $closing->id,
                'closing_date' => $date,
                'actual_cash' => $actualCash,
                'discrepancy' => $discrepancy,
            ], $branchId);

            return response()->json([
                'message' => 'Daily cash register successfully closed.',
                'closing' => $closing->load(['openedBy', 'closedBy', 'branch']),
            ]);
        });
    }

    /**
     * History of past cash closings.
     */
    public function history(Request $request)
    {
        $branchId = $request->query('branch_id') ?: CurrentBranch::id();

        $query = DailyCashClosing::with(['openedBy:id,name', 'closedBy:id,name', 'branch:id,name']);
        if ($branchId) {
            $query->where('branch_id', $branchId);
        }

        $closings = $query->orderByDesc('closing_date')->paginate(15);

        return response()->json($closings);
    }
}
