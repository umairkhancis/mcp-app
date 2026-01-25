import { Suspense } from "react";
import { createRoot } from "react-dom/client";
import "../index.css";
import { useDisplayMode } from "../use-display-mode";
import { useMaxHeight } from "../use-max-height";
import { useOpenAiGlobal } from "../use-openai-global";
import { useWidgetState } from "../use-widget-state";

import {
  ArrowLeft,
  Clock,
  Heart,
  Minus,
  MoreHorizontal,
  Package,
  Plus,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Trash2,
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
  viewMode: "browse" | "cart";
}

// =============================================================================
// Animation Styles
// =============================================================================

const animationStyles = `
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes slideIn {
    from { opacity: 0; transform: translateX(20px); }
    to { opacity: 1; transform: translateX(0); }
  }
  @keyframes scaleIn {
    from { opacity: 0; transform: scale(0.95); }
    to { opacity: 1; transform: scale(1); }
  }
`;

// =============================================================================
// Category Pill Component
// =============================================================================

interface CategoryPillProps {
  category: CategoryData;
  isSelected: boolean;
  onClick: (id: string) => void;
  index: number;
}

function CategoryPill({ category, isSelected, onClick, index }: CategoryPillProps) {
  return (
    <button
      onClick={() => onClick(category.id)}
      className={`
        flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold
        transition-all duration-200 whitespace-nowrap flex-shrink-0
        border
        ${isSelected
          ? "bg-orange-500 text-white border-orange-500 shadow-md"
          : "bg-[#fffaf5] text-black/80 border-black/10 hover:border-black/20 hover:bg-[#fff5eb]"
        }
      `}
      style={{
        animation: "fadeUp 0.5s ease-out both",
        animationDelay: `${100 + index * 50}ms`,
      }}
    >
      <span className="text-base">{category.icon}</span>
      <span>{category.name}</span>
      <span className={`
        text-xs px-2 py-0.5 rounded-full font-medium
        ${isSelected
          ? "bg-white/20 text-white"
          : "bg-black/5 text-black/50"
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
  index: number;
}

function ProductCard({
  product,
  cartQuantity,
  isFavorite,
  onToggleFavorite,
  onAddToCart,
  onRemoveFromCart,
  index,
}: ProductCardProps) {
  const hasDiscount = product.discount_percent > 0;
  const isOutOfStock = product.quantity_available === 0;

  return (
    <div
      className={`
        relative rounded-2xl overflow-hidden transition-all duration-300
        bg-[#fffaf5] border border-black/10
        hover:shadow-lg hover:border-black/20
        ${isOutOfStock ? "opacity-60" : ""}
      `}
      style={{
        animation: "fadeUp 0.5s ease-out both",
        animationDelay: `${150 + index * 60}ms`,
      }}
    >
      {/* Product Image */}
      <div className="relative aspect-square bg-white">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
            <Package className="w-12 h-12 text-black/20" />
          </div>
        )}

        {/* Badges */}
        <div className="absolute top-2 left-2 flex flex-col gap-1.5">
          {hasDiscount && (
            <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-sm">
              -{product.discount_percent}%
            </span>
          )}
          {product.is_new && (
            <span className="bg-blue-500 text-white text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1 shadow-sm">
              <Sparkles className="w-3 h-3" />
              New
            </span>
          )}
          {product.is_promoted && (
            <span className="bg-amber-500 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-sm">
              Featured
            </span>
          )}
        </div>

        {/* Favorite Button */}
        <button
          onClick={() => onToggleFavorite(product.id)}
          className={`
            absolute top-2 right-2 p-2 rounded-full transition-all duration-200
            shadow-sm
            ${isFavorite
              ? "bg-red-500 text-white scale-110"
              : "bg-white/90 text-black/40 hover:text-red-500 hover:bg-white"
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
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] flex items-center justify-center">
            <span className="text-white font-semibold text-sm bg-black/50 px-3 py-1.5 rounded-full">
              Out of Stock
            </span>
          </div>
        )}
      </div>

      {/* Product Info */}
      <div className="p-3">
        {/* Brand */}
        {product.brand && (
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-orange-600 mb-1">
            {product.brand}
          </p>
        )}

        {/* Name */}
        <h3 className="font-semibold text-sm text-black line-clamp-2 mb-0.5 leading-snug">
          {product.name}
        </h3>

        {/* Unit */}
        <p className="text-xs text-black/50 mb-3">
          {product.unit}
        </p>

        {/* Price & Cart */}
        <div className="flex items-end justify-between">
          <div className="flex flex-col">
            <span className="font-bold text-base text-black">
              {product.currency} {product.price.toFixed(2)}
            </span>
            {hasDiscount && (
              <span className="text-xs line-through text-black/40">
                {product.currency} {product.original_price.toFixed(2)}
              </span>
            )}
          </div>

          {/* Add to Cart Button */}
          {!isOutOfStock && (
            <div className="flex items-center">
              {cartQuantity > 0 ? (
                <div className="flex items-center gap-1 bg-orange-500 rounded-full px-1 py-1 shadow-md">
                  <button
                    onClick={() => onRemoveFromCart(product.id)}
                    className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors"
                  >
                    <Minus className="w-4 h-4 text-white" />
                  </button>
                  <span className="text-white font-bold text-sm min-w-[24px] text-center">
                    {cartQuantity}
                  </span>
                  <button
                    onClick={() => onAddToCart(product.id)}
                    className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors"
                  >
                    <Plus className="w-4 h-4 text-white" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => onAddToCart(product.id)}
                  className="w-9 h-9 rounded-full flex items-center justify-center bg-orange-500 hover:bg-orange-600 transition-all duration-200 shadow-md hover:shadow-lg hover:scale-105"
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
// Cart Item Component
// =============================================================================

interface CartItemCardProps {
  product: ProductData;
  quantity: number;
  onAddToCart: (id: string) => void;
  onRemoveFromCart: (id: string) => void;
  onRemoveAll: (id: string) => void;
  index: number;
}

function CartItemCard({
  product,
  quantity,
  onAddToCart,
  onRemoveFromCart,
  onRemoveAll,
  index,
}: CartItemCardProps) {
  const itemTotal = product.price * quantity;

  return (
    <div
      className="flex items-center gap-4 p-4 rounded-2xl bg-[#fffaf5] border border-black/10"
      style={{
        animation: "slideIn 0.4s ease-out both",
        animationDelay: `${index * 80}ms`,
      }}
    >
      {/* Product Image */}
      <div className="w-20 h-20 rounded-xl overflow-hidden bg-white flex-shrink-0 shadow-sm">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-50">
            <Package className="w-8 h-8 text-black/20" />
          </div>
        )}
      </div>

      {/* Product Info */}
      <div className="flex-1 min-w-0">
        {product.brand && (
          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-orange-600 mb-0.5">
            {product.brand}
          </p>
        )}
        <h4 className="font-semibold text-sm text-black truncate">{product.name}</h4>
        <p className="text-xs text-black/50 mb-2">{product.unit}</p>
        
        <div className="flex items-center justify-between">
          {/* Quantity Controls */}
          <div className="flex items-center gap-1 bg-white rounded-full px-1 py-1 border border-black/10">
            <button
              onClick={() => onRemoveFromCart(product.id)}
              className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-black/5 transition-colors"
            >
              <Minus className="w-4 h-4 text-black/60" />
            </button>
            <span className="font-bold text-sm min-w-[28px] text-center text-black">
              {quantity}
            </span>
            <button
              onClick={() => onAddToCart(product.id)}
              className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-black/5 transition-colors"
            >
              <Plus className="w-4 h-4 text-black/60" />
            </button>
          </div>

          {/* Price */}
          <div className="text-right">
            <p className="font-bold text-base text-black">
              {product.currency} {itemTotal.toFixed(2)}
            </p>
            <p className="text-xs text-black/40">
              {product.currency} {product.price.toFixed(2)} each
            </p>
          </div>
        </div>
      </div>

      {/* Remove Button */}
      <button
        onClick={() => onRemoveAll(product.id)}
        className="p-2 rounded-full hover:bg-red-50 text-black/30 hover:text-red-500 transition-colors flex-shrink-0"
      >
        <Trash2 className="w-5 h-5" />
      </button>
    </div>
  );
}

// =============================================================================
// Cart View Component
// =============================================================================

interface CartViewProps {
  products: ProductData[];
  cart: CartItem[];
  cartTotalItems: number;
  cartTotalPrice: number;
  deliveryTime: number;
  areaName: string;
  onBack: () => void;
  onAddToCart: (id: string) => void;
  onRemoveFromCart: (id: string) => void;
  onRemoveAll: (id: string) => void;
  onCheckout: () => void;
}

function CartView({
  products,
  cart,
  cartTotalItems,
  cartTotalPrice,
  deliveryTime,
  areaName,
  onBack,
  onAddToCart,
  onRemoveFromCart,
  onRemoveAll,
  onCheckout,
}: CartViewProps) {
  const deliveryFee = 5.00;
  const serviceFee = 2.00;
  const total = cartTotalPrice + deliveryFee + serviceFee;

  const cartProducts = cart
    .map((item) => {
      const product = products.find((p) => p.id === item.product_id);
      return product ? { product, quantity: item.quantity } : null;
    })
    .filter(Boolean) as { product: ProductData; quantity: number }[];

  return (
    <div
      className="min-h-screen bg-white bg-[radial-gradient(circle_at_top_left,_#fff7ed_0,_#ffffff_50%),radial-gradient(circle_at_bottom_right,_#fef3c7_0,_#ffffff_50%)]"
      style={{
        fontFamily: '"Trebuchet MS", "Gill Sans", "Lucida Grande", sans-serif',
      }}
    >
      <style>{animationStyles}</style>

      {/* Header */}
      <header
        className="px-4 py-4 border-b border-black/5 bg-white/80 backdrop-blur-sm sticky top-0 z-10"
        style={{ animation: "fadeUp 0.4s ease-out both" }}
      >
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 rounded-full hover:bg-black/5 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-black/70" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-black">Your Cart</h1>
            <p className="text-sm text-black/50">{cartTotalItems} item{cartTotalItems !== 1 ? "s" : ""}</p>
          </div>
        </div>
      </header>

      {/* Cart Items */}
      <div className="px-4 py-5">
        {cartProducts.length > 0 ? (
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-black/50 mb-4">
              Items in your cart
            </p>
            {cartProducts.map(({ product, quantity }, index) => (
              <CartItemCard
                key={product.id}
                product={product}
                quantity={quantity}
                onAddToCart={onAddToCart}
                onRemoveFromCart={onRemoveFromCart}
                onRemoveAll={onRemoveAll}
                index={index}
              />
            ))}
          </div>
        ) : (
          <div
            className="py-16 text-center rounded-2xl border border-dashed border-black/20 bg-[#fffaf5]"
            style={{ animation: "fadeUp 0.5s ease-out both" }}
          >
            <ShoppingBag className="w-14 h-14 mx-auto mb-4 text-black/30" />
            <p className="text-lg font-semibold text-black/70 mb-1">Your cart is empty</p>
            <p className="text-sm text-black/50 mb-4">Add some items to get started</p>
            <button
              onClick={onBack}
              className="px-6 py-2.5 bg-orange-500 text-white font-semibold rounded-full hover:bg-orange-600 transition-colors"
            >
              Continue Shopping
            </button>
          </div>
        )}
      </div>

      {/* Order Summary */}
      {cartProducts.length > 0 && (
        <div className="px-4 pb-6">
          <div
            className="rounded-2xl bg-[#fffaf5] border border-black/10 p-4 space-y-3"
            style={{ animation: "fadeUp 0.5s ease-out both", animationDelay: "200ms" }}
          >
            <p className="text-xs font-semibold uppercase tracking-widest text-black/50">
              Order Summary
            </p>
            
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-black/60">Subtotal</span>
                <span className="font-medium text-black">AED {cartTotalPrice.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-black/60">Delivery Fee</span>
                <span className="font-medium text-black">AED {deliveryFee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-black/60">Service Fee</span>
                <span className="font-medium text-black">AED {serviceFee.toFixed(2)}</span>
              </div>
              <div className="border-t border-black/10 pt-2 mt-2">
                <div className="flex justify-between">
                  <span className="font-semibold text-black">Total</span>
                  <span className="font-bold text-lg text-black">AED {total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Delivery Info */}
            <div className="flex items-center gap-3 pt-2 border-t border-black/10">
              <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                <Clock className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-black">Delivery in {deliveryTime} mins</p>
                <p className="text-xs text-black/50">To {areaName}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Checkout Footer */}
      {cartProducts.length > 0 && (
        <div
          className="sticky bottom-0 px-4 py-4 border-t border-black/10 bg-white/80 backdrop-blur-md"
          style={{ animation: "fadeUp 0.4s ease-out both" }}
        >
          <button
            onClick={onCheckout}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-2xl bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-semibold transition-all duration-300 shadow-xl hover:shadow-2xl hover:scale-[1.02]"
          >
            <span>Proceed to Checkout</span>
            <span className="px-3 py-1 bg-white/20 rounded-full text-sm">
              AED {total.toFixed(2)}
            </span>
          </button>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Main App Component
// =============================================================================

function DeliveryQuickApp() {
  const toolOutput = useOpenAiGlobal("toolOutput") as QuickToolOutput | null;
  const theme = useOpenAiGlobal("theme");
  const displayMode = useDisplayMode();
  const maxHeight = useMaxHeight();
  const isDark = theme === "dark";
  const isFullscreen = displayMode === "fullscreen";

  const [widgetState, setWidgetState] = useWidgetState<QuickWidgetState & Record<string, unknown>>({
    cart: [],
    favorites: [],
    viewMode: "browse",
  });

  const products = toolOutput?.products || [];
  const categories = toolOutput?.categories || [];
  const totalCount = toolOutput?.total_count || products.length;
  const storeName = toolOutput?.store_name || "Quick Delivery";
  const deliveryTime = toolOutput?.delivery_time_min || 15;
  const areaName = toolOutput?.location?.area_name || "your area";

  const cart = widgetState?.cart || [];
  const favorites = widgetState?.favorites || [];
  const selectedCategory = widgetState?.selectedCategory;
  const viewMode = widgetState?.viewMode || "browse";

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

  const handleRemoveAllFromCart = (productId: string) => {
    setWidgetState((prev) => ({
      ...prev,
      cart: (prev?.cart || []).filter((item) => item.product_id !== productId),
    }));
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

  const handleViewCart = () => {
    setWidgetState((prev) => ({ ...prev, viewMode: "cart" }));
  };

  const handleBackToBrowse = () => {
    setWidgetState((prev) => ({ ...prev, viewMode: "browse" }));
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
        prompt: `I'd like to checkout with: ${cartSummary}. Total: AED ${(cartTotalPrice + 7).toFixed(2)}`,
      });
    }
  };

  // Show cart view
  if (viewMode === "cart") {
    return (
      <CartView
        products={products}
        cart={cart}
        cartTotalItems={cartTotalItems}
        cartTotalPrice={cartTotalPrice}
        deliveryTime={deliveryTime}
        areaName={areaName}
        onBack={handleBackToBrowse}
        onAddToCart={handleAddToCart}
        onRemoveFromCart={handleRemoveFromCart}
        onRemoveAll={handleRemoveAllFromCart}
        onCheckout={handleCheckout}
      />
    );
  }

  // Dark mode - simplified version
  if (isDark) {
    return (
      <div className="antialiased w-full bg-gray-900 text-white overflow-hidden">
        <style>{animationStyles}</style>
        {/* Simplified dark mode content */}
        <div className="max-w-full">
          <div className="flex flex-row items-center gap-4 px-4 py-4 border-b border-white/10">
            <div className="w-14 h-14 rounded-xl flex items-center justify-center bg-gradient-to-br from-orange-400 to-red-600">
              <Zap className="w-7 h-7 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-lg font-bold text-white">{storeName}</div>
              <div className="flex items-center gap-2 text-sm text-white/60">
                <Clock className="w-4 h-4" />
                <span>{deliveryTime} min</span>
                <span>•</span>
                <span>{areaName}</span>
              </div>
            </div>
          </div>

          {categories.length > 0 && (
            <div className="px-4 py-3 border-b border-white/10 overflow-x-auto">
              <div className="flex gap-2">
                {categories.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => handleCategoryClick(category.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 whitespace-nowrap ${
                      selectedCategory === category.id
                        ? "bg-orange-500 text-white"
                        : "bg-white/10 text-white/80 hover:bg-white/20"
                    }`}
                  >
                    <span>{category.icon}</span>
                    <span>{category.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="px-4 py-4 overflow-y-auto" style={{ maxHeight: isFullscreen ? "none" : "60vh" }}>
            {filteredProducts.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {filteredProducts.map((product) => (
                  <div key={product.id} className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden">
                    <div className="relative aspect-square">
                      {product.image_url && <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />}
                    </div>
                    <div className="p-3">
                      <h3 className="font-medium text-sm text-white line-clamp-2 mb-1">{product.name}</h3>
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white">{product.currency} {product.price.toFixed(2)}</span>
                        {getCartQuantity(product.id) > 0 ? (
                          <div className="flex items-center gap-1 bg-orange-600 rounded-full px-2 py-1">
                            <button onClick={() => handleRemoveFromCart(product.id)} className="p-1"><Minus className="w-4 h-4 text-white" /></button>
                            <span className="text-white text-sm min-w-[20px] text-center">{getCartQuantity(product.id)}</span>
                            <button onClick={() => handleAddToCart(product.id)} className="p-1"><Plus className="w-4 h-4 text-white" /></button>
                          </div>
                        ) : (
                          <button onClick={() => handleAddToCart(product.id)} className="p-2 rounded-full bg-orange-600">
                            <Plus className="w-5 h-5 text-white" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center text-white/60">
                <ShoppingBag className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No products found</p>
              </div>
            )}
          </div>

          {cartTotalItems > 0 && (
            <div className="sticky bottom-0 px-4 py-3 border-t border-white/10 bg-gray-900">
              <button
                onClick={handleViewCart}
                className="w-full flex items-center justify-between px-6 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-red-600 text-white font-medium shadow-lg"
              >
                <div className="flex items-center gap-3">
                  <ShoppingCart className="w-6 h-6" />
                  <span>View Cart ({cartTotalItems})</span>
                </div>
                <span className="font-bold">AED {cartTotalPrice.toFixed(2)}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Light mode - browse view
  return (
    <div
      className="antialiased w-full min-h-screen bg-white text-black overflow-hidden bg-[radial-gradient(circle_at_top_left,_#fff7ed_0,_#ffffff_50%),radial-gradient(circle_at_bottom_right,_#fef3c7_0,_#ffffff_50%)]"
      style={{
        fontFamily: '"Trebuchet MS", "Gill Sans", "Lucida Grande", sans-serif',
      }}
    >
      <style>{animationStyles}</style>
      
      <div className="max-w-full">
        {/* Header */}
        <header
          className="px-4 py-5 border-b border-black/5"
          style={{ animation: "fadeUp 0.6s ease-out both" }}
        >
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-400 to-red-600 shadow-lg">
              <Zap className="w-7 h-7 text-white" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-black/50 mb-1">
                Grocery & Essentials
              </p>
              <h1 className="text-xl font-bold tracking-tight text-black">
                {storeName}
              </h1>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-[#fffaf5] border border-black/10">
                <Clock className="w-4 h-4 text-orange-600" />
                <span className="text-sm font-semibold text-black/70">{deliveryTime} min</span>
              </div>
              
              {!isFullscreen && (
                <button
                  onClick={handleRequestFullscreen}
                  className="p-2.5 rounded-full bg-[#fffaf5] border border-black/10 hover:border-black/20 transition-colors"
                >
                  <MoreHorizontal className="w-5 h-5 text-black/60" />
                </button>
              )}
            </div>
          </div>
          
          <p className="text-sm text-black/60 mt-2">
            Fast delivery to <span className="font-medium text-black/80">{areaName}</span> • {totalCount} items available
          </p>
        </header>

        {/* Categories */}
        {categories.length > 0 && (
          <div
            className="px-4 py-4 border-b border-black/5 overflow-x-auto"
            style={{ animation: "fadeUp 0.6s ease-out both", animationDelay: "50ms" }}
          >
            <p className="text-xs font-semibold uppercase tracking-widest text-black/50 mb-3">
              Categories
            </p>
            <div className="flex gap-2 pb-1">
              {categories.map((category, index) => (
                <CategoryPill
                  key={category.id}
                  category={category}
                  isSelected={selectedCategory === category.id}
                  onClick={handleCategoryClick}
                  index={index}
                />
              ))}
            </div>
          </div>
        )}

        {/* Products Grid */}
        <div
          className="px-4 py-5 overflow-y-auto"
          style={{
            maxHeight: isFullscreen
              ? "none"
              : maxHeight !== null && isFinite(maxHeight)
                ? Math.max(400, maxHeight - 320)
                : "55vh",
          }}
        >
          <p className="text-xs font-semibold uppercase tracking-widest text-black/50 mb-4">
            {selectedCategory 
              ? categories.find(c => c.id === selectedCategory)?.name || "Products"
              : "All Products"
            }
          </p>
          
          {filteredProducts.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {filteredProducts.map((product, index) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  cartQuantity={getCartQuantity(product.id)}
                  isFavorite={favorites.includes(product.id)}
                  onToggleFavorite={handleToggleFavorite}
                  onAddToCart={handleAddToCart}
                  onRemoveFromCart={handleRemoveFromCart}
                  index={index}
                />
              ))}
            </div>
          ) : (
            <div
              className="py-16 text-center rounded-2xl border border-dashed border-black/20 bg-[#fffaf5]"
              style={{ animation: "fadeUp 0.5s ease-out both" }}
            >
              <ShoppingBag className="w-14 h-14 mx-auto mb-4 text-black/30" />
              <p className="text-lg font-semibold text-black/70 mb-1">No products found</p>
              <p className="text-sm text-black/50">Try selecting a different category</p>
            </div>
          )}
        </div>

        {/* Cart Footer */}
        {cartTotalItems > 0 && (
          <div
            className="sticky bottom-0 px-4 py-4 border-t border-black/10 bg-white/80 backdrop-blur-md"
            style={{ animation: "fadeUp 0.4s ease-out both" }}
          >
            <button
              onClick={handleViewCart}
              className="w-full flex items-center justify-between px-5 py-4 rounded-2xl bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-semibold transition-all duration-300 shadow-xl hover:shadow-2xl hover:scale-[1.02]"
            >
              <div className="flex items-center gap-4">
                <div className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-white/20">
                  <ShoppingCart className="w-6 h-6" />
                  <span className="absolute -top-1.5 -right-1.5 w-6 h-6 bg-white text-orange-600 text-xs font-bold rounded-full flex items-center justify-center shadow-md">
                    {cartTotalItems}
                  </span>
                </div>
                <div className="text-left">
                  <p className="text-white/80 text-xs font-medium">View Cart</p>
                  <p className="text-white text-sm">{cartTotalItems} item{cartTotalItems > 1 ? "s" : ""}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-white/80 text-xs font-medium">Total</p>
                <p className="text-lg font-bold">AED {cartTotalPrice.toFixed(2)}</p>
              </div>
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

const container = document.getElementById("delivery-quick-root");
if (container) {
  const root = createRoot(container);
  root.render(
    <Suspense fallback={<div className="p-4 text-center">Loading products...</div>}>
      <DeliveryQuickApp />
    </Suspense>
  );
}
