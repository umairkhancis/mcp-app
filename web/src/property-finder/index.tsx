import { Suspense, useState, useMemo } from "react";
import { createRoot } from "react-dom/client";
import "../index.css";
import { useDisplayMode } from "../use-display-mode";
import { useMaxHeight } from "../use-max-height";
import { useOpenAiGlobal } from "../use-openai-global";
import { useWidgetState } from "../use-widget-state";

import {
  ArrowLeft,
  Bed,
  Bath,
  Maximize2,
  Heart,
  MapPin,
  Phone,
  Building2,
  Home,
  Building,
  Store,
  Filter,
  X,
  Star,
  BadgeCheck,
  MoreHorizontal,
  Grid3X3,
  List,
} from "lucide-react";

// =============================================================================
// Type Definitions (The Contract with MCP Server)
// =============================================================================

export interface PropertyData {
  id: string;
  title: string;
  description: string;
  property_type: "apartment" | "villa" | "townhouse" | "commercial";
  purpose: "rent" | "buy";
  price: number;
  currency: string;
  price_period?: string; // "monthly", "yearly" for rentals
  bedrooms: number;
  bathrooms: number;
  size_sqft: number;
  location: {
    area_name: string;
    city: string;
    lat: number;
    lng: number;
  };
  amenities: string[];
  image_urls: string[];
  agent: {
    name: string;
    company: string;
    phone: string;
    image_url: string;
  };
  is_featured: boolean;
  is_verified: boolean;
  listing_date: string;
}

export interface FilterOption {
  id: string;
  label: string;
  icon?: string;
}

export interface PropertyFinderToolOutput {
  properties: PropertyData[];
  total_count: number;
  filters_applied: {
    property_type?: string;
    bedrooms?: number;
    location?: string;
    purpose?: string;
  };
  available_locations: FilterOption[];
}

