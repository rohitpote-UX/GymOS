<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Gym;
use App\Models\Member;
use App\Models\WhatsAppLog;
use App\Models\WhatsAppTemplate;
use App\Services\WhatsAppService;
use App\Support\CurrentBranch;
use App\Support\CurrentGym;
use Illuminate\Http\Request;

class WhatsAppController extends Controller
{
    protected WhatsAppService $service;

    public function __construct(WhatsAppService $service)
    {
        $this->service = $service;
    }

    /**
     * List all templates for the gym (auto-seeding defaults across en, mr, hi).
     */
    public function templates(Request $request)
    {
        $gymId = CurrentGym::require();
        $languages = ['en', 'mr', 'hi'];

        foreach ($languages as $lang) {
            $defaults = WhatsAppService::defaultTemplates($lang);
            foreach ($defaults as $cat => $data) {
                WhatsAppTemplate::firstOrCreate(
                    ['gym_id' => $gymId, 'category' => $cat, 'language' => $lang],
                    [
                        'template_name' => $data['name'],
                        'body_text' => $data['body'],
                        'variables' => $data['variables'],
                        'is_approved' => true,
                        'status' => 'approved',
                    ]
                );
            }
        }

        $query = WhatsAppTemplate::where('gym_id', $gymId);
        if ($request->query('language') === 'all') {
            // return all languages
        } elseif ($request->filled('language')) {
            $query->where('language', $request->query('language'));
        } else {
            // Default to active locale (e.g. 'en', 'mr', 'hi')
            $query->where('language', app()->getLocale() ?: 'en');
        }

        $templates = $query->get();

        $metaConfigured = !empty(env('WHATSAPP_TOKEN')) && !empty(env('WHATSAPP_PHONE_NUMBER_ID'));

        return response()->json([
            'templates' => $templates,
            'meta_api_configured' => $metaConfigured,
            'api_status' => $metaConfigured ? 'live_meta_cloud_api' : 'integration_ready_simulation',
        ]);
    }

    /**
     * Update an approved WhatsApp template's body text.
     */
    public function updateTemplate(Request $request, $id)
    {
        $template = WhatsAppTemplate::findOrFail($id);

        $validated = $request->validate([
            'body_text' => 'required|string|max:1000',
        ]);

        $template->update([
            'body_text' => $validated['body_text'],
        ]);

        AuditLog::record('whatsapp_template.updated', [
            'template_id' => $template->id,
            'category' => $template->category,
        ]);

        return response()->json([
            'message' => 'Template updated successfully',
            'template' => $template,
        ]);
    }

    /**
     * Message delivery logs with filter support.
     */
    public function logs(Request $request)
    {
        $gymId = CurrentGym::require();
        $branchId = $request->query('branch_id') ?: CurrentBranch::id();

        $query = WhatsAppLog::where('gym_id', $gymId);

        if ($branchId) {
            $query->where(function ($q) use ($branchId) {
                $q->where('branch_id', $branchId)->orWhereNull('branch_id');
            });
        }

        if ($request->filled('category')) {
            $query->where('category', $request->query('category'));
        }

        if ($request->filled('status')) {
            $query->where('status', $request->query('status'));
        }

        if ($request->filled('phone')) {
            $query->where('recipient_phone', 'like', "%{$request->query('phone')}%");
        }

        $logs = $query->latest('id')->paginate((int) $request->query('per_page', 25));

        $totalSent = WhatsAppLog::where('gym_id', $gymId)->where('status', 'sent')->count();
        $totalDelivered = WhatsAppLog::where('gym_id', $gymId)->where('status', 'delivered')->count();
        $totalFailed = WhatsAppLog::where('gym_id', $gymId)->where('status', 'failed')->count();

        return response()->json([
            'logs' => $logs,
            'summary' => [
                'total_messages' => WhatsAppLog::where('gym_id', $gymId)->count(),
                'delivered' => $totalDelivered + $totalSent,
                'failed' => $totalFailed,
            ]
        ]);
    }

    /**
     * Send manual or test WhatsApp message to a member.
     */
    public function send(Request $request)
    {
        $validated = $request->validate([
            'category' => 'required|string|in:welcome,payment_receipt,renewal_reminder,attendance,trial_booking,lead_followup,payment_due',
            'recipient_phone' => 'required|string|max:30',
            'recipient_name' => 'required|string|max:120',
            'variables' => 'required|array',
            'branch_id' => 'nullable|exists:branches,id',
            'language' => 'nullable|string|in:en,mr,hi',
        ]);

        $gym = Gym::findOrFail(CurrentGym::require());
        $variables = array_merge(['gym_name' => $gym->name], $validated['variables']);
        $lang = $validated['language'] ?? app()->getLocale() ?: 'en';

        $log = $this->service->dispatchMessage(
            $gym->id,
            $validated['recipient_phone'],
            $validated['recipient_name'],
            $validated['category'],
            $variables,
            $validated['branch_id'] ?? CurrentBranch::id(),
            $lang
        );

        return response()->json([
            'message' => 'WhatsApp message dispatched',
            'log' => $log,
        ], 201);
    }

    /**
     * Meta Cloud API Webhook for live delivery status updates.
     */
    public function webhook(Request $request)
    {
        // Meta webhook challenge verification
        if ($request->isMethod('get') && $request->has('hub_challenge')) {
            return response($request->query('hub_challenge'), 200);
        }

        $payload = $request->all();

        // Process message status updates
        if (isset($payload['entry'][0]['changes'][0]['value']['statuses'][0])) {
            $statusObj = $payload['entry'][0]['changes'][0]['value']['statuses'][0];
            $msgId = $statusObj['id'] ?? null;
            $status = $statusObj['status'] ?? null; // delivered, read, failed

            if ($msgId && $status) {
                $log = WhatsAppLog::where('provider_message_id', $msgId)->first();
                if ($log) {
                    $updates = ['status' => $status];
                    if ($status === 'delivered') $updates['delivered_at'] = now();
                    if ($status === 'read') $updates['read_at'] = now();
                    if ($status === 'failed') $updates['error_message'] = $statusObj['errors'][0]['title'] ?? 'Delivery failed';

                    $log->update($updates);
                }
            }
        }

        return response()->json(['status' => 'success']);
    }
}
