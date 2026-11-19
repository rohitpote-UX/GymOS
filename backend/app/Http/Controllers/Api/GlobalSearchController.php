<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Lead;
use App\Models\Member;
use App\Models\MembershipPlan;
use App\Models\Payment;
use App\Models\Product;
use App\Support\CurrentBranch;
use App\Support\CurrentGym;
use Illuminate\Http\Request;

class GlobalSearchController extends Controller
{
    /**
     * Unified Global Search across Members, Plans, Payments, Products, and Leads.
     */
    public function search(Request $request)
    {
        $query = trim((string) $request->input('q', ''));

        if (strlen($query) < 2) {
            return response()->json([
                'query' => $query,
                'results' => [
                    'members' => [],
                    'plans' => [],
                    'payments' => [],
                    'products' => [],
                    'leads' => [],
                ],
                'total_matches' => 0,
            ]);
        }

        $term = '%' . $query . '%';
        $branchId = CurrentBranch::id();

        // 1. Members
        $members = Member::where(function ($q) use ($term) {
            $q->where('first_name', 'like', $term)
              ->orWhere('last_name', 'like', $term)
              ->orWhere('phone', 'like', $term)
              ->orWhere('email', 'like', $term)
              ->orWhere('member_code', 'like', $term);
        })
        ->when($branchId, fn ($q) => $q->where('primary_branch_id', $branchId))
        ->take(5)
        ->get(['id', 'first_name', 'last_name', 'phone', 'member_code', 'status', 'outstanding_balance'])
        ->map(fn ($m) => [
            'id' => $m->id,
            'title' => trim($m->first_name . ' ' . $m->last_name),
            'subtitle' => "ID: {$m->member_code} • {$m->phone}",
            'status' => $m->status,
            'type' => 'member',
            'url' => "/members?search=" . urlencode($m->member_code),
            'metadata' => [
                'member_code' => $m->member_code,
                'outstanding_balance' => (float) $m->outstanding_balance,
            ],
        ]);

        // 2. Membership Plans
        $plans = MembershipPlan::where(function ($q) use ($term) {
            $q->where('name', 'like', $term)
              ->orWhere('code', 'like', $term);
        })
        ->take(5)
        ->get(['id', 'name', 'code', 'price', 'duration_days', 'is_active'])
        ->map(fn ($p) => [
            'id' => $p->id,
            'title' => $p->name,
            'subtitle' => "₹{$p->price} • {$p->duration_days} Days",
            'status' => $p->is_active ? 'active' : 'inactive',
            'type' => 'plan',
            'url' => '/plans',
            'metadata' => [
                'price' => (float) $p->price,
            ],
        ]);

        // 3. Payments / Receipts
        $payments = Payment::with('member:id,first_name,last_name')
        ->where(function ($q) use ($term) {
            $q->where('receipt_number', 'like', $term)
              ->orWhere('notes', 'like', $term);
        })
        ->when($branchId, fn ($q) => $q->where('branch_id', $branchId))
        ->latest('payment_date')
        ->take(5)
        ->get(['id', 'member_id', 'receipt_number', 'amount', 'payment_method', 'payment_date', 'status'])
        ->map(fn ($pay) => [
            'id' => $pay->id,
            'title' => "Receipt #{$pay->receipt_number}",
            'subtitle' => ($pay->member ? "{$pay->member->first_name} {$pay->member->last_name} • " : '') . "₹{$pay->amount} via " . strtoupper($pay->payment_method),
            'status' => $pay->status,
            'type' => 'payment',
            'url' => '/payments',
            'metadata' => [
                'amount' => (float) $pay->amount,
                'payment_date' => $pay->payment_date?->format('Y-m-d'),
            ],
        ]);

        // 4. Products / POS Inventory
        $products = Product::where(function ($q) use ($term) {
            $q->where('name', 'like', $term)
              ->orWhere('brand', 'like', $term)
              ->orWhere('sku', 'like', $term)
              ->orWhere('barcode', 'like', $term);
        })
        ->take(5)
        ->get(['id', 'name', 'brand', 'sku', 'barcode', 'selling_price', 'stock_quantity', 'category'])
        ->map(fn ($prod) => [
            'id' => $prod->id,
            'title' => $prod->name,
            'subtitle' => ($prod->brand ? "{$prod->brand} • " : '') . "₹{$prod->selling_price} (Stock: {$prod->stock_quantity})",
            'status' => $prod->stock_quantity > 0 ? 'in_stock' : 'out_of_stock',
            'type' => 'product',
            'url' => '/pos',
            'metadata' => [
                'sku' => $prod->sku,
                'selling_price' => (float) $prod->selling_price,
                'stock' => (int) $prod->stock_quantity,
            ],
        ]);

        // 5. Leads CRM
        $leads = Lead::where(function ($q) use ($term) {
            $q->where('name', 'like', $term)
              ->orWhere('phone', 'like', $term)
              ->orWhere('email', 'like', $term);
        })
        ->when($branchId, fn ($q) => $q->where('branch_id', $branchId))
        ->take(5)
        ->get(['id', 'name', 'phone', 'status', 'source'])
        ->map(fn ($lead) => [
            'id' => $lead->id,
            'title' => $lead->name,
            'subtitle' => "Lead • {$lead->phone} (" . ucfirst($lead->source ?: 'Walk-in') . ")",
            'status' => $lead->status,
            'type' => 'lead',
            'url' => '/leads',
            'metadata' => [
                'source' => $lead->source,
            ],
        ]);

        $total = $members->count() + $plans->count() + $payments->count() + $products->count() + $leads->count();

        return response()->json([
            'query' => $query,
            'results' => [
                'members' => $members,
                'plans' => $plans,
                'payments' => $payments,
                'products' => $products,
                'leads' => $leads,
            ],
            'total_matches' => $total,
        ]);
    }
}
