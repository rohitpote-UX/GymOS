<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\SaasPlan;
use Illuminate\Http\Request;

class PlanController extends Controller
{
    public function index()
    {
        $plans = SaasPlan::withCount('gyms')->orderBy('sort_order')->get();

        return response()->json($plans);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'code' => ['required', 'string', 'max:50', 'unique:saas_plans,code'],
            'price' => ['required', 'numeric', 'min:0'],
            'interval' => ['required', 'in:month,year'],
            'branch_limit' => ['required', 'integer', 'min:1'],
            'member_limit' => ['required', 'integer', 'min:1'],
            'features' => ['nullable', 'array'],
            'is_active' => ['nullable', 'boolean'],
            'sort_order' => ['nullable', 'integer'],
        ]);

        $plan = SaasPlan::create($validated);

        return response()->json($plan, 201);
    }

    public function update(Request $request, int $id)
    {
        $plan = SaasPlan::findOrFail($id);

        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:100'],
            'price' => ['sometimes', 'numeric', 'min:0'],
            'branch_limit' => ['sometimes', 'integer', 'min:1'],
            'member_limit' => ['sometimes', 'integer', 'min:1'],
            'features' => ['nullable', 'array'],
            'is_active' => ['sometimes', 'boolean'],
            'sort_order' => ['sometimes', 'integer'],
        ]);

        $plan->update($validated);

        return response()->json($plan);
    }

    public function destroy(int $id)
    {
        $plan = SaasPlan::findOrFail($id);
        $plan->delete();

        return response()->json(['message' => 'Plan deleted successfully.']);
    }
}
