<?php

namespace App\Support;

class ModuleRegistry
{
    public const MODULE_OVERVIEW = 'overview';
    public const MODULE_MEMBERS = 'members';
    public const MODULE_ATTENDANCE = 'attendance';
    public const MODULE_FINANCE = 'finance';
    public const MODULE_POS_INVENTORY = 'pos_inventory';
    public const MODULE_LEADS_CRM = 'leads_crm';
    public const MODULE_WHATSAPP = 'whatsapp';
    public const MODULE_AI_ADVISOR = 'ai_advisor';
    public const MODULE_PT_TRAINERS = 'pt_trainers';
    public const MODULE_MULTI_BRANCH = 'multi_branch';

    /**
     * All registered modules with metadata.
     */
    public static function all(): array
    {
        return [
            self::MODULE_OVERVIEW => [
                'key' => self::MODULE_OVERVIEW,
                'name' => 'Overview & Action Center',
                'description' => 'Executive business dashboard, live triage radar and daily performance alerts.',
                'is_core' => true,
                'dependencies' => [],
            ],
            self::MODULE_MEMBERS => [
                'key' => self::MODULE_MEMBERS,
                'name' => 'Member Management',
                'description' => 'Complete athlete registration, photo ID, membership lifecycle, renewals and digital pass.',
                'is_core' => true,
                'dependencies' => [],
            ],
            self::MODULE_ATTENDANCE => [
                'key' => self::MODULE_ATTENDANCE,
                'name' => 'Attendance & Access Control',
                'description' => 'Fast QR check-in, manual member lookup, branch occupancy and real-time punch logs.',
                'is_core' => false,
                'dependencies' => [self::MODULE_MEMBERS],
            ],
            self::MODULE_FINANCE => [
                'key' => self::MODULE_FINANCE,
                'name' => 'Finance & Cash Closing',
                'description' => 'Fee collections, member ledgers, expense tracking, daily shift cash closing and financial reports.',
                'is_core' => false,
                'dependencies' => [self::MODULE_MEMBERS],
            ],
            self::MODULE_POS_INVENTORY => [
                'key' => self::MODULE_POS_INVENTORY,
                'name' => 'Supplement POS & Inventory',
                'description' => 'Retail counter barcode sales, inventory valuation (WAC), batch expiry alerts, suppliers and purchases.',
                'is_core' => false,
                'dependencies' => [],
            ],
            self::MODULE_LEADS_CRM => [
                'key' => self::MODULE_LEADS_CRM,
                'name' => 'Leads CRM & Growth',
                'description' => 'Prospect enquiries, trial bookings, follow-up scheduler and sales conversion pipelines.',
                'is_core' => false,
                'dependencies' => [],
            ],
            self::MODULE_WHATSAPP => [
                'key' => self::MODULE_WHATSAPP,
                'name' => 'WhatsApp Business Automation',
                'description' => 'Automated welcome notes, payment receipts, fee due reminders and trial confirmations.',
                'is_core' => false,
                'dependencies' => [],
            ],
            self::MODULE_AI_ADVISOR => [
                'key' => self::MODULE_AI_ADVISOR,
                'name' => 'AI Gym Business Advisor',
                'description' => 'Deterministic revenue intelligence, churn prevention insights and executive business guidance.',
                'is_core' => false,
                'dependencies' => [self::MODULE_FINANCE],
            ],
            self::MODULE_PT_TRAINERS => [
                'key' => self::MODULE_PT_TRAINERS,
                'name' => 'Personal Training & Coaches',
                'description' => 'Trainer assignments, PT session tracking, coach compensation and trainer portal workspace.',
                'is_core' => false,
                'dependencies' => [self::MODULE_MEMBERS],
            ],
            self::MODULE_MULTI_BRANCH => [
                'key' => self::MODULE_MULTI_BRANCH,
                'name' => 'Multi-Branch Management',
                'description' => 'Manage multiple facility locations, staff branch permissions and cross-branch analytics.',
                'is_core' => false,
                'dependencies' => [],
            ],
        ];
    }

    /**
     * Default modules entitled under each SaaS plan code.
     */
    public static function defaultPlanModules(?string $planCode): array
    {
        $code = strtolower((string) $planCode);

        return match ($code) {
            'starter' => [
                self::MODULE_OVERVIEW,
                self::MODULE_MEMBERS,
                self::MODULE_ATTENDANCE,
                self::MODULE_FINANCE,
            ],
            'growth' => [
                self::MODULE_OVERVIEW,
                self::MODULE_MEMBERS,
                self::MODULE_ATTENDANCE,
                self::MODULE_FINANCE,
                self::MODULE_POS_INVENTORY,
                self::MODULE_LEADS_CRM,
                self::MODULE_WHATSAPP,
                self::MODULE_PT_TRAINERS,
                self::MODULE_MULTI_BRANCH,
            ],
            'enterprise' => array_keys(self::all()),
            // Default fallback if plan is custom or unspecified
            default => [
                self::MODULE_OVERVIEW,
                self::MODULE_MEMBERS,
                self::MODULE_ATTENDANCE,
                self::MODULE_FINANCE,
                self::MODULE_POS_INVENTORY,
                self::MODULE_LEADS_CRM,
                self::MODULE_WHATSAPP,
                self::MODULE_AI_ADVISOR,
                self::MODULE_PT_TRAINERS,
                self::MODULE_MULTI_BRANCH,
            ],
        };
    }
}