export interface PropertyFinderWidgetState {
  favorites: string[];
  selectedPropertyId?: string;
  viewMode: "grid" | "list";
  activeFilters: {
    property_type?: string;
    bedrooms?: number;
    location?: string;
    purpose?: string;
  };
  showFilters: boolean;
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
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
  }
  @keyframes slideUp {
    from { opacity: 0; transform: translateY(100%); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
`;

// Property Finder Logo
const PROPERTY_FINDER_LOGO = "data:image/png;base64,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";

// =============================================================================
// Constants
// =============================================================================

const PROPERTY_TYPES: FilterOption[] = [
  { id: "apartment", label: "Apartment" },
  { id: "villa", label: "Villa" },
  { id: "townhouse", label: "Townhouse" },
  { id: "commercial", label: "Commercial" },
];

const BEDROOM_OPTIONS: FilterOption[] = [
  { id: "any", label: "Any" },
  { id: "1", label: "1" },
  { id: "2", label: "2" },
  { id: "3", label: "3" },
  { id: "4", label: "4" },
  { id: "5", label: "5+" },
];

const PURPOSE_OPTIONS: FilterOption[] = [
  { id: "rent", label: "Rent" },
  { id: "buy", label: "Buy" },
];

// =============================================================================
// Helper Components
// =============================================================================

const getPropertyTypeIcon = (type: string) => {
  switch (type) {
    case "apartment":
      return <Building2 className="w-4 h-4" />;
    case "villa":
      return <Home className="w-4 h-4" />;
    case "townhouse":
      return <Building className="w-4 h-4" />;
    case "commercial":
      return <Store className="w-4 h-4" />;
    default:
      return <Building2 className="w-4 h-4" />;
  }
};

const formatPrice = (price: number, currency: string, purpose: string, period?: string): string => {
  const formattedPrice = price.toLocaleString();
  if (purpose === "rent" && period) {
    return `${currency} ${formattedPrice}/${period === "yearly" ? "year" : "month"}`;
  }
  return `${currency} ${formattedPrice}`;
};

// =============================================================================
// Filter Panel Overlay Component
// =============================================================================

interface FilterPanelProps {
  isOpen: boolean;
  onClose: () => void;
  activeFilters: {
    property_type?: string;
    bedrooms?: number;
    location?: string;
    purpose?: string;
  };
  onFilterChange: (key: string, value: string | number | undefined) => void;
  onClearFilters: () => void;
  onApplyFilters: () => void;
  locationOptions: FilterOption[];
  isDark: boolean;
}

function FilterPanel({
  isOpen,
  onClose,
  activeFilters,
  onFilterChange,
  onClearFilters,
  onApplyFilters,
  locationOptions,
  isDark,
}: FilterPanelProps) {
  if (!isOpen) return null;

  const activeFilterCount = Object.values(activeFilters).filter(Boolean).length;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        style={{ animation: "fadeIn 0.2s ease-out" }}
      />

      {/* Panel */}
      <div
        className={`
          absolute bottom-0 left-0 right-0 rounded-t-3xl shadow-2xl
          max-h-[85vh] overflow-y-auto
          ${isDark ? "bg-gray-900" : "bg-white"}
        `}
        style={{ animation: "slideUp 0.3s ease-out" }}
      >
        {/* Handle */}
        <div className="sticky top-0 z-10 px-4 pt-3 pb-4 ${isDark ? 'bg-gray-900' : 'bg-white'}">
          <div className={`w-12 h-1.5 rounded-full mx-auto mb-4 ${isDark ? "bg-white/20" : "bg-black/20"}`} />
          
          <div className="flex items-center justify-between">
            <h2 className={`text-xl font-bold ${isDark ? "text-white" : "text-black"}`}>
              Filters
            </h2>
            <button
              onClick={onClose}
              className={`p-2 rounded-full transition-colors ${isDark ? "hover:bg-white/10" : "hover:bg-black/5"}`}
            >
              <X className={`w-6 h-6 ${isDark ? "text-white/70" : "text-black/70"}`} />
            </button>
          </div>
        </div>

        <div className="px-4 pb-6 space-y-6">
          {/* Purpose Filter */}
          <div>
            <label className={`block text-sm font-semibold mb-3 ${isDark ? "text-white/70" : "text-black/70"}`}>
              Purpose
            </label>
            <div className="flex gap-3">
              {PURPOSE_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  onClick={() => onFilterChange("purpose", activeFilters.purpose === option.id ? undefined : option.id)}
                  className={`
                    flex-1 py-3.5 px-4 rounded-xl font-semibold text-sm transition-all duration-200 border-2
                    ${activeFilters.purpose === option.id
                      ? isDark
                        ? "border-red-500 bg-red-500/20 text-red-400"
                        : "border-red-500 bg-red-50 text-red-600"
                      : isDark
                        ? "border-transparent bg-white/10 text-white/80 hover:bg-white/15"
                        : "border-transparent bg-gray-100 text-black/70 hover:bg-gray-200"
                    }
                  `}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Property Type Filter */}
          <div>
            <label className={`block text-sm font-semibold mb-3 ${isDark ? "text-white/70" : "text-black/70"}`}>
              Property Type
            </label>
            <div className="grid grid-cols-2 gap-3">
              {PROPERTY_TYPES.map((option) => (
                <button
                  key={option.id}
                  onClick={() => onFilterChange("property_type", activeFilters.property_type === option.id ? undefined : option.id)}
                  className={`
                    flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl font-semibold text-sm transition-all duration-200 border-2
                    ${activeFilters.property_type === option.id
                      ? isDark
                        ? "border-red-500 bg-red-500/20 text-red-400"
                        : "border-red-500 bg-red-50 text-red-600"
                      : isDark
                        ? "border-transparent bg-white/10 text-white/80 hover:bg-white/15"
                        : "border-transparent bg-gray-100 text-black/70 hover:bg-gray-200"
                    }
                  `}
                >
                  {option.id === "apartment" && <Building2 className="w-4 h-4" />}
                  {option.id === "villa" && <Home className="w-4 h-4" />}
                  {option.id === "townhouse" && <Building className="w-4 h-4" />}
                  {option.id === "commercial" && <Store className="w-4 h-4" />}
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Bedrooms Filter */}
          <div>
            <label className={`block text-sm font-semibold mb-3 ${isDark ? "text-white/70" : "text-black/70"}`}>
              Bedrooms
            </label>
            <div className="flex gap-2 flex-wrap">
              {BEDROOM_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  onClick={() => onFilterChange("bedrooms", option.id === "any" ? undefined : (activeFilters.bedrooms?.toString() === option.id ? undefined : parseInt(option.id)))}
                  className={`
                    min-w-[50px] py-3 px-4 rounded-xl font-semibold text-sm transition-all duration-200 border-2
                    ${(option.id === "any" && !activeFilters.bedrooms) || activeFilters.bedrooms?.toString() === option.id
                      ? isDark
                        ? "border-red-500 bg-red-500/20 text-red-400"
                        : "border-red-500 bg-red-50 text-red-600"
                      : isDark
                        ? "border-transparent bg-white/10 text-white/80 hover:bg-white/15"
                        : "border-transparent bg-gray-100 text-black/70 hover:bg-gray-200"
                    }
                  `}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Location Filter */}
          <div>
            <label className={`block text-sm font-semibold mb-3 ${isDark ? "text-white/70" : "text-black/70"}`}>
              Location
            </label>
            <div className="flex gap-2 flex-wrap max-h-48 overflow-y-auto">
              {locationOptions.map((option) => (
                <button
                  key={option.id}
                  onClick={() => onFilterChange("location", option.id === "any" ? undefined : (activeFilters.location === option.id ? undefined : option.id))}
                  className={`
                    py-2.5 px-4 rounded-full font-semibold text-sm transition-all duration-200 border-2
                    ${(option.id === "any" && !activeFilters.location) || activeFilters.location === option.id
                      ? isDark
                        ? "border-red-500 bg-red-500/20 text-red-400"
                        : "border-red-500 bg-red-50 text-red-600"
                      : isDark
                        ? "border-transparent bg-white/10 text-white/80 hover:bg-white/15"
                        : "border-transparent bg-gray-100 text-black/70 hover:bg-gray-200"
                    }
                  `}
                >
                  {option.id === "any" && <MapPin className="w-3.5 h-3.5 inline mr-1" />}
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className={`
          sticky bottom-0 px-4 py-4 border-t flex gap-3
          ${isDark ? "bg-gray-900 border-white/10" : "bg-white border-black/10"}
        `}>
          {activeFilterCount > 0 && (
            <button
              onClick={onClearFilters}
              className={`
                flex-1 py-3.5 px-4 rounded-xl font-semibold text-sm transition-all duration-200
                ${isDark
                  ? "bg-white/10 text-white hover:bg-white/15"
                  : "bg-gray-100 text-black/70 hover:bg-gray-200"
                }
              `}
            >
              Clear All
            </button>
          )}
          <button
            onClick={onApplyFilters}
            className={`
              ${activeFilterCount > 0 ? "flex-1" : "w-full"} py-3.5 px-4 rounded-xl font-semibold text-sm
              bg-gradient-to-r from-teal-500 to-emerald-500 text-white
              hover:from-teal-600 hover:to-emerald-600 transition-all duration-200 shadow-lg
            `}
          >
            Show Results {activeFilterCount > 0 && `(${activeFilterCount} filters)`}
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Active Filter Chip Component
// =============================================================================

interface FilterChipProps {
  label: string;
  value: string;
  onRemove: () => void;
  isDark: boolean;
}

function FilterChip({ label, value, onRemove, isDark }: FilterChipProps) {
  return (
    <span
      className={`
        inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium
        ${isDark
          ? "bg-teal-500/20 text-teal-300"
          : "bg-teal-100 text-teal-700"
        }
      `}
    >
      <span className="opacity-60">{label}:</span>
      <span>{value}</span>
      <button
        onClick={onRemove}
        className={`ml-0.5 p-0.5 rounded-full hover:bg-black/10 transition-colors`}
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </span>
  );
}

// =============================================================================
// Property Card Component
// =============================================================================

interface PropertyCardProps {
  property: PropertyData;
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
  onContact: (property: PropertyData) => void;
  index: number;
  isDark: boolean;
  viewMode: "grid" | "list";
}

function PropertyCard({
  property,
  isFavorite,
  onToggleFavorite,
  onContact,
  index,
  isDark,
  viewMode,
}: PropertyCardProps) {
  const isListView = viewMode === "list";

  return (
    <div
      className={`
        relative rounded-2xl overflow-hidden transition-all duration-300
        ${isDark
          ? "bg-gray-800/50 border border-white/10 hover:border-white/20"
          : "bg-white border border-black/10 hover:border-black/20 hover:shadow-lg"
        }
        ${isListView ? "flex" : ""}
      `}
      style={{
        animation: "fadeUp 0.5s ease-out both",
        animationDelay: `${100 + index * 60}ms`,
      }}
    >
      {/* Property Image */}
      <div className={`relative ${isListView ? "w-72 flex-shrink-0" : "aspect-[16/10]"}`}>
        {property.image_urls && property.image_urls.length > 0 ? (
          <img
            src={property.image_urls[0]}
            alt={property.title}
            className={`w-full h-full object-cover ${isListView ? "aspect-[4/3]" : ""}`}
          />
        ) : (
          <div className={`w-full h-full flex items-center justify-center ${isDark ? "bg-gray-700" : "bg-gray-100"}`}>
            <Building2 className={`w-12 h-12 ${isDark ? "text-white/20" : "text-black/20"}`} />
          </div>
        )}

        {/* Badges */}
        <div className="absolute top-3 left-3 flex flex-wrap gap-2">
          {property.is_featured && (
            <span className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 shadow-md">
              <Star className="w-3 h-3" />
              Featured
            </span>
          )}
          {property.is_verified && (
            <span className="bg-gradient-to-r from-teal-500 to-emerald-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 shadow-md">
              <BadgeCheck className="w-3 h-3" />
              Verified
            </span>
          )}
          <span className={`
            text-[10px] font-bold px-2.5 py-1 rounded-full shadow-md capitalize
            ${property.purpose === "rent"
              ? "bg-blue-500 text-white"
              : "bg-purple-500 text-white"
            }
          `}>
            For {property.purpose}
          </span>
        </div>

        {/* Favorite Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(property.id);
          }}
          className={`
            absolute top-3 right-3 p-2.5 rounded-full transition-all duration-200
            shadow-md backdrop-blur-sm
            ${isFavorite
              ? "bg-red-500 text-white scale-110"
              : isDark
                ? "bg-black/50 text-white/80 hover:text-red-400 hover:bg-black/70"
                : "bg-white/90 text-black/40 hover:text-red-500 hover:bg-white"
            }
          `}
        >
          <Heart
            className="w-4 h-4"
            fill={isFavorite ? "currentColor" : "none"}
          />
        </button>

        {/* Property Type Badge */}
        <div className={`
          absolute bottom-3 left-3 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg
          backdrop-blur-sm text-xs font-medium capitalize
          ${isDark ? "bg-black/50 text-white" : "bg-white/90 text-black/80"}
        `}>
          {getPropertyTypeIcon(property.property_type)}
          {property.property_type}
        </div>
      </div>

      {/* Property Info */}
      <div className={`p-4 ${isListView ? "flex-1 flex flex-col justify-between" : ""}`}>
        {/* Price */}
        <div className="mb-2">
          <p className={`text-xl font-bold ${isDark ? "text-white" : "text-black"}`}>
            {formatPrice(property.price, property.currency, property.purpose, property.price_period)}
          </p>
        </div>

        {/* Title */}
        <h3 className={`font-semibold text-base mb-1 line-clamp-1 ${isDark ? "text-white" : "text-black"}`}>
          {property.title}
        </h3>

        {/* Location */}
        <div className={`flex items-center gap-1.5 mb-3 ${isDark ? "text-white/60" : "text-black/60"}`}>
          <MapPin className="w-3.5 h-3.5" />
          <span className="text-sm truncate">{property.location.area_name}, {property.location.city}</span>
        </div>

        {/* Property Features */}
        <div className={`flex items-center gap-4 mb-4 ${isDark ? "text-white/70" : "text-black/70"}`}>
          <div className="flex items-center gap-1.5">
            <Bed className="w-4 h-4" />
            <span className="text-sm font-medium">{property.bedrooms}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Bath className="w-4 h-4" />
            <span className="text-sm font-medium">{property.bathrooms}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Maximize2 className="w-4 h-4" />
            <span className="text-sm font-medium">{property.size_sqft.toLocaleString()} sqft</span>
          </div>
        </div>

        {/* Agent Info & Contact */}
        <div className={`
          flex items-center justify-between pt-3 border-t
          ${isDark ? "border-white/10" : "border-black/10"}
        `}>
          <div className="flex items-center gap-2">
            {property.agent.image_url ? (
              <img
                src={property.agent.image_url}
                alt={property.agent.name}
                className="w-8 h-8 rounded-full object-cover"
              />
            ) : (
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isDark ? "bg-white/10" : "bg-black/10"}`}>
                <span className="text-xs font-bold">{property.agent.name.charAt(0)}</span>
              </div>
            )}
            <div className="min-w-0">
              <p className={`text-xs font-medium truncate ${isDark ? "text-white/90" : "text-black/90"}`}>
                {property.agent.name}
              </p>
              <p className={`text-[10px] truncate ${isDark ? "text-white/50" : "text-black/50"}`}>
                {property.agent.company}
              </p>
            </div>
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onContact(property);
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white text-sm font-medium transition-all duration-200 shadow-md hover:shadow-lg"
          >
            <Phone className="w-3.5 h-3.5" />
            Contact
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Property Detail View
// =============================================================================

