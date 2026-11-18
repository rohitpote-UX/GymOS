<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\AiAdvisorService;
use App\Support\CurrentBranch;
use App\Support\CurrentGym;
use Illuminate\Http\Request;

class AiAdvisorController extends Controller
{
    protected AiAdvisorService $advisorService;

    public function __construct(AiAdvisorService $advisorService)
    {
        $this->advisorService = $advisorService;
    }

    /**
     * Get real-time compiled business intelligence report.
     */
    public function insights(Request $request)
    {
        $gymId = CurrentGym::require();
        $branchId = $request->query('branch_id') ?: CurrentBranch::id();

        $metrics = $this->advisorService->compileBusinessMetrics($gymId, $branchId);

        $hasAiKey = !empty(env('GEMINI_API_KEY')) || !empty(env('OPENAI_API_KEY'));

        return response()->json([
            'ai_enabled' => $hasAiKey,
            'ai_engine' => $hasAiKey ? 'Gemini 1.5 Flash' : 'GymOS Rule-Based Intelligence Engine v2.0',
            'status_label' => $hasAiKey ? 'Live AI Advisor Active' : 'Computed Metrics Active (GEMINI_API_KEY unconfigured)',
            'insights' => $metrics,
        ]);
    }

    /**
     * Ask the AI Advisor a specific question.
     */
    public function ask(Request $request)
    {
        $validated = $request->validate([
            'question' => 'required|string|max:300',
            'branch_id' => 'nullable|exists:branches,id',
        ]);

        $gymId = CurrentGym::require();
        $branchId = $validated['branch_id'] ?? CurrentBranch::id();

        $result = $this->advisorService->generateAnswer($gymId, $validated['question'], $branchId);

        return response()->json($result);
    }
}
