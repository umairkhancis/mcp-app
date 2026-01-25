import React, { Suspense, useState } from "react";
import { createRoot } from "react-dom/client";
import "../index.css";
import { useDisplayMode } from "../use-display-mode";
import { useMaxHeight } from "../use-max-height";
import { useOpenAiGlobal } from "../use-openai-global";
import { useWidgetState } from "../use-widget-state";

import {
  ChevronRight,
  Clock,
  Filter,
  Heart,
  Minus,
  MoreHorizontal,
  Package,
  Plus,
  Search,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Tag,
  Zap,
} from "lucide-react";

// =============================================================================
// Type Definitions (The Contract with MCP Server)
// =============================================================================

export interface CategoryData {
  id: string;
  name: string;
  slug: string;
  icon: string;
  item_count: number;
}

export interface ProductData {
  id: string;
  name: string;
  description: string;
  price: number;
  original_price: number;
  currency: string;
  unit: string;
  quantity_available: number;
  category_id: string;
  category_name: string;
  image_url: string;
  is_promoted: boolean;
  is_new: boolean;
  discount_percent: number;
  brand: string;
}

export interface QuickToolOutput {
  products: ProductData[];
  categories: CategoryData[];
  total_count: number;
  store_name: string;
  delivery_time_min: number;
  location: {
    lat: number;
    lng: number;
    area_name: string;
  };
}

export interface CartItem {
  product_id: string;
  quantity: number;
}

export interface QuickWidgetState {
  cart: CartItem[];
  selectedCategory?: string;
  favorites: string[];
  searchQuery: string;
}

// =============================================================================
// Category Pill Component
// =============================================================================

interface CategoryPillProps {
  category: CategoryData;
  isSelected: boolean;
  onClick: (id: string) => void;
  theme?: string | null;
}

function CategoryPill({ category, isSelected, onClick, theme }: CategoryPillProps) {
  const isDark = theme === "dark";

  return (
    <button
      onClick={() => onClick(category.id)}
      className={`
        flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium
        transition-all duration-200 whitespace-nowrap flex-shrink-0
        ${isSelected
          ? "bg-green-500 text-white shadow-md"
          : isDark
            ? "bg-white/10 text-white/80 hover:bg-white/20"
            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
        }
      `}
    >
      <span>{category.icon}</span>
      <span>{category.name}</span>
      <span className={`
        text-xs px-1.5 py-0.5 rounded-full
        ${isSelected
          ? "bg-white/20 text-white"
          : isDark
            ? "bg-white/10 text-white/60"
            : "bg-gray-200 text-gray-500"
        }
      `}>
        {category.item_count}
      </span>
    </button>
  );
}

// =============================================================================
// Product Card Component
// =============================================================================

interface ProductCardProps {
  product: ProductData;
  cartQuantity: number;
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
  onAddToCart: (id: string) => void;
  onRemoveFromCart: (id: string) => void;
  theme?: string | null;
}

