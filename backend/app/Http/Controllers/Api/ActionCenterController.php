<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActionItem;
use App\Models\AttendanceLog;
use App\Models\Lead;
use App\Models\Member;
use App\Models\MemberMembership;
use App\Models\ProductBatch;
use App\Models\PtSession;
use App\Models\SupportTicket;
use App\Models\User;
use App\Support\CurrentBranch;
use App\Support\CurrentGym;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ActionCenterController extends Controller
{
    /**
     * Get aggregated active triage stream and assigned action items.
     */
    public function index(Request $request)
    {
        $gymId = CurrentGym::require();
        $branchId = $request->query('branch_id') ?: CurrentBranch::id();
        $now = Carbon::now();

        // 1. Fetch persistent action items stored in DB
        $dbItemsQuery = ActionItem::with(['assignee:id,name,role', 'resolver:id,name', 'branch:id,name'])
            ->where('gym_id', $gymId);

        if ($branchId) {
            $dbItemsQuery->where(function ($q) use ($branchId) {
                $q->where('branch_id', $branchId)->orWhereNull('branch_id');
            });
        }

        if ($request->filled('status')) {
            $dbItemsQuery->where('status', $request->query('status'));
        }

        if ($request->filled('severity')) {
            $dbItemsQuery->where('severity', $request->query('severity'));
        }

        $items = $dbItemsQuery->latest('id')->paginate(30);

        // 2. Real-time Live Triage Radar (Computed live checks across gym operations)
        // Check A: Members expiring in next 7 days
        $expiringCount = MemberMembership::where('gym_id', $gymId)
            ->where('status', 'active')
            ->whereBetween('end_date', [$now->toDateString(), $now->copy()->addDays(7)->toDateString()])
            ->when($branchId, fn($q) => $q->where('branch_id', $branchId))
            ->count();

        // Check B: Members with outstanding dues > 0
        $overdueMembersCount = Member::where('gym_id', $gymId)
            ->where('outstanding_balance', '>', 0)
            ->when($branchId, fn($q) => $q->where('primary_branch_id', $branchId))
            ->count();

        // Check C: Inactive members (Active membership but zero check-ins in last 10 days)
        $tenDaysAgo = $now->copy()->subDays(10)->toDateString();
        $activeMembersWithCheckins = AttendanceLog::where('gym_id', $gymId)
            ->whereDate('check_in_at', '>=', $tenDaysAgo)
            ->pluck('member_id')
            ->unique();

        $inactiveMembersCount = Member::where('gym_id', $gymId)
            ->where('status', 'active')
            ->when($branchId, fn($q) => $q->where('primary_branch_id', $branchId))
            ->whereNotIn('id', $activeMembersWithCheckins)
            ->count();

        // Check D: Low stock products
        $lowStockCount = DB::table('products')
            ->join('product_branch_stocks', 'products.id', '=', 'product_branch_stocks.product_id')
            ->where('products.gym_id', $gymId)
            ->where('products.is_active', true)
            ->whereNull('products.deleted_at')
            ->when($branchId, fn($q) => $q->where('product_branch_stocks.branch_id', $branchId))
            ->whereColumn('product_branch_stocks.quantity', '<=', 'products.min_stock_alert')
            ->count();

        // Check E: Products expiring in 30 days
        $expiringProductsCount = ProductBatch::where('gym_id', $gymId)
            ->where('current_quantity', '>', 0)
            ->whereNotNull('expiry_date')
            ->whereDate('expiry_date', '<=', $now->copy()->addDays(30)->toDateString())
            ->when($branchId, fn($q) => $q->where('branch_id', $branchId))
            ->count();

        // Check F: Uncontacted leads older than 24h
        $uncontactedLeadsCount = Lead::where('gym_id', $gymId)
            ->where('status', 'new')
            ->where('created_at', '<=', $now->copy()->subHours(24))
            ->when($branchId, fn($q) => $q->where('branch_id', $branchId))
            ->count();

        // Check G: Unresolved support tickets
        $unresolvedTicketsCount = SupportTicket::where('gym_id', $gymId)
            ->whereIn('status', ['open', 'in_progress'])
            ->when($branchId, fn($q) => $q->where('branch_id', $branchId))
            ->count();

        // Check H: Pending PT sessions older than today
        $pendingPtSessionsCount = PtSession::where('gym_id', $gymId)
            ->where('status', 'scheduled')
            ->whereDate('scheduled_at', '<', $now->toDateString())
            ->when($branchId, fn($q) => $q->where('branch_id', $branchId))
            ->count();

        $criticalCount = ($overdueMembersCount > 0 ? 1 : 0) + ($unresolvedTicketsCount > 0 ? 1 : 0) + ($lowStockCount > 0 ? 1 : 0);
        $warningCount = ($expiringCount > 0 ? 1 : 0) + ($inactiveMembersCount > 0 ? 1 : 0) + ($uncontactedLeadsCount > 0 ? 1 : 0);

        return response()->json([
            'items' => $items,
            'radar' => [
                'expiring_memberships' => $expiringCount,
                'overdue_payments' => $overdueMembersCount,
                'inactive_members_10d' => $inactiveMembersCount,
                'low_stock_items' => $lowStockCount,
                'expiring_products_30d' => $expiringProductsCount,
                'uncontacted_leads_24h' => $uncontactedLeadsCount,
                'unresolved_tickets' => $unresolvedTicketsCount,
                'pending_pt_sessions' => $pendingPtSessionsCount,
                'critical_categories' => $criticalCount,
                'warning_categories' => $warningCount,
            ]
        ]);
    }

    /**
     * Create an action item.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'branch_id' => 'nullable|exists:branches,id',
            'type' => 'required|string|max:60',
            'severity' => 'required|in:critical,warning,info',
            'title' => 'required|string|max:200',
            'description' => 'nullable|string',
            'reference_type' => 'nullable|string|max:50',
            'reference_id' => 'nullable|integer',
            'metadata' => 'nullable|array',
            'assigned_to_user_id' => 'nullable|exists:users,id',
            'due_date' => 'nullable|date',
        ]);

        $item = ActionItem::create([
            'gym_id' => CurrentGym::require(),
            'branch_id' => $validated['branch_id'] ?? CurrentBranch::id(),
            'type' => $validated['type'],
            'severity' => $validated['severity'],
            'title' => $validated['title'],
            'description' => $validated['description'] ?? null,
            'reference_type' => $validated['reference_type'] ?? null,
            'reference_id' => $validated['reference_id'] ?? null,
            'metadata' => $validated['metadata'] ?? null,
            'assigned_to_user_id' => $validated['assigned_to_user_id'] ?? null,
            'status' => 'pending',
            'due_date' => $validated['due_date'] ?? null,
        ]);

        return response()->json([
            'message' => 'Action item logged successfully',
            'item' => $item->load(['assignee', 'branch']),
        ], 201);
    }

    /**
     * Assign staff to an action item.
     */
    public function assign(Request $request, $id)
    {
        $item = ActionItem::findOrFail($id);

        $validated = $request->validate([
            'assigned_to_user_id' => 'required|exists:users,id',
        ]);

        $item->update([
            'assigned_to_user_id' => $validated['assigned_to_user_id'],
            'status' => 'in_progress',
        ]);

        return response()->json([
            'message' => 'Staff assigned successfully',
            'item' => $item->fresh(['assignee', 'branch']),
        ]);
    }

    /**
     * Resolve an action item with resolution notes.
     */
    public function resolve(Request $request, $id)
    {
        $item = ActionItem::findOrFail($id);

        $validated = $request->validate([
            'resolution_notes' => 'required|string|max:500',
            'status' => 'nullable|in:resolved,dismissed',
        ]);

        $item->update([
            'status' => $validated['status'] ?? 'resolved',
            'resolution_notes' => $validated['resolution_notes'],
            'resolved_at' => now(),
            'resolved_by_user_id' => $request->user()->id,
        ]);

        return response()->json([
            'message' => 'Action item marked as resolved',
            'item' => $item->fresh(['assignee', 'resolver', 'branch']),
        ]);
    }
}
