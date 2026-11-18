<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Branch;
use App\Support\CurrentGym;
use Illuminate\Http\Request;

class BranchController extends Controller
{
    public function index()
    {
        $branches = Branch::withCount(['members', 'staff'])
            ->orderBy('is_primary', 'desc')
            ->orderBy('name')
            ->get();

        return response()->json($branches);
    }

    public function store(Request $request)
    {
        $gym = CurrentGym::get();

        // Check SaaS plan branch limits
        if ($gym && $gym->plan) {
            $currentBranchCount = Branch::count();
            if ($currentBranchCount >= $gym->plan->branch_limit) {
                return response()->json([
                    'message' => "Your current SaaS plan '{$gym->plan->name}' is limited to {$gym->plan->branch_limit} branch(es). Please upgrade your plan to add more branches.",
                    'code' => 'plan_limit_reached',
                ], 422);
            }
        }

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'code' => ['nullable', 'string', 'max:30'],
            'phone' => ['nullable', 'string', 'max:30'],
            'email' => ['nullable', 'email', 'max:150'],
            'address' => ['nullable', 'string'],
            'city' => ['nullable', 'string', 'max:80'],
            'state' => ['nullable', 'string', 'max:80'],
            'pincode' => ['nullable', 'string', 'max:20'],
            'capacity' => ['nullable', 'integer', 'min:1'],
            'is_primary' => ['nullable', 'boolean'],
            'operating_hours' => ['nullable', 'array'],
        ]);

        if (!empty($validated['is_primary'])) {
            Branch::where('is_primary', true)->update(['is_primary' => false]);
        }

        $branch = Branch::create($validated);

        AuditLog::record('branch.created', ['branch_id' => $branch->id, 'name' => $branch->name], $branch->id);

        return response()->json($branch, 201);
    }

    public function show(int $id)
    {
        $branch = Branch::with(['staff:id,name,email,role,phone'])->withCount('members')->findOrFail($id);

        return response()->json($branch);
    }

    public function update(Request $request, int $id)
    {
        $branch = Branch::findOrFail($id);

        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:120'],
            'code' => ['nullable', 'string', 'max:30'],
            'phone' => ['nullable', 'string', 'max:30'],
            'email' => ['nullable', 'email', 'max:150'],
            'address' => ['nullable', 'string'],
            'city' => ['nullable', 'string', 'max:80'],
            'state' => ['nullable', 'string', 'max:80'],
            'pincode' => ['nullable', 'string', 'max:20'],
            'capacity' => ['nullable', 'integer', 'min:1'],
            'is_active' => ['sometimes', 'boolean'],
            'is_primary' => ['sometimes', 'boolean'],
            'operating_hours' => ['nullable', 'array'],
        ]);

        if (!empty($validated['is_primary']) && !$branch->is_primary) {
            Branch::where('is_primary', true)->update(['is_primary' => false]);
        }

        $branch->update($validated);

        AuditLog::record('branch.updated', ['branch_id' => $branch->id, 'changes' => array_keys($validated)], $branch->id);

        return response()->json($branch);
    }

    public function destroy(int $id)
    {
        $branch = Branch::findOrFail($id);

        if ($branch->is_primary) {
            return response()->json(['message' => 'Cannot delete the primary branch of the gym.'], 422);
        }

        $branch->delete();

        AuditLog::record('branch.deleted', ['branch_id' => $branch->id, 'name' => $branch->name], $branch->id);

        return response()->json(['message' => 'Branch deleted successfully.']);
    }
}
