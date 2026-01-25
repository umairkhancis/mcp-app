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
  MapPin,
  MoreHorizontal,
  SortAsc,
  SortDesc,
  Star,
  Utensils,
  Bike,
  Percent,
  Truck,
} from "lucide-react";

// =============================================================================
// Type Definitions (The Contract with MCP Server)
// =============================================================================

export interface CuisineData {
  id: string;
  name: string;
  slug: string;
}

export interface RestaurantData {
  id: string;
  name: string;
  description: string;
  rating: number;
  review_count: number;
  delivery_time_min: number;
  delivery_time_max: number;
  delivery_fee: number;
  minimum_order: number;
  cuisines: CuisineData[];
  is_promoted: boolean;
  has_free_delivery: boolean;
  discount_percent: number;
  logo_url: string;
  cover_url: string;
  latitude: number;
  longitude: number;
  distance_km: number;
  is_open: boolean;
}

export interface RestaurantsToolOutput {
  restaurants: RestaurantData[];
  total_count: number;
  page: number;
  has_more: boolean;
  location: {
    lat: number;
    lng: number;
    area_name: string;
  };
}

export interface RestaurantsWidgetState {
  favorites: string[];
  sortBy: "rating" | "name" | "delivery_time" | "distance";
  sortOrder: "asc" | "desc";
  selectedRestaurant?: string;
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
`;

// =============================================================================
// Restaurant Card Component
// =============================================================================

interface RestaurantCardProps {
  restaurant: RestaurantData;
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
  onClick: (id: string) => void;
  theme?: string | null;
  index: number;
}

function RestaurantCard({
  restaurant,
  isFavorite,
  onToggleFavorite,
  onClick,
  theme,
  index,
}: RestaurantCardProps) {
  const isDark = theme === "dark";

  const handleCardClick = () => {
    onClick(restaurant.id);
  };

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleFavorite(restaurant.id);
  };

  const getRatingColor = (rating: number) => {
    if (rating >= 4.5) return "bg-emerald-500";
    if (rating >= 4.0) return "bg-green-500";
    if (rating >= 3.5) return "bg-yellow-500";
    return "bg-orange-500";
  };

  const deliveryTimeText = restaurant.delivery_time_min === restaurant.delivery_time_max
    ? `${restaurant.delivery_time_min} min`
    : `${restaurant.delivery_time_min}-${restaurant.delivery_time_max} min`;

  return (
    <div
      className={`
        px-3 -mx-2 rounded-2xl cursor-pointer transition-all duration-200
        ${isDark ? "hover:bg-white/10" : "hover:bg-black/5"}
        ${!restaurant.is_open ? "opacity-60" : ""}
      `}
      onClick={handleCardClick}
      style={{
        animation: "fadeUp 0.5s ease-out both",
        animationDelay: `${100 + index * 50}ms`,
      }}
    >
      <div className={`
        flex w-full items-center gap-3 py-3 border-b
        ${isDark ? "border-white/10" : "border-black/5"}
        last:border-b-0
      `}>
        {/* Restaurant Logo */}
        <div className="flex-shrink-0 relative">
          <div className={`
            w-16 h-16 rounded-xl flex items-center justify-center overflow-hidden
            ${isDark ? "bg-white/5" : "bg-black/5"}
          `}>
            {restaurant.logo_url ? (
              <img
                src={restaurant.logo_url}
                alt={restaurant.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <Utensils className={`w-8 h-8 ${isDark ? "text-white/40" : "text-black/40"}`} />
            )}
          </div>
          
          {/* Promoted Badge */}
          {restaurant.is_promoted && (
            <div className="absolute -top-1 -right-1 bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-sm">
              AD
            </div>
          )}
        </div>

        {/* Restaurant Info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className={`
                  font-semibold text-sm sm:text-base truncate
                  ${isDark ? "text-white" : "text-black"}
                `}>
                  {restaurant.name}
                </h3>
                {!restaurant.is_open && (
                  <span className={`
                    text-xs px-2 py-0.5 rounded-full
                    ${isDark ? "bg-red-900/50 text-red-300" : "bg-red-100 text-red-600"}
                  `}>
                    Closed
                  </span>
                )}
              </div>
              <p className={`
                text-xs sm:text-sm mt-0.5 truncate
                ${isDark ? "text-white/60" : "text-black/60"}
              `}>
                {restaurant.cuisines.map((c) => c.name).join(" • ")}
              </p>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={handleFavoriteClick}
                className={`
                  p-1.5 rounded-full transition-colors
                  ${isFavorite
                    ? "text-red-500 hover:text-red-600"
                    : isDark
                      ? "text-white/40 hover:text-white/60"
                      : "text-black/40 hover:text-black/60"
                  }
                `}
              >
                <Heart
                  className="w-4 h-4"
                  fill={isFavorite ? "currentColor" : "none"}
                />
              </button>
              <ChevronRight className={`
                w-4 h-4
                ${isDark ? "text-white/40" : "text-black/40"}
              `} />
            </div>
          </div>

          {/* Meta Info Row */}
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            {/* Rating */}
            <div className="flex items-center gap-1">
              <span className={`
                inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full
                ${getRatingColor(restaurant.rating)}
              `}>
                <Star className="w-3 h-3 text-white fill-white" />
                <span className="text-white font-medium">{restaurant.rating.toFixed(1)}</span>
              </span>
              <span className={`text-xs ${isDark ? "text-white/40" : "text-black/40"}`}>
                ({restaurant.review_count})
              </span>
            </div>

            {/* Delivery Time */}
            <div className={`
              flex items-center gap-1 text-xs
              ${isDark ? "text-white/50" : "text-black/50"}
            `}>
              <Clock className="w-3 h-3" />
              <span>{deliveryTimeText}</span>
            </div>

            {/* Distance */}
            <div className={`
              flex items-center gap-1 text-xs
              ${isDark ? "text-white/50" : "text-black/50"}
            `}>
              <MapPin className="w-3 h-3" />
              <span>{restaurant.distance_km.toFixed(1)} km</span>
            </div>

            {/* Free Delivery Badge */}
            {restaurant.has_free_delivery && (
              <div className={`
                inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full
                ${isDark ? "bg-green-600/30 text-green-300" : "bg-green-100 text-green-700"}
              `}>
                <Bike className="w-3 h-3" />
                <span className="font-medium">Free</span>
              </div>
            )}

            {/* Discount Badge */}
            {restaurant.discount_percent > 0 && (
              <div className={`
                inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full
                ${isDark ? "bg-orange-600/30 text-orange-300" : "bg-orange-100 text-orange-700"}
              `}>
                <Percent className="w-3 h-3" />
                <span className="font-medium">{restaurant.discount_percent}% off</span>
              </div>
            )}
          </div>

          {/* Delivery Fee & Minimum Order */}
          <div className={`
            flex items-center gap-3 mt-1.5 text-xs
            ${isDark ? "text-white/40" : "text-black/40"}
          `}>
            <span>Delivery: AED {restaurant.delivery_fee.toFixed(0)}</span>
            <span>•</span>
            <span>Min: AED {restaurant.minimum_order.toFixed(0)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Main App Component
// =============================================================================

function DeliveryRestaurantsApp() {
  const toolOutput = useOpenAiGlobal("toolOutput") as RestaurantsToolOutput | null;
  const theme = useOpenAiGlobal("theme");
  const displayMode = useDisplayMode();
  const maxHeight = useMaxHeight();
  const isDark = theme === "dark";
  const isFullscreen = displayMode === "fullscreen";

  const [widgetState, setWidgetState] = useWidgetState<RestaurantsWidgetState & Record<string, unknown>>({
    favorites: [],
    sortBy: "rating",
    sortOrder: "desc",
  });

  const [showFilters, setShowFilters] = useState(false);

  const restaurants = toolOutput?.restaurants || [];
  const totalCount = toolOutput?.total_count || restaurants.length;
  const areaName = toolOutput?.location?.area_name || "your area";
  const favorites = widgetState?.favorites || [];

  // Sort restaurants
  const sortRestaurants = (
    restaurants: RestaurantData[],
    sortBy: string,
    sortOrder: "asc" | "desc"
  ): RestaurantData[] => {
    return [...restaurants].sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case "rating":
          comparison = a.rating - b.rating;
          break;
        case "name":
          comparison = a.name.localeCompare(b.name);
          break;
        case "delivery_time":
          comparison = a.delivery_time_min - b.delivery_time_min;
          break;
        case "distance":
          comparison = a.distance_km - b.distance_km;
          break;
        default:
          comparison = 0;
      }

      return sortOrder === "desc" ? -comparison : comparison;
    });
  };

  const sortedRestaurants = sortRestaurants(
    restaurants,
    widgetState?.sortBy || "rating",
    widgetState?.sortOrder || "desc"
  );

  const handleToggleFavorite = (restaurantId: string) => {
    const newFavorites = favorites.includes(restaurantId)
      ? favorites.filter((id) => id !== restaurantId)
      : [...favorites, restaurantId];

    setWidgetState((prev) => ({ ...prev, favorites: newFavorites }));
  };

  const handleRestaurantClick = (restaurantId: string) => {
    setWidgetState((prev) => ({
      ...prev,
      selectedRestaurant: restaurantId,
    }));

    // Send follow-up message
    if (window.openai) {
      const restaurant = restaurants.find((r) => r.id === restaurantId);
      window.openai.sendFollowUpMessage({
        prompt: `Show me the menu for ${restaurant?.name}`,
      });
    }
  };

  const handleSort = (sortBy: string) => {
    const newSortOrder =
      widgetState?.sortBy === sortBy && widgetState?.sortOrder === "desc"
        ? "asc"
        : "desc";

    setWidgetState((prev) => ({
      ...prev,
      sortBy: sortBy as any,
      sortOrder: newSortOrder,
    }));
  };

  const handleRequestFullscreen = () => {
    if (window.openai) {
      window.openai.requestDisplayMode({ mode: "fullscreen" });
    }
  };

  return (
    <div
      className={`
        antialiased w-full text-black px-4 pb-2 overflow-hidden
        ${isDark ? "bg-gray-900 text-white" : "bg-white"}
      `}
      style={{
        fontFamily: '"Trebuchet MS", "Gill Sans", "Lucida Grande", sans-serif',
      }}
    >
      <style>{animationStyles}</style>
      
      <div className="max-w-full">
        {/* Header */}
        <div
          className="flex flex-row items-center gap-4 sm:gap-4 border-b border-black/5 py-4"
          style={{ animation: "fadeUp 0.6s ease-out both" }}
        >
          <div className={`
            sm:w-18 w-16 aspect-square rounded-xl flex items-center justify-center
            bg-gradient-to-br from-orange-500 to-red-600 shadow-lg
          `}>
            <Truck className="w-8 h-8 text-white" />
          </div>

          <div className="min-w-0 flex-1">
            <p className={`
              text-xs font-semibold uppercase tracking-[0.15em] mb-0.5
              ${isDark ? "text-white/50" : "text-black/50"}
            `}>
              Food Delivery
            </p>
            <div className={`
              text-base sm:text-xl font-bold
              ${isDark ? "text-white" : "text-black"}
            `}>
              Nearby Restaurants
            </div>
            <div className={`
              text-sm
              ${isDark ? "text-white/60" : "text-black/60"}
            `}>
              {totalCount} restaurant{totalCount !== 1 ? "s" : ""} near {areaName}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isFullscreen && (
              <button
                onClick={handleRequestFullscreen}
                className={`
                  p-2 rounded-full transition-colors
                  ${isDark ? "hover:bg-white/10" : "hover:bg-black/5"}
                `}
              >
                <MoreHorizontal className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Filters and Sort */}
        <div
          className={`
            flex items-center justify-between py-3 border-b
            ${isDark ? "border-white/10" : "border-black/5"}
          `}
          style={{ animation: "fadeUp 0.6s ease-out both", animationDelay: "50ms" }}
        >
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`
                flex items-center gap-1 px-3 py-1.5 rounded-full text-sm transition-colors
                ${showFilters
                  ? "bg-orange-100 text-orange-700"
                  : isDark
                    ? "hover:bg-white/10 text-white/70"
                    : "hover:bg-black/5 text-black/70"
                }
              `}
            >
              <Filter className="w-4 h-4" />
              Filters
            </button>
          </div>

          <div className="flex items-center gap-1 overflow-x-auto">
            {[
              { key: "rating", label: "Rating" },
              { key: "delivery_time", label: "Time" },
              { key: "distance", label: "Distance" },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => handleSort(key)}
                className={`
                  flex items-center gap-1 px-3 py-1.5 rounded-full text-sm transition-colors whitespace-nowrap
                  ${widgetState?.sortBy === key
                    ? "bg-orange-100 text-orange-700"
                    : isDark
                      ? "hover:bg-white/10 text-white/70"
                      : "hover:bg-black/5 text-black/70"
                  }
                `}
              >
                {label}
                {widgetState?.sortBy === key &&
                  (widgetState.sortOrder === "desc" ? (
                    <SortDesc className="w-3.5 h-3.5" />
                  ) : (
                    <SortAsc className="w-3.5 h-3.5" />
                  ))}
              </button>
            ))}
          </div>
        </div>

        {/* Restaurants List */}
        <div
          className="min-w-full text-sm flex flex-col overflow-y-auto"
          style={{
            maxHeight: isFullscreen
              ? "none"
              : maxHeight !== null && isFinite(maxHeight)
                ? Math.max(300, maxHeight - 200)
                : "70vh",
          }}
        >
          {sortedRestaurants.length > 0 ? (
            sortedRestaurants.map((restaurant, index) => (
              <RestaurantCard
                key={restaurant.id}
                restaurant={restaurant}
                isFavorite={favorites.includes(restaurant.id)}
                onToggleFavorite={handleToggleFavorite}
                onClick={handleRestaurantClick}
                theme={theme}
                index={index}
              />
            ))
          ) : (
            <div
              className={`
                py-12 text-center
                ${isDark ? "text-white/60" : "text-black/60"}
              `}
              style={{ animation: "fadeUp 0.5s ease-out both" }}
            >
              <Utensils className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">No restaurants found</p>
              <p className="text-sm">Try adjusting your location or filters</p>
            </div>
          )}
        </div>

        {/* Load More */}
        {toolOutput?.has_more && (
          <div
            className="py-4 text-center"
            style={{ animation: "fadeUp 0.5s ease-out both", animationDelay: "300ms" }}
          >
            <button
              onClick={() => {
                if (window.openai) {
                  window.openai.sendFollowUpMessage({
                    prompt: "Show me more restaurants",
                  });
                }
              }}
              className={`
                px-6 py-2.5 rounded-full text-sm font-semibold transition-all duration-300
                bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700
                text-white shadow-lg hover:shadow-xl hover:scale-105
              `}
            >
              Load more restaurants
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

const container = document.getElementById("delivery-restaurants-root");
if (container) {
  const root = createRoot(container);
  root.render(
    <Suspense fallback={<div className="p-4 text-center">Loading restaurants...</div>}>
      <DeliveryRestaurantsApp />
    </Suspense>
  );
}