function ProductCard({
  product,
  cartQuantity,
  isFavorite,
  onToggleFavorite,
  onAddToCart,
  onRemoveFromCart,
  theme,
}: ProductCardProps) {
  const isDark = theme === "dark";
  const hasDiscount = product.discount_percent > 0;
  const isOutOfStock = product.quantity_available === 0;

  return (
    <div className={`
      relative rounded-2xl overflow-hidden transition-all duration-200
      ${isDark ? "bg-white/5 hover:bg-white/10" : "bg-white hover:shadow-lg"}
      ${isOutOfStock ? "opacity-60" : ""}
      border ${isDark ? "border-white/10" : "border-gray-100"}
    `}>
      {/* Product Image */}
      <div className="relative aspect-square bg-gray-100">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package className={`w-12 h-12 ${isDark ? "text-white/20" : "text-gray-300"}`} />
          </div>
        )}

        {/* Badges */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {hasDiscount && (
            <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              -{product.discount_percent}%
            </span>
          )}
          {product.is_new && (
            <span className="bg-blue-500 text-white text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              New
            </span>
          )}
          {product.is_promoted && (
            <span className="bg-green-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              Featured
            </span>
          )}
        </div>

        {/* Favorite Button */}
        <button
          onClick={() => onToggleFavorite(product.id)}
          className={`
            absolute top-2 right-2 p-2 rounded-full transition-colors
            ${isFavorite
              ? "bg-red-500 text-white"
              : isDark
                ? "bg-black/50 text-white/80 hover:bg-black/70"
                : "bg-white/80 text-gray-600 hover:bg-white"
            }
          `}
        >
          <Heart
            className="w-4 h-4"
            fill={isFavorite ? "currentColor" : "none"}
          />
        </button>

        {/* Out of Stock Overlay */}
        {isOutOfStock && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <span className="text-white font-medium text-sm">Out of Stock</span>
          </div>
        )}
      </div>

      {/* Product Info */}
      <div className="p-3">
        {/* Brand */}
        {product.brand && (
          <p className={`
            text-xs font-medium uppercase tracking-wide mb-1
            ${isDark ? "text-green-400" : "text-green-600"}
          `}>
            {product.brand}
          </p>
        )}

        {/* Name */}
        <h3 className={`
          font-medium text-sm line-clamp-2 mb-1
          ${isDark ? "text-white" : "text-gray-900"}
        `}>
          {product.name}
        </h3>

        {/* Unit */}
        <p className={`
          text-xs mb-2
          ${isDark ? "text-white/50" : "text-gray-500"}
        `}>
          {product.unit}
        </p>

        {/* Price & Cart */}
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className={`
              font-bold text-base
              ${isDark ? "text-white" : "text-gray-900"}
            `}>
              {product.currency} {product.price.toFixed(2)}
            </span>
            {hasDiscount && (
              <span className={`
                text-xs line-through
                ${isDark ? "text-white/40" : "text-gray-400"}
              `}>
                {product.currency} {product.original_price.toFixed(2)}
              </span>
            )}
          </div>

          {/* Add to Cart Button */}
          {!isOutOfStock && (
            <div className="flex items-center">
              {cartQuantity > 0 ? (
                <div className={`
                  flex items-center gap-2 rounded-full px-2 py-1
                  ${isDark ? "bg-green-600" : "bg-green-500"}
                `}>
                  <button
                    onClick={() => onRemoveFromCart(product.id)}
                    className="p-1 rounded-full hover:bg-white/20 transition-colors"
                  >
                    <Minus className="w-4 h-4 text-white" />
                  </button>
                  <span className="text-white font-medium text-sm min-w-[20px] text-center">
                    {cartQuantity}
                  </span>
                  <button
                    onClick={() => onAddToCart(product.id)}
                    className="p-1 rounded-full hover:bg-white/20 transition-colors"
                  >
                    <Plus className="w-4 h-4 text-white" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => onAddToCart(product.id)}
                  className={`
                    p-2 rounded-full transition-colors
                    ${isDark
                      ? "bg-green-600 hover:bg-green-500"
                      : "bg-green-500 hover:bg-green-600"
                    }
                  `}
                >
                  <Plus className="w-5 h-5 text-white" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Main App Component
// =============================================================================

function CareemQuickApp() {
  const toolOutput = useOpenAiGlobal("toolOutput") as QuickToolOutput | null;
  const theme = useOpenAiGlobal("theme");
  const displayMode = useDisplayMode();
  const maxHeight = useMaxHeight();
  const isDark = theme === "dark";
  const isFullscreen = displayMode === "fullscreen";

  const [widgetState, setWidgetState] = useWidgetState<QuickWidgetState & Record<string, unknown>>({
    cart: [],
    favorites: [],
    searchQuery: "",
  });

  const products = toolOutput?.products || [];
  const categories = toolOutput?.categories || [];
  const totalCount = toolOutput?.total_count || products.length;
  const storeName = toolOutput?.store_name || "Careem Quick";
  const deliveryTime = toolOutput?.delivery_time_min || 15;
  const areaName = toolOutput?.location?.area_name || "your area";

  const cart = widgetState?.cart || [];
  const favorites = widgetState?.favorites || [];
  const selectedCategory = widgetState?.selectedCategory;

  // Filter products by category
  const filteredProducts = selectedCategory
    ? products.filter((p) => p.category_id === selectedCategory)
    : products;

  // Calculate cart totals
  const cartTotalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotalPrice = cart.reduce((sum, item) => {
    const product = products.find((p) => p.id === item.product_id);
    return sum + (product?.price || 0) * item.quantity;
  }, 0);

  const getCartQuantity = (productId: string): number => {
    return cart.find((item) => item.product_id === productId)?.quantity || 0;
  };

  const handleAddToCart = (productId: string) => {
    setWidgetState((prev) => {
      const currentCart = prev?.cart || [];
      const existingItem = currentCart.find((item) => item.product_id === productId);

      if (existingItem) {
        return {
          ...prev,
          cart: currentCart.map((item) =>
            item.product_id === productId
              ? { ...item, quantity: item.quantity + 1 }
              : item
          ),
        };
      }

      return {
        ...prev,
        cart: [...currentCart, { product_id: productId, quantity: 1 }],
      };
    });
  };

  const handleRemoveFromCart = (productId: string) => {
    setWidgetState((prev) => {
      const currentCart = prev?.cart || [];
      const existingItem = currentCart.find((item) => item.product_id === productId);

      if (!existingItem) return prev;

      if (existingItem.quantity === 1) {
        return {
          ...prev,
          cart: currentCart.filter((item) => item.product_id !== productId),
        };
      }

      return {
        ...prev,
        cart: currentCart.map((item) =>
          item.product_id === productId
            ? { ...item, quantity: item.quantity - 1 }
            : item
        ),
      };
    });
  };

  const handleToggleFavorite = (productId: string) => {
    const newFavorites = favorites.includes(productId)
      ? favorites.filter((id) => id !== productId)
      : [...favorites, productId];

    setWidgetState((prev) => ({ ...prev, favorites: newFavorites }));
  };

  const handleCategoryClick = (categoryId: string) => {
    setWidgetState((prev) => ({
      ...prev,
      selectedCategory: prev?.selectedCategory === categoryId ? undefined : categoryId,
    }));
  };

  const handleRequestFullscreen = () => {
    if (window.openai) {
      window.openai.requestDisplayMode({ mode: "fullscreen" });
    }
  };

  const handleCheckout = () => {
    if (window.openai && cartTotalItems > 0) {
      const cartSummary = cart
        .map((item) => {
          const product = products.find((p) => p.id === item.product_id);
          return `${item.quantity}x ${product?.name}`;
        })
        .join(", ");

      window.openai.sendFollowUpMessage({
        prompt: `I'd like to checkout with: ${cartSummary}. Total: AED ${cartTotalPrice.toFixed(2)}`,
      });
    }
  };

  return (
    <div className={`
      antialiased w-full text-black overflow-hidden
      ${isDark ? "bg-gray-900 text-white" : "bg-gray-50"}
    `}>
      <div className="max-w-full">
        {/* Header */}
        <div className={`
          flex flex-row items-center gap-4 px-4 py-4 border-b
          ${isDark ? "border-white/10 bg-gray-900" : "border-gray-200 bg-white"}
        `}>
          <div className="w-14 h-14 rounded-xl flex items-center justify-center bg-gradient-to-br from-green-400 to-green-600">
            <Zap className="w-7 h-7 text-white" />
          </div>

          <div className="min-w-0 flex-1">
            <div className={`
              text-lg sm:text-xl font-bold
              ${isDark ? "text-white" : "text-gray-900"}
            `}>
              {storeName}
            </div>
            <div className={`
              flex items-center gap-2 text-sm
              ${isDark ? "text-white/60" : "text-gray-500"}
            `}>
              <Clock className="w-4 h-4" />
              <span>{deliveryTime} min delivery</span>
              <span>•</span>
              <span>{areaName}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isFullscreen && (
              <button
                onClick={handleRequestFullscreen}
                className={`
                  p-2 rounded-full transition-colors
                  ${isDark ? "hover:bg-white/10" : "hover:bg-gray-100"}
                `}
              >
                <MoreHorizontal className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Categories */}
        {categories.length > 0 && (
          <div className={`
            px-4 py-3 border-b overflow-x-auto
            ${isDark ? "border-white/10 bg-gray-900" : "border-gray-200 bg-white"}
          `}>
            <div className="flex gap-2">
              {categories.map((category) => (
                <CategoryPill
                  key={category.id}
                  category={category}
                  isSelected={selectedCategory === category.id}
                  onClick={handleCategoryClick}
                  theme={theme}
                />
              ))}
            </div>
          </div>
        )}

        {/* Products Grid */}
        <div
          className="px-4 py-4 overflow-y-auto"
          style={{
            maxHeight: isFullscreen
              ? "none"
              : maxHeight !== null && isFinite(maxHeight)
                ? Math.max(400, maxHeight - 280)
                : "60vh",
          }}
        >
          {filteredProducts.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {filteredProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  cartQuantity={getCartQuantity(product.id)}
                  isFavorite={favorites.includes(product.id)}
                  onToggleFavorite={handleToggleFavorite}
                  onAddToCart={handleAddToCart}
                  onRemoveFromCart={handleRemoveFromCart}
                  theme={theme}
                />
              ))}
            </div>
          ) : (
            <div className={`
              py-12 text-center
              ${isDark ? "text-white/60" : "text-gray-500"}
            `}>
              <ShoppingBag className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">No products found</p>
              <p className="text-sm">Try selecting a different category</p>
            </div>
          )}
        </div>

        {/* Cart Footer */}
        {cartTotalItems > 0 && (
          <div className={`
            sticky bottom-0 px-4 py-3 border-t
            ${isDark ? "border-white/10 bg-gray-900" : "border-gray-200 bg-white"}
          `}>
            <button
              onClick={handleCheckout}
              className={`
                w-full flex items-center justify-between px-6 py-3 rounded-xl
                bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700
                text-white font-medium transition-all duration-200 shadow-lg
              `}
            >
              <div className="flex items-center gap-3">
                <div className="relative">
                  <ShoppingCart className="w-6 h-6" />
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-white text-green-600 text-xs font-bold rounded-full flex items-center justify-center">
                    {cartTotalItems}
                  </span>
                </div>
                <span>View Cart</span>
              </div>
              <span className="font-bold">AED {cartTotalPrice.toFixed(2)}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Mount React App
// =============================================================================

const container = document.getElementById("careem-quick-root");
if (container) {
  const root = createRoot(container);
  root.render(
    <Suspense fallback={<div className="p-4 text-center">Loading products...</div>}>
      <CareemQuickApp />
    </Suspense>
  );
}
