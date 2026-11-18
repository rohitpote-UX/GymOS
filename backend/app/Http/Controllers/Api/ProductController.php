<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\InventoryMovement;
use App\Models\Product;
use App\Models\ProductBatch;
use App\Models\ProductBranchStock;
use App\Support\CurrentBranch;
use App\Support\CurrentGym;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class ProductController extends Controller
{
    public function categories()
    {
        return response()->json([
            'categories' => [
                ['key' => 'whey_protein', 'label' => 'Whey Protein'],
                ['key' => 'mass_gainers', 'label' => 'Mass Gainers'],
                ['key' => 'creatine', 'label' => 'Creatine'],
                ['key' => 'pre_workout', 'label' => 'Pre-Workout'],
                ['key' => 'sports_nutrition', 'label' => 'Sports Nutrition'],
                ['key' => 'protein_bars', 'label' => 'Protein Bars & Snacks'],
                ['key' => 'energy_drinks', 'label' => 'Energy & Hydration Drinks'],
                ['key' => 'shakers', 'label' => 'Shakers & Bottles'],
                ['key' => 'gym_accessories', 'label' => 'Gym Accessories (Straps, Belts, Wraps)'],
                ['key' => 'gym_merchandise', 'label' => 'Gym Merchandise & Apparel'],
                ['key' => 'custom', 'label' => 'Other / Custom'],
            ]
        ]);
    }

    public function index(Request $request)
    {
        $branchId = $request->query('branch_id') ?: CurrentBranch::id();

        $query = Product::with([
            'defaultSupplier:id,name,company_name',
            'branchStocks' => function ($q) use ($branchId) {
                if ($branchId) {
                    $q->where('branch_id', $branchId);
                }
            },
            'batches' => function ($q) use ($branchId) {
                if ($branchId) {
                    $q->where('branch_id', $branchId);
                }
                $q->where('current_quantity', '>', 0);
            }
        ]);

        if ($request->filled('category')) {
            $query->where('category', $request->query('category'));
        }

        if ($request->filled('brand')) {
            $query->where('brand', 'like', "%{$request->query('brand')}%");
        }

        if ($request->filled('is_active')) {
            $query->where('is_active', filter_var($request->query('is_active'), FILTER_VALIDATE_BOOLEAN));
        }

        if ($request->filled('search')) {
            $search = $request->query('search');
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('brand', 'like', "%{$search}%")
                    ->orWhere('sku', 'like', "%{$search}%")
                    ->orWhere('barcode', 'like', "%{$search}%");
            });
        }

        $perPage = (int) $request->query('per_page', 20);
        $products = $query->latest('id')->paginate($perPage);

        // Compute metrics for current gym & branch
        $allBranchStocks = ProductBranchStock::query();
        if ($branchId) {
            $allBranchStocks->where('branch_id', $branchId);
        }
        $totalStockUnits = (int) $allBranchStocks->sum('quantity');
        $totalStockValuation = (float) $allBranchStocks->sum(DB::raw('quantity * cost_price'));
        $totalRetailValuation = (float) $allBranchStocks->sum(DB::raw('quantity * selling_price'));

        return response()->json([
            'products' => $products,
            'summary' => [
                'total_products' => Product::count(),
                'active_products' => Product::where('is_active', true)->count(),
                'total_stock_units' => $totalStockUnits,
                'total_cost_valuation' => round($totalStockValuation, 2),
                'total_retail_valuation' => round($totalRetailValuation, 2),
            ]
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:150',
            'brand' => 'nullable|string|max:100',
            'category' => 'required|string|max:60',
            'sku' => 'nullable|string|max:60',
            'barcode' => 'nullable|string|max:80',
            'image_url' => 'nullable|string|max:255',
            'photo_data' => 'nullable|string',
            'size' => 'nullable|string|max:40',
            'weight' => 'nullable|string|max:40',
            'flavour' => 'nullable|string|max:60',
            'cost_price' => 'required|numeric|min:0',
            'selling_price' => 'required|numeric|min:0',
            'mrp' => 'nullable|numeric|min:0',
            'tax_percent' => 'nullable|numeric|min:0|max:100',
            'default_supplier_id' => 'nullable|exists:suppliers,id',
            'min_stock_alert' => 'nullable|integer|min:0',
            'is_active' => 'nullable|boolean',
            'description' => 'nullable|string',
            // Opening stock support
            'opening_stock' => 'nullable|integer|min:0',
            'branch_id' => 'nullable|exists:branches,id',
            'batch_number' => 'nullable|string|max:80',
            'expiry_date' => 'nullable|date',
            'manufacturing_date' => 'nullable|date',
        ]);

        $product = DB::transaction(function () use ($validated, $request) {
            $gymId = CurrentGym::require();
            $branchId = $validated['branch_id'] ?? CurrentBranch::id();

            $product = Product::create([
                'gym_id' => $gymId,
                'name' => $validated['name'],
                'brand' => $validated['brand'] ?? null,
                'category' => $validated['category'],
                'sku' => $validated['sku'] ?? null,
                'barcode' => $validated['barcode'] ?? null,
                'image_url' => $validated['image_url'] ?? null,
                'photo_data' => $validated['photo_data'] ?? null,
                'size' => $validated['size'] ?? null,
                'weight' => $validated['weight'] ?? null,
                'flavour' => $validated['flavour'] ?? null,
                'cost_price' => $validated['cost_price'],
                'selling_price' => $validated['selling_price'],
                'mrp' => $validated['mrp'] ?? $validated['selling_price'],
                'tax_percent' => $validated['tax_percent'] ?? 18.00,
                'default_supplier_id' => $validated['default_supplier_id'] ?? null,
                'min_stock_alert' => $validated['min_stock_alert'] ?? 5,
                'is_active' => $validated['is_active'] ?? true,
                'description' => $validated['description'] ?? null,
            ]);

            $openingStock = (int) ($validated['opening_stock'] ?? 0);

            if ($branchId) {
                // Initialize branch stock record
                $branchStock = ProductBranchStock::create([
                    'gym_id' => $gymId,
                    'branch_id' => $branchId,
                    'product_id' => $product->id,
                    'quantity' => $openingStock,
                    'cost_price' => $validated['cost_price'],
                    'selling_price' => $validated['selling_price'],
                ]);

                if ($openingStock > 0) {
                    $batchId = null;
                    if (!empty($validated['batch_number'])) {
                        $batch = ProductBatch::create([
                            'gym_id' => $gymId,
                            'branch_id' => $branchId,
                            'product_id' => $product->id,
                            'supplier_id' => $validated['default_supplier_id'] ?? null,
                            'batch_number' => $validated['batch_number'],
                            'manufacturing_date' => $validated['manufacturing_date'] ?? null,
                            'expiry_date' => $validated['expiry_date'] ?? null,
                            'cost_price' => $validated['cost_price'],
                            'selling_price' => $validated['selling_price'],
                            'initial_quantity' => $openingStock,
                            'current_quantity' => $openingStock,
                        ]);
                        $batchId = $batch->id;
                    }

                    // Record Opening Stock in permanent audit movement ledger
                    InventoryMovement::create([
                        'gym_id' => $gymId,
                        'branch_id' => $branchId,
                        'product_id' => $product->id,
                        'product_batch_id' => $batchId,
                        'type' => 'opening_stock',
                        'reference_type' => 'opening_stock',
                        'reference_id' => $product->id,
                        'quantity_change' => $openingStock,
                        'quantity_before' => 0,
                        'quantity_after' => $openingStock,
                        'unit_cost' => $validated['cost_price'],
                        'total_cost' => round($openingStock * (float) $validated['cost_price'], 2),
                        'notes' => 'Initial opening stock creation',
                        'user_id' => $request->user()->id,
                    ]);
                }
            }

            AuditLog::record('product.created', [
                'product_id' => $product->id,
                'name' => $product->name,
                'sku' => $product->sku,
                'opening_stock' => $openingStock,
            ]);

            return $product;
        });

        $product->load(['branchStocks', 'batches', 'defaultSupplier']);

        return response()->json([
            'message' => 'Product created successfully',
            'product' => $product,
        ], 201);
    }

    public function show($id)
    {
        $product = Product::with([
            'defaultSupplier',
            'branchStocks.branch:id,name,code',
            'batches' => function ($q) {
                $q->latest('expiry_date');
            },
            'movements' => function ($q) {
                $q->with(['branch:id,name', 'user:id,name'])->latest('id')->limit(30);
            }
        ])->findOrFail($id);

        return response()->json([
            'product' => $product,
        ]);
    }

    public function update(Request $request, $id)
    {
        $product = Product::findOrFail($id);

        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:150',
            'brand' => 'nullable|string|max:100',
            'category' => 'sometimes|required|string|max:60',
            'sku' => 'nullable|string|max:60',
            'barcode' => 'nullable|string|max:80',
            'image_url' => 'nullable|string|max:255',
            'photo_data' => 'nullable|string',
            'size' => 'nullable|string|max:40',
            'weight' => 'nullable|string|max:40',
            'flavour' => 'nullable|string|max:60',
            'cost_price' => 'sometimes|required|numeric|min:0',
            'selling_price' => 'sometimes|required|numeric|min:0',
            'mrp' => 'nullable|numeric|min:0',
            'tax_percent' => 'nullable|numeric|min:0|max:100',
            'default_supplier_id' => 'nullable|exists:suppliers,id',
            'min_stock_alert' => 'nullable|integer|min:0',
            'is_active' => 'nullable|boolean',
            'description' => 'nullable|string',
        ]);

        $product->update($validated);

        // If selling price changed, sync to branch stocks
        if (isset($validated['selling_price'])) {
            $product->branchStocks()->update(['selling_price' => $validated['selling_price']]);
        }

        AuditLog::record('product.updated', [
            'product_id' => $product->id,
            'name' => $product->name,
        ]);

        return response()->json([
            'message' => 'Product updated successfully',
            'product' => $product->fresh(['branchStocks', 'defaultSupplier']),
        ]);
    }

    public function destroy($id)
    {
        $product = Product::findOrFail($id);
        $product->delete();

        AuditLog::record('product.deleted', [
            'product_id' => $id,
            'name' => $product->name,
        ]);

        return response()->json([
            'message' => 'Product deleted successfully',
        ]);
    }

    public function barcodeLookup(Request $request, $code)
    {
        $branchId = $request->query('branch_id') ?: CurrentBranch::id();

        $product = Product::with([
            'defaultSupplier:id,name',
            'branchStocks' => function ($q) use ($branchId) {
                if ($branchId) {
                    $q->where('branch_id', $branchId);
                }
            },
            'batches' => function ($q) use ($branchId) {
                if ($branchId) {
                    $q->where('branch_id', $branchId);
                }
                $q->where('current_quantity', '>', 0)->orderBy('expiry_date', 'asc');
            }
        ])
        ->where(function ($q) use ($code) {
            $q->where('barcode', $code)
              ->orWhere('sku', $code);
        })
        ->where('is_active', true)
        ->first();

        if (!$product) {
            return response()->json([
                'message' => "No active product found with barcode/SKU: {$code}",
            ], 404);
        }

        $currentStock = $product->branchStocks->first()?->quantity ?? 0;

        return response()->json([
            'product' => $product,
            'current_stock' => $currentStock,
        ]);
    }
}