interface PropertyDetailViewProps {
  property: PropertyData;
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
  onContact: (property: PropertyData) => void;
  onBack: () => void;
  isDark: boolean;
}

function PropertyDetailView({
  property,
  isFavorite,
  onToggleFavorite,
  onContact,
  onBack,
  isDark,
}: PropertyDetailViewProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  return (
    <div
      className={`min-h-screen ${isDark ? "bg-gray-900 text-white" : "bg-gray-50 text-black"}`}
      style={{
        fontFamily: '"Inter", "SF Pro Display", system-ui, sans-serif',
      }}
    >
      <style>{animationStyles}</style>

      {/* Header */}
      <header
        className={`px-4 py-4 border-b sticky top-0 z-10 backdrop-blur-sm ${isDark ? "bg-gray-900/80 border-white/10" : "bg-white/80 border-black/10"}`}
        style={{ animation: "fadeUp 0.4s ease-out both" }}
      >
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className={`p-2 rounded-full transition-colors ${isDark ? "hover:bg-white/10" : "hover:bg-black/5"}`}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold line-clamp-1">{property.title}</h1>
            <p className={`text-sm ${isDark ? "text-white/60" : "text-black/60"}`}>
              {property.location.area_name}, {property.location.city}
            </p>
          </div>
          <button
            onClick={() => onToggleFavorite(property.id)}
            className={`p-2.5 rounded-full transition-all ${isFavorite ? "bg-red-500 text-white" : isDark ? "bg-white/10 text-white/80" : "bg-black/5 text-black/60"}`}
          >
            <Heart className="w-5 h-5" fill={isFavorite ? "currentColor" : "none"} />
          </button>
        </div>
      </header>

      {/* Image Gallery */}
      <div className="relative">
        {property.image_urls && property.image_urls.length > 0 ? (
          <>
            <img
              src={property.image_urls[currentImageIndex]}
              alt={property.title}
              className="w-full aspect-[16/9] object-cover"
            />
            {property.image_urls.length > 1 && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
                {property.image_urls.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentImageIndex(idx)}
                    className={`w-2 h-2 rounded-full transition-all ${idx === currentImageIndex ? "bg-white w-6" : "bg-white/50"}`}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          <div className={`w-full aspect-[16/9] flex items-center justify-center ${isDark ? "bg-gray-800" : "bg-gray-200"}`}>
            <Building2 className={`w-16 h-16 ${isDark ? "text-white/20" : "text-black/20"}`} />
          </div>
        )}

        {/* Badges */}
        <div className="absolute top-4 left-4 flex flex-wrap gap-2">
          {property.is_featured && (
            <span className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1 shadow-md">
              <Star className="w-3.5 h-3.5" />
              Featured
            </span>
          )}
          {property.is_verified && (
            <span className="bg-gradient-to-r from-teal-500 to-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1 shadow-md">
              <BadgeCheck className="w-3.5 h-3.5" />
              Verified
            </span>
          )}
        </div>
      </div>

      {/* Property Details */}
      <div className="px-4 py-5">
        {/* Price */}
        <div className="mb-4" style={{ animation: "fadeUp 0.5s ease-out both", animationDelay: "100ms" }}>
          <p className={`text-3xl font-bold ${isDark ? "text-teal-400" : "text-teal-600"}`}>
            {formatPrice(property.price, property.currency, property.purpose, property.price_period)}
          </p>
          <p className={`text-sm mt-1 capitalize ${isDark ? "text-white/60" : "text-black/60"}`}>
            {property.property_type} for {property.purpose}
          </p>
        </div>

        {/* Features */}
        <div
          className={`flex items-center gap-6 py-4 border-y ${isDark ? "border-white/10" : "border-black/10"}`}
          style={{ animation: "fadeUp 0.5s ease-out both", animationDelay: "150ms" }}
        >
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-lg ${isDark ? "bg-white/10" : "bg-teal-50"}`}>
              <Bed className={`w-5 h-5 ${isDark ? "text-white" : "text-teal-600"}`} />
            </div>
            <div>
              <p className="font-bold">{property.bedrooms}</p>
              <p className={`text-xs ${isDark ? "text-white/60" : "text-black/60"}`}>Bedrooms</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-lg ${isDark ? "bg-white/10" : "bg-teal-50"}`}>
              <Bath className={`w-5 h-5 ${isDark ? "text-white" : "text-teal-600"}`} />
            </div>
            <div>
              <p className="font-bold">{property.bathrooms}</p>
              <p className={`text-xs ${isDark ? "text-white/60" : "text-black/60"}`}>Bathrooms</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-lg ${isDark ? "bg-white/10" : "bg-teal-50"}`}>
              <Maximize2 className={`w-5 h-5 ${isDark ? "text-white" : "text-teal-600"}`} />
            </div>
            <div>
              <p className="font-bold">{property.size_sqft.toLocaleString()}</p>
              <p className={`text-xs ${isDark ? "text-white/60" : "text-black/60"}`}>sqft</p>
            </div>
          </div>
        </div>

        {/* Description */}
        <div className="py-4" style={{ animation: "fadeUp 0.5s ease-out both", animationDelay: "200ms" }}>
          <h3 className="font-bold mb-2">Description</h3>
          <p className={`text-sm leading-relaxed ${isDark ? "text-white/70" : "text-black/70"}`}>
            {property.description}
          </p>
        </div>

        {/* Amenities */}
        {property.amenities && property.amenities.length > 0 && (
          <div className="py-4" style={{ animation: "fadeUp 0.5s ease-out both", animationDelay: "250ms" }}>
            <h3 className="font-bold mb-3">Amenities</h3>
            <div className="flex flex-wrap gap-2">
              {property.amenities.map((amenity, idx) => (
                <span
                  key={idx}
                  className={`px-3 py-1.5 rounded-full text-sm ${isDark ? "bg-white/10 text-white/80" : "bg-teal-50 text-teal-700"}`}
                >
                  {amenity}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Agent Card */}
        <div
          className={`p-4 rounded-2xl mt-4 ${isDark ? "bg-white/5" : "bg-white shadow-md"}`}
          style={{ animation: "fadeUp 0.5s ease-out both", animationDelay: "300ms" }}
        >
          <h3 className="font-bold mb-3">Listed By</h3>
          <div className="flex items-center gap-3">
            {property.agent.image_url ? (
              <img
                src={property.agent.image_url}
                alt={property.agent.name}
                className="w-14 h-14 rounded-full object-cover"
              />
            ) : (
              <div className={`w-14 h-14 rounded-full flex items-center justify-center ${isDark ? "bg-white/10" : "bg-teal-100"}`}>
                <span className="text-xl font-bold">{property.agent.name.charAt(0)}</span>
              </div>
            )}
            <div className="flex-1">
              <p className="font-semibold">{property.agent.name}</p>
              <p className={`text-sm ${isDark ? "text-white/60" : "text-black/60"}`}>{property.agent.company}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Contact Footer */}
      <div
        className={`sticky bottom-0 px-4 py-4 border-t backdrop-blur-md ${isDark ? "bg-gray-900/80 border-white/10" : "bg-white/80 border-black/10"}`}
        style={{ animation: "fadeUp 0.4s ease-out both" }}
      >
        <button
          onClick={() => onContact(property)}
          className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white font-semibold transition-all duration-300 shadow-xl hover:shadow-2xl hover:scale-[1.02]"
        >
          <Phone className="w-5 h-5" />
          Contact Agent
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// Main App Component
// =============================================================================

function PropertyFinderApp() {
  const toolOutput = useOpenAiGlobal("toolOutput") as PropertyFinderToolOutput | null;
  const theme = useOpenAiGlobal("theme");
  const displayMode = useDisplayMode();
  const maxHeight = useMaxHeight();
  const isDark = theme === "dark";
  const isFullscreen = displayMode === "fullscreen";

  const [widgetState, setWidgetState] = useWidgetState<PropertyFinderWidgetState & Record<string, unknown>>({
    favorites: [],
    viewMode: "grid",
    activeFilters: {},
    showFilters: false,
  });

  const properties = toolOutput?.properties || [];
  const totalCount = toolOutput?.total_count || properties.length;
  const availableLocations = toolOutput?.available_locations || [];

  const favorites = widgetState?.favorites || [];
  const selectedPropertyId = widgetState?.selectedPropertyId;
  const viewMode = widgetState?.viewMode || "grid";
  const activeFilters = widgetState?.activeFilters || {};
  const showFilters = widgetState?.showFilters || false;

  // Filter properties locally based on activeFilters
  const filteredProperties = useMemo(() => {
    return properties.filter((property) => {
      if (activeFilters.property_type && property.property_type !== activeFilters.property_type) {
        return false;
      }
      if (activeFilters.bedrooms && property.bedrooms !== parseInt(activeFilters.bedrooms.toString())) {
        return false;
      }
      if (activeFilters.location && property.location.area_name !== activeFilters.location) {
        return false;
      }
      if (activeFilters.purpose && property.purpose !== activeFilters.purpose) {
        return false;
      }
      return true;
    });
  }, [properties, activeFilters]);

  const selectedProperty = selectedPropertyId
    ? properties.find((p) => p.id === selectedPropertyId)
    : null;

  const handleToggleFavorite = (propertyId: string) => {
    const newFavorites = favorites.includes(propertyId)
      ? favorites.filter((id) => id !== propertyId)
      : [...favorites, propertyId];
    setWidgetState((prev) => ({ ...prev, favorites: newFavorites }));
  };

  const handleContact = (property: PropertyData) => {
    if (window.openai) {
      window.openai.sendFollowUpMessage({
        prompt: `I'm interested in "${property.title}" in ${property.location.area_name}. Please help me contact the agent ${property.agent.name} from ${property.agent.company}.`,
      });
    }
  };

  const handleViewDetails = (propertyId: string) => {
    setWidgetState((prev) => ({ ...prev, selectedPropertyId: propertyId }));
  };

  const handleBackToList = () => {
    setWidgetState((prev) => ({ ...prev, selectedPropertyId: undefined }));
  };

  const handleFilterChange = (filterKey: string, value: string | number | undefined) => {
    setWidgetState((prev) => ({
      ...prev,
      activeFilters: {
        ...prev?.activeFilters,
        [filterKey]: value,
      },
    }));
  };

  const handleClearFilters = () => {
    setWidgetState((prev) => ({ ...prev, activeFilters: {} }));
  };

  const handleToggleFilters = () => {
    setWidgetState((prev) => ({ ...prev, showFilters: !prev?.showFilters }));
  };

  const handleViewModeChange = (mode: "grid" | "list") => {
    setWidgetState((prev) => ({ ...prev, viewMode: mode }));
  };

  const handleRequestFullscreen = () => {
    if (window.openai) {
      window.openai.requestDisplayMode({ mode: "fullscreen" });
    }
  };

  const activeFilterCount = Object.values(activeFilters).filter(Boolean).length;

  // Build location options from available_locations or extract from properties
  const locationOptions: FilterOption[] = useMemo(() => {
    if (availableLocations.length > 0) {
      return [{ id: "any", label: "Any Location" }, ...availableLocations];
    }
    const locations = new Set(properties.map((p) => p.location.area_name));
    return [
      { id: "any", label: "Any Location" },
      ...Array.from(locations).map((loc) => ({ id: loc, label: loc })),
    ];
  }, [availableLocations, properties]);

  // Show detail view if a property is selected
  if (selectedProperty) {
    return (
      <PropertyDetailView
        property={selectedProperty}
        isFavorite={favorites.includes(selectedProperty.id)}
        onToggleFavorite={handleToggleFavorite}
        onContact={handleContact}
        onBack={handleBackToList}
        isDark={isDark}
      />
    );
  }

  // Helper to get filter label
  const getFilterLabel = (key: string, value: string | number | undefined): string => {
    if (!value) return "";
    if (key === "property_type") {
      const option = PROPERTY_TYPES.find(o => o.id === value);
      return option?.label || String(value);
    }
    if (key === "purpose") {
      const option = PURPOSE_OPTIONS.find(o => o.id === value);
      return option?.label || String(value);
    }
    if (key === "bedrooms") {
      return `${value} BR`;
    }
    if (key === "location") {
      const option = locationOptions.find(o => o.id === value);
      return option?.label || String(value);
    }
    return String(value);
  };

  // Main list view
  return (
    <div
      className={`
        antialiased w-full min-h-screen overflow-hidden
        ${isDark
          ? "bg-gray-900 text-white"
          : "bg-gradient-to-br from-teal-50 via-white to-emerald-50 text-black"
        }
      `}
      style={{
        fontFamily: '"Inter", "SF Pro Display", system-ui, sans-serif',
      }}
    >
      <style>{animationStyles}</style>

      {/* Filter Panel Overlay */}
      <FilterPanel
        isOpen={showFilters}
        onClose={handleToggleFilters}
        activeFilters={activeFilters}
        onFilterChange={handleFilterChange}
        onClearFilters={handleClearFilters}
        onApplyFilters={handleToggleFilters}
        locationOptions={locationOptions}
        isDark={isDark}
      />

      <div className="max-w-full">
        {/* Header */}
        <header
          className={`px-4 py-5 border-b ${isDark ? "border-white/10" : "border-black/5"}`}
          style={{ animation: "fadeUp 0.6s ease-out both" }}
        >
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl overflow-hidden shadow-lg bg-white">
              <img 
                src={PROPERTY_FINDER_LOGO} 
                alt="Property Finder" 
                className="w-12 h-12 object-contain"
              />
            </div>

            <div className="min-w-0 flex-1">
              <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${isDark ? "text-white/50" : "text-black/50"} mb-1`}>
                Real Estate
              </p>
              <h1 className="text-xl font-bold tracking-tight">
                Property Finder
              </h1>
            </div>

            <div className="flex items-center gap-2">
              {!isFullscreen && (
                <button
                  onClick={handleRequestFullscreen}
                  className={`p-2.5 rounded-full transition-colors ${isDark ? "bg-white/10 hover:bg-white/15" : "bg-white border border-black/10 hover:border-black/20 shadow-sm"}`}
                >
                  <MoreHorizontal className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>

          <p className={`text-sm mt-2 ${isDark ? "text-white/60" : "text-black/60"}`}>
            {filteredProperties.length} of {totalCount} properties available
          </p>
        </header>

        {/* Filter Bar */}
        <div
          className={`px-4 py-3 border-b ${isDark ? "border-white/10" : "border-black/5"}`}
          style={{ animation: "fadeUp 0.6s ease-out both", animationDelay: "50ms" }}
        >
          <div className="flex items-center gap-2 flex-wrap">
            {/* Filter Button */}
            <button
              onClick={handleToggleFilters}
              className={`
                flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold
                transition-all duration-200 whitespace-nowrap
                ${activeFilterCount > 0
                  ? "bg-gradient-to-r from-teal-500 to-emerald-500 text-white shadow-md"
                  : isDark
                    ? "bg-white/10 text-white border border-white/20 hover:bg-white/15"
                    : "bg-white text-black/80 border border-black/10 shadow-sm hover:border-black/20"
                }
              `}
            >
              <Filter className="w-4 h-4" />
              <span>Filters</span>
              {activeFilterCount > 0 && (
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${activeFilterCount > 0 ? "bg-white/20" : ""}`}>
                  {activeFilterCount}
                </span>
              )}
            </button>

            {/* Active Filter Chips */}
            {activeFilters.purpose && (
              <FilterChip
                label="Purpose"
                value={getFilterLabel("purpose", activeFilters.purpose)}
                onRemove={() => handleFilterChange("purpose", undefined)}
                isDark={isDark}
              />
            )}
            {activeFilters.property_type && (
              <FilterChip
                label="Type"
                value={getFilterLabel("property_type", activeFilters.property_type)}
                onRemove={() => handleFilterChange("property_type", undefined)}
                isDark={isDark}
              />
            )}
            {activeFilters.bedrooms && (
              <FilterChip
                label="Beds"
                value={getFilterLabel("bedrooms", activeFilters.bedrooms)}
                onRemove={() => handleFilterChange("bedrooms", undefined)}
                isDark={isDark}
              />
            )}
            {activeFilters.location && (
              <FilterChip
                label="Location"
                value={getFilterLabel("location", activeFilters.location)}
                onRemove={() => handleFilterChange("location", undefined)}
                isDark={isDark}
              />
            )}

            {/* Clear All Button */}
            {activeFilterCount > 0 && (
              <button
                onClick={handleClearFilters}
                className={`
                  flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium
                  transition-all duration-200
                  ${isDark
                    ? "text-red-400 hover:bg-red-500/10"
                    : "text-red-500 hover:bg-red-50"
                  }
                `}
              >
                <X className="w-4 h-4" />
                Clear all
              </button>
            )}

            {/* View Mode Toggle */}
            <div className={`ml-auto flex items-center rounded-xl overflow-hidden border ${isDark ? "border-white/20" : "border-black/10"}`}>
              <button
                onClick={() => handleViewModeChange("grid")}
                className={`p-2.5 transition-colors ${viewMode === "grid" ? (isDark ? "bg-white/20" : "bg-teal-50") : ""}`}
              >
                <Grid3X3 className={`w-4 h-4 ${viewMode === "grid" ? (isDark ? "text-white" : "text-teal-600") : (isDark ? "text-white/50" : "text-black/50")}`} />
              </button>
              <button
                onClick={() => handleViewModeChange("list")}
                className={`p-2.5 transition-colors ${viewMode === "list" ? (isDark ? "bg-white/20" : "bg-teal-50") : ""}`}
              >
                <List className={`w-4 h-4 ${viewMode === "list" ? (isDark ? "text-white" : "text-teal-600") : (isDark ? "text-white/50" : "text-black/50")}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Properties Grid/List */}
        <div
          className="px-4 py-5 overflow-y-auto"
          style={{
            maxHeight: isFullscreen
              ? "none"
              : maxHeight !== null && isFinite(maxHeight)
                ? Math.max(400, maxHeight - 280)
                : "60vh",
          }}
        >
          {filteredProperties.length > 0 ? (
            <div className={viewMode === "grid" ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" : "flex flex-col gap-4"}>
              {filteredProperties.map((property, index) => (
                <div
                  key={property.id}
                  onClick={() => handleViewDetails(property.id)}
                  className="cursor-pointer"
                >
                  <PropertyCard
                    property={property}
                    isFavorite={favorites.includes(property.id)}
                    onToggleFavorite={handleToggleFavorite}
                    onContact={handleContact}
                    index={index}
                    isDark={isDark}
                    viewMode={viewMode}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div
              className={`py-16 text-center rounded-2xl border border-dashed ${isDark ? "border-white/20 bg-white/5" : "border-black/20 bg-white"}`}
              style={{ animation: "fadeUp 0.5s ease-out both" }}
            >
              <Building2 className={`w-14 h-14 mx-auto mb-4 ${isDark ? "text-white/30" : "text-black/30"}`} />
              <p className={`text-lg font-semibold mb-1 ${isDark ? "text-white/70" : "text-black/70"}`}>
                No properties found
              </p>
              <p className={`text-sm mb-4 ${isDark ? "text-white/50" : "text-black/50"}`}>
                Try adjusting your filters
              </p>
              {activeFilterCount > 0 && (
                <button
                  onClick={handleClearFilters}
                  className="px-6 py-2.5 bg-teal-500 text-white font-semibold rounded-full hover:bg-teal-600 transition-colors"
                >
                  Clear Filters
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
// Mount React App
// =============================================================================

const container = document.getElementById("property-finder-root");
if (container) {
  const root = createRoot(container);
  root.render(
    <Suspense fallback={<div className="p-4 text-center">Loading properties...</div>}>
      <PropertyFinderApp />
    </Suspense>
  );
}
