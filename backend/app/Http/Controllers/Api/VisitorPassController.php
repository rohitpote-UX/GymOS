<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Branch;
use App\Models\VisitorPass;
use App\Services\VisitorPassService;
use App\Support\CurrentBranch;
use App\Support\CurrentGym;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class VisitorPassController extends Controller
{
    protected VisitorPassService $visitorPassService;

    public function __construct(VisitorPassService $visitorPassService)
    {
        $this->visitorPassService = $visitorPassService;
    }

    /**
     * List visitor passes for gym with filters
     */
    public function index(Request $request): JsonResponse
    {
        $gymId = CurrentGym::require();
        $branchId = CurrentBranch::get();

        $query = VisitorPass::with(['branch:id,name,code', 'attendanceLog:id,check_in_at,method', 'creator:id,name'])
            ->where('gym_id', $gymId);

        if ($branchId) {
            $query->where('branch_id', $branchId);
        }

        // Filter by date range
        $timeframe = $request->query('timeframe', 'today');
        if ($timeframe === 'today') {
            $query->whereDate('valid_on', now()->toDateString());
        } elseif ($timeframe === 'this_week') {
            $query->whereBetween('valid_on', [now()->startOfWeek(), now()->endOfWeek()]);
        } elseif ($timeframe === 'this_month') {
            $query->whereBetween('valid_on', [now()->startOfMonth(), now()->endOfMonth()]);
        }

        // Filter by payment status
        if ($request->filled('status') && $request->query('status') !== 'all') {
            $query->where('payment_status', $request->query('status'));
        }

        // Search by visitor name, phone, or pass code
        if ($request->filled('search')) {
            $search = trim($request->query('search'));
            $query->where(function ($q) use ($search) {
                $q->where('full_name', 'like', "%{$search}%")
                  ->orWhere('phone', 'like', "%{$search}%")
                  ->orWhere('pass_code', 'like', "%{$search}%");
            });
        }

        $passes = $query->latest('id')->paginate((int) $request->query('per_page', 25));

        // Quick aggregate statistics for dashboard badges
        $todayQuery = VisitorPass::where('gym_id', $gymId)->whereDate('valid_on', now()->toDateString());
        if ($branchId) {
            $todayQuery->where('branch_id', $branchId);
        }

        $stats = [
            'today_passes_count' => (clone $todayQuery)->where('payment_status', 'paid')->count(),
            'today_revenue' => (float) (clone $todayQuery)->where('payment_status', 'paid')->sum('total_amount'),
            'today_pending' => (clone $todayQuery)->where('payment_status', 'pending')->count(),
            'month_passes_count' => VisitorPass::where('gym_id', $gymId)
                ->when($branchId, fn ($q) => $q->where('branch_id', $branchId))
                ->where('payment_status', 'paid')
                ->whereBetween('valid_on', [now()->startOfMonth(), now()->endOfMonth()])
                ->count(),
        ];

        return response()->json([
            'data' => $passes->items(),
            'meta' => [
                'current_page' => $passes->currentPage(),
                'last_page' => $passes->lastPage(),
                'total' => $passes->total(),
            ],
            'stats' => $stats,
        ]);
    }

    /**
     * Manual Walk-in Visitor Registration by Reception Staff
     */
    public function manualRegister(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'branch_id' => 'required|integer|exists:branches,id',
            'full_name' => 'required|string|max:120',
            'phone' => 'required|string|max:20',
            'email' => 'nullable|email|max:150',
            'gender' => 'nullable|string|in:male,female,other',
            'emergency_contact' => 'nullable|string|max:20',
            'payment_method' => 'required|string|in:cash,upi,pos_card',
            'notes' => 'nullable|string|max:500',
        ]);

        $gymId = CurrentGym::require();
        $branch = Branch::where('gym_id', $gymId)->findOrFail($validated['branch_id']);

        $pass = $this->visitorPassService->manualCounterRegister($branch, $request->user(), $validated);

        return response()->json([
            'success' => true,
            'message' => "One-day visitor pass issued successfully for {$pass->full_name}.",
            'pass' => $pass,
        ], 201);
    }

    /**
     * View Visitor Pass Receipt / Details
     */
    public function show(int $id): JsonResponse
    {
        $gymId = CurrentGym::require();
        $pass = VisitorPass::with(['branch', 'attendanceLog', 'creator'])
            ->where('gym_id', $gymId)
            ->findOrFail($id);

        return response()->json($pass);
    }
}
