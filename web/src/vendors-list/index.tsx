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
    MoreHorizontal,
    SortAsc,
    SortDesc,
    Star,
    Store,
} from "lucide-react";

// Vendors List Widget Types
export interface CuisineData {
    id: number;
    name: string;
    slug: string;
}

export interface VendorData {
    id: number;
    name: string;
    business_name: string;
    rating: number;
    rating_text: string;
    delivery_time: string;
    time_estimation: string;
    cuisines: CuisineData[];
    is_talabat_pro: boolean;
    logo: string;
    cover_image: string;
    latitude: string;
    longitude: string;
}

export interface VendorsToolOutput {
    vendors: VendorData[];
    total_vendors: number;
    base_url: string;
}

export interface VendorsWidgetState {
    favorites: number[];
    sortBy: "rating" | "name" | "delivery_time";
    sortOrder: "asc" | "desc";
    viewMode: "list" | "detail";
    selectedVendor?: number;
}

interface VendorCardProps {
    vendor: VendorData;
    isFavorite: boolean;
    onToggleFavorite: (id: number) => void;
    onClick: (id: number) => void;
    baseImageUrl?: string;
    theme?: string | null;
}

function VendorCard({
    vendor,
    isFavorite,
    onToggleFavorite,
    onClick,
    baseImageUrl,
    theme,
}: VendorCardProps) {
    const isDark = theme === "dark";
    const handleCardClick = () => {
        onClick(vendor.id);
    };

    const handleFavoriteClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onToggleFavorite(vendor.id);
    };

    const getRatingColor = (rating: number) => {
        if (rating >= 4.5) return isDark ? "bg-green-600" : "bg-green-500";
        if (rating >= 4.0) return isDark ? "bg-blue-600" : "bg-blue-500";
        if (rating >= 3.5) return isDark ? "bg-yellow-600" : "bg-yellow-500";
        return isDark ? "bg-orange-600" : "bg-orange-500";
    };

    return (
        <div
            className={`
        px-3 -mx-2 rounded-2xl cursor-pointer transition-colors
        ${isDark ? "hover:bg-white/10" : "hover:bg-black/5"}
      `}
            onClick={handleCardClick}
        >
            <div className="flex w-full items-center gap-3 py-3 border-b border-black/5 last:border-b-0">
                <div className="flex-shrink-0">
                    <div
                        className={`
            w-16 h-16 rounded-lg flex items-center justify-center overflow-hidden
            ${isDark ? "bg-white/5" : "bg-black/5"}
          `}
                    >
                        <img
                            src={`${baseImageUrl}${vendor.logo}`}
                            alt={vendor.name}
                            className="w-full h-full object-cover"
                        />
                    </div>
                </div>

                <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                            <h3
                                className={`
                font-medium text-sm sm:text-base truncate
                ${isDark ? "text-white" : "text-black"}
              `}
                            >
                                {vendor.name}
                            </h3>
                            <p
                                className={`
                text-xs sm:text-sm mt-1 truncate
                ${isDark ? "text-white/70" : "text-black/70"}
              `}
                            >
                                {vendor.business_name}
                            </p>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                            <button
                                onClick={handleFavoriteClick}
                                className={`
                  p-1 rounded-full transition-colors
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
                            <ChevronRight
                                className={`
                w-4 h-4
                ${isDark ? "text-white/40" : "text-black/40"}
              `}
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                        <div className="flex items-center gap-1">
                            <span
                                className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs rounded-full ${getRatingColor(
                                    vendor.rating
                                )}`}
                            >
                                <Star className="w-3 h-3 text-white fill-white" />
                                <span className="text-white font-medium">{vendor.rating}</span>
                            </span>
                        </div>

                        <div
                            className={`
              flex items-center gap-1 text-xs
              ${isDark ? "text-white/50" : "text-black/50"}
            `}
                        >
                            <Clock className="w-3 h-3" />
                            <span>{vendor.time_estimation}</span>
                        </div>

                        {vendor.is_talabat_pro && (
                            <div
                                className={`
                inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full
                ${isDark ? "bg-purple-600" : "bg-purple-500"}
              `}
                            >
                                <span className="text-white font-medium">PRO</span>
                            </div>
                        )}
                    </div>

                    {vendor.cuisines && vendor.cuisines.length > 0 && (
                        <div
                            className={`
              text-xs mt-2 truncate
              ${isDark ? "text-white/50" : "text-black/50"}
            `}
                        >
                            {vendor.cuisines.map((c) => c.name).join(", ")}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function VendorsListApp() {
    const toolOutput = useOpenAiGlobal("toolOutput") as VendorsToolOutput | null;
    const theme = useOpenAiGlobal("theme");
    const displayMode = useDisplayMode();
    const maxHeight = useMaxHeight();
    const isDark = theme === "dark";
    const isFullscreen = displayMode === "fullscreen";

    const [widgetState, setWidgetState] = useWidgetState<VendorsWidgetState & Record<string, unknown>>({
        favorites: [],
        sortBy: "rating",
        sortOrder: "desc",
        viewMode: "list",
    });

    const [showFilters, setShowFilters] = useState(false);

    const vendors = toolOutput?.vendors || [];
    const totalCount = toolOutput?.total_vendors || vendors.length;
    const baseImageUrl = "https://images.dhmedia.io/image/talabat/restaurants/";
    const favorites = widgetState?.favorites || [];

    // Sort vendors
    const sortVendors = (
        vendors: VendorData[],
        sortBy: string,
        sortOrder: "asc" | "desc"
    ): VendorData[] => {
        return [...vendors].sort((a, b) => {
            let comparison = 0;

            switch (sortBy) {
                case "rating":
                    comparison = a.rating - b.rating;
                    break;
                case "name":
                    comparison = a.name.localeCompare(b.name);
                    break;
                case "delivery_time":
                    // Extract numeric value from delivery time string (e.g., "Within 27 mins")
                    const aTime = parseInt(a.time_estimation.match(/\d+/)?.[0] || "0");
                    const bTime = parseInt(b.time_estimation.match(/\d+/)?.[0] || "0");
                    comparison = aTime - bTime;
                    break;
                default:
                    comparison = 0;
            }

            return sortOrder === "desc" ? -comparison : comparison;
        });
    };

    const sortedVendors = sortVendors(
        vendors,
        widgetState?.sortBy || "rating",
        widgetState?.sortOrder || "desc"
    );

    const handleToggleFavorite = (vendorId: number) => {
        const newFavorites = favorites.includes(vendorId)
            ? favorites.filter((id) => id !== vendorId)
            : [...favorites, vendorId];

        setWidgetState((prev) => ({ ...prev, favorites: newFavorites }));
    };

    const handleVendorClick = (vendorId: number) => {
        setWidgetState((prev) => ({
            ...prev,
            selectedVendor: vendorId,
            viewMode: "detail",
        }));

        // Send follow-up message
        if (window.openai) {
            window.openai.sendFollowUpMessage({
                prompt: `Show me the menu for ${vendors.find((v) => v.id === vendorId)?.name
                    }`,
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
        >
            <div className="max-w-full">
                {/* Header */}
                <div className="flex flex-row items-center gap-4 sm:gap-4 border-b border-black/5 py-4">
                    <div
                        className={`
            sm:w-18 w-16 aspect-square rounded-xl flex items-center justify-center
            ${isDark ? "bg-orange-600" : "bg-orange-500"}
          `}
                    >
                        <Store className="w-8 h-8 text-white" />
                    </div>

                    <div className="min-w-0 flex-1">
                        <div
                            className={`
              text-base sm:text-xl font-medium
              ${isDark ? "text-white" : "text-black"}
            `}
                        >
                            Vendors & Restaurants
                        </div>
                        <div
                            className={`
              text-sm
              ${isDark ? "text-white/60" : "text-black/60"}
            `}
                        >
                            {totalCount} vendor{totalCount !== 1 ? "s" : ""} available
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
                <div className="flex items-center justify-between py-3 border-b border-black/5">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={`
                flex items-center gap-1 px-3 py-1 rounded-full text-sm transition-colors
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

                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => handleSort("rating")}
                            className={`
                flex items-center gap-1 px-3 py-1 rounded-full text-sm transition-colors
                ${widgetState?.sortBy === "rating"
                                    ? "bg-orange-100 text-orange-700"
                                    : isDark
                                        ? "hover:bg-white/10 text-white/70"
                                        : "hover:bg-black/5 text-black/70"
                                }
              `}
                        >
                            Rating
                            {widgetState?.sortBy === "rating" &&
                                (widgetState.sortOrder === "desc" ? (
                                    <SortDesc className="w-4 h-4" />
                                ) : (
                                    <SortAsc className="w-4 h-4" />
                                ))}
                        </button>

                        <button
                            onClick={() => handleSort("delivery_time")}
                            className={`
                flex items-center gap-1 px-3 py-1 rounded-full text-sm transition-colors
                ${widgetState?.sortBy === "delivery_time"
                                    ? "bg-orange-100 text-orange-700"
                                    : isDark
                                        ? "hover:bg-white/10 text-white/70"
                                        : "hover:bg-black/5 text-black/70"
                                }
              `}
                        >
                            Delivery
                            {widgetState?.sortBy === "delivery_time" &&
                                (widgetState.sortOrder === "desc" ? (
                                    <SortDesc className="w-4 h-4" />
                                ) : (
                                    <SortAsc className="w-4 h-4" />
                                ))}
                        </button>
                    </div>
                </div>

                {/* Vendors List */}
                <div
                    className="min-w-full text-sm flex flex-col"
                    style={{
                        maxHeight: isFullscreen
                            ? "none"
                            : maxHeight !== null && isFinite(maxHeight)
                                ? Math.max(300, maxHeight - 200)
                                : "70vh",
                    }}
                >
                    {sortedVendors.length > 0 ? (
                        sortedVendors.map((vendor) => (
                            <VendorCard
                                key={vendor.id}
                                vendor={vendor}
                                isFavorite={favorites.includes(vendor.id)}
                                onToggleFavorite={handleToggleFavorite}
                                onClick={handleVendorClick}
                                baseImageUrl={baseImageUrl}
                                theme={theme}
                            />
                        ))
                    ) : (
                        <div
                            className={`
              py-12 text-center
              ${isDark ? "text-white/60" : "text-black/60"}
            `}
                        >
                            <Store className="w-12 h-12 mx-auto mb-4 opacity-50" />
                            <p className="text-lg font-medium mb-2">No vendors found</p>
                            <p className="text-sm">Try adjusting your search location</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
        ;
}

// Mount the component with Suspense
const container = document.getElementById("vendors-list-root");
if (container) {
    const root = createRoot(container);
    root.render(
        <Suspense fallback={<div className="p-4 text-center">Loading vendors...</div>}>
            <VendorsListApp />
        </Suspense>
    );
}
