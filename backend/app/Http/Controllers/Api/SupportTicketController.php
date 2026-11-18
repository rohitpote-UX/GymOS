<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActionItem;
use App\Models\AuditLog;
use App\Models\SupportTicket;
use App\Models\SupportTicketMessage;
use App\Support\CurrentBranch;
use App\Support\CurrentGym;
use Illuminate\Http\Request;

class SupportTicketController extends Controller
{
    public function index(Request $request)
    {
        $gymId = CurrentGym::require();
        $scope = $request->query('scope', 'gym_member'); // gym_member or saas_platform

        $query = SupportTicket::with([
            'member:id,first_name,last_name,phone,member_code',
            'assignee:id,name',
            'creator:id,name',
            'branch:id,name',
        ])
        ->where('gym_id', $gymId)
        ->where('scope', $scope);

        if ($request->filled('status')) {
            $query->where('status', $request->query('status'));
        }

        if ($request->filled('priority')) {
            $query->where('priority', $request->query('priority'));
        }

        if ($request->filled('category')) {
            $query->where('category', $request->query('category'));
        }

        $tickets = $query->latest('id')->paginate(25);

        $counts = [
            'open' => SupportTicket::where('gym_id', $gymId)->where('scope', $scope)->where('status', 'open')->count(),
            'in_progress' => SupportTicket::where('gym_id', $gymId)->where('scope', $scope)->where('status', 'in_progress')->count(),
            'resolved' => SupportTicket::where('gym_id', $gymId)->where('scope', $scope)->where('status', 'resolved')->count(),
        ];

        return response()->json([
            'scope' => $scope,
            'counts' => $counts,
            'tickets' => $tickets,
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'scope' => 'required|in:gym_member,saas_platform',
            'category' => 'required|string|max:60',
            'priority' => 'required|in:low,medium,high,urgent',
            'subject' => 'required|string|max:200',
            'description' => 'required|string',
            'member_id' => 'nullable|exists:members,id',
            'branch_id' => 'nullable|exists:branches,id',
            'assigned_to_user_id' => 'nullable|exists:users,id',
        ]);

        $gymId = CurrentGym::require();
        $count = SupportTicket::where('gym_id', $gymId)->count();
        $prefix = $validated['scope'] === 'saas_platform' ? 'SAAS-TKT-' : 'TKT-';
        $ticketNumber = $prefix . date('Y') . '-' . str_pad((string) ($count + 1), 5, '0', STR_PAD_LEFT);

        $ticket = SupportTicket::create([
            'gym_id' => $gymId,
            'branch_id' => $validated['branch_id'] ?? CurrentBranch::id(),
            'ticket_number' => $ticketNumber,
            'scope' => $validated['scope'],
            'member_id' => $validated['member_id'] ?? null,
            'category' => $validated['category'],
            'priority' => $validated['priority'],
            'subject' => $validated['subject'],
            'description' => $validated['description'],
            'status' => 'open',
            'assigned_to_user_id' => $validated['assigned_to_user_id'] ?? null,
            'created_by_user_id' => $request->user()->id,
        ]);

        // Add initial message
        SupportTicketMessage::create([
            'support_ticket_id' => $ticket->id,
            'user_id' => $request->user()->id,
            'member_id' => $validated['member_id'] ?? null,
            'message' => $validated['description'],
        ]);

        // Log into Action Center if gym_member scope
        if ($validated['scope'] === 'gym_member') {
            ActionItem::create([
                'gym_id' => $gymId,
                'branch_id' => $ticket->branch_id,
                'type' => 'unresolved_ticket',
                'severity' => in_array($ticket->priority, ['high', 'urgent']) ? 'critical' : 'warning',
                'title' => "Support Ticket: {$ticket->subject}",
                'description' => "Ticket #{$ticket->ticket_number} logged under {$ticket->category}.",
                'reference_type' => 'support_ticket',
                'reference_id' => $ticket->id,
                'status' => 'pending',
                'due_date' => now()->addDay()->toDateString(),
            ]);
        }

        AuditLog::record('support_ticket.created', [
            'ticket_id' => $ticket->id,
            'ticket_number' => $ticketNumber,
            'scope' => $ticket->scope,
            'priority' => $ticket->priority,
        ]);

        return response()->json([
            'message' => 'Support ticket created successfully',
            'ticket' => $ticket->load(['member', 'assignee', 'creator']),
        ], 201);
    }

    public function show($id)
    {
        $ticket = SupportTicket::with([
            'member',
            'branch:id,name',
            'assignee:id,name',
            'creator:id,name',
            'messages.user:id,name,role',
            'messages.member:id,first_name,last_name',
        ])->findOrFail($id);

        return response()->json([
            'ticket' => $ticket,
        ]);
    }

    public function addMessage(Request $request, $id)
    {
        $ticket = SupportTicket::findOrFail($id);

        $validated = $request->validate([
            'message' => 'required|string',
            'is_internal_note' => 'nullable|boolean',
            'attachment_url' => 'nullable|string|max:255',
        ]);

        $message = SupportTicketMessage::create([
            'support_ticket_id' => $ticket->id,
            'user_id' => $request->user()->id,
            'is_internal_note' => $validated['is_internal_note'] ?? false,
            'message' => $validated['message'],
            'attachment_url' => $validated['attachment_url'] ?? null,
        ]);

        return response()->json([
            'message' => 'Message added to ticket thread',
            'ticket_message' => $message->load('user:id,name,role'),
        ], 201);
    }

    public function updateStatus(Request $request, $id)
    {
        $ticket = SupportTicket::findOrFail($id);

        $validated = $request->validate([
            'status' => 'sometimes|required|in:open,in_progress,resolved,closed',
            'priority' => 'sometimes|required|in:low,medium,high,urgent',
            'assigned_to_user_id' => 'nullable|exists:users,id',
            'resolution_notes' => 'nullable|string',
        ]);

        if (isset($validated['status']) && in_array($validated['status'], ['resolved', 'closed'])) {
            $validated['resolved_at'] = now();
        }

        $ticket->update($validated);

        AuditLog::record('support_ticket.updated', [
            'ticket_id' => $ticket->id,
            'status' => $ticket->status,
        ]);

        return response()->json([
            'message' => 'Ticket updated successfully',
            'ticket' => $ticket->fresh(['member', 'assignee', 'messages']),
        ]);
    }
}
