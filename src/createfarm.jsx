// src/pages/CreateFarmPage.jsx
import React, { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, FeatureGroup } from "react-leaflet";
import { EditControl } from "react-leaflet-draw";
import { supabase } from "./createclient";
import "./createfarm.css";
import logo from "./assets/Image_fx.png";
import { registerPolygonWithAgro } from "./agromonitoring";
import Spinner from "./spinner";
import { toast } from "react-hot-toast";
import { useAuth } from "./useauth";
import { leafletToGeoJSON } from "./utils/geometryHelpers";

// Debounce helper for search
const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
};

// Minimal header for this page
const MinimalHeader = () => (
  <header className="minimal-header">
    <div className="header-content">
      <div className="logo-container">
        <img className="logo-img" src={logo} alt="AgriPay" />
        <h1 className="logo-text">AgriPay</h1>
      </div>
      <nav className="minimal-nav">
        <a href="/home">Dashboard</a>
        <a href="/farms" className="active">
          Farms
        </a>
        <a href="/payments">Payments</a>
        <a href="/reports">Reports</a>
      </nav>
      <div className="profile-icon"></div>
    </div>
  </header>
);

const CreateFarmPage = () => {
  const [farmName, setFarmName] = useState("");
  const [polygonCoords, setPolygonCoords] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [mapLayer, setMapLayer] = useState("satellite"); // 'satellite' or 'street'
  const navigate = useNavigate();
  const mapRef = useRef(null);
  const searchRef = useRef(null);
  const { role, loading: authLoading } = useAuth();

  // Debounce search query
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Photon API search (free, better than Nominatim)
  useEffect(() => {
    const searchLocations = async () => {
      if (!debouncedSearchQuery || debouncedSearchQuery.length < 3) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      try {
        // Photon API - free, no API key needed, better search than Nominatim
        const response = await fetch(
          `https://photon.komoot.io/api/?q=${encodeURIComponent(
            debouncedSearchQuery
          )}&limit=5&lang=en`
        );
        const data = await response.json();

        if (data.features && data.features.length > 0) {
          const results = data.features.map((feature) => ({
            id: feature.properties.osm_id || Math.random(),
            name: feature.properties.name || "",
            city: feature.properties.city || feature.properties.county || "",
            state: feature.properties.state || "",
            country: feature.properties.country || "",
            lat: feature.geometry.coordinates[1],
            lng: feature.geometry.coordinates[0],
            type: feature.properties.type || "",
          }));
          setSearchResults(results);
          setShowSuggestions(true);
        } else {
          setSearchResults([]);
        }
      } catch (error) {
        console.error("Search error:", error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    };

    searchLocations();
  }, [debouncedSearchQuery]);

  // Role protection: Only farmers can create farms
  useEffect(() => {
    if (!authLoading && role === "admin") {
      toast.error("Admins cannot create farms");
      navigate("/admin-dashboard");
    }
  }, [role, authLoading, navigate]);
  const handleCreated = (e) => {
    const { layerType, layer } = e;
    if (layerType === "polygon") {
      const latlngs = layer.getLatLngs()[0]; // Get coordinates
      setPolygonCoords(latlngs);
    }
  };

  const handleSaveFarm = async () => {
    setError("");
    if (!farmName.trim()) {
      setError("Please provide a name for your farm.");
      return;
    }
    if (!polygonCoords) {
      setError("Please draw the boundaries of your farm on the map.");
      return;
    }

    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("User not found.");

      // Convert Leaflet coordinates to GeoJSON format for PostGIS
      // polygonCoords is array of Leaflet LatLng objects: [{lat, lng}, ...]
      const leafletCoords = polygonCoords.map((p) => ({
        lat: p.lat,
        lng: p.lng,
      }));
      const geoJsonGeometry = leafletToGeoJSON(leafletCoords);

      // 1. Create farm using PostGIS RPC function
      const { data: farmResult, error: rpcError } = await supabase.rpc(
        "create_farm_with_boundary",
        {
          p_user_id: user.id,
          p_name: farmName,
          p_geojson: geoJsonGeometry,
        }
      );

      if (rpcError) {
        // Handle specific PostGIS errors with user-friendly messages
        if (rpcError.message.includes("Invalid polygon")) {
          throw new Error(
            "Invalid farm boundary. Please ensure the polygon doesn't intersect itself."
          );
        }
        throw rpcError;
      }

      if (!farmResult || !farmResult.farm_id) {
        throw new Error("Failed to create farm in database.");
      }

      const newFarmId = farmResult.farm_id;

      // 2. Register the polygon with AgroMonitoring (uses Leaflet format)
      const agroId = await registerPolygonWithAgro(farmName, leafletCoords);

      // 3. Update our farm record with the new AgroMonitoring ID
      const { error: updateError } = await supabase
        .from("farms")
        .update({ agromonitoring_id: agroId })
        .eq("id", newFarmId);

      if (updateError) throw updateError;

      toast.success("Farm saved and registered!");
      navigate("/home");
    } catch (error) {
      setError(error.message);
      console.error("Error saving farm:", error);
    } finally {
      setLoading(false);
    }
  };

  // Handle selecting a search result
  const handleSelectLocation = (result) => {
    const map = mapRef.current;
    if (map) {
      map.setView([result.lat, result.lng], 14);
    }
    setSearchQuery(result.name || `${result.city}, ${result.state}`);
    setShowSuggestions(false);
    toast.success(`Moved to ${result.name || result.city}`);
  };

  // Format location display
  const formatLocation = (result) => {
    const parts = [
      result.name,
      result.city,
      result.state,
      result.country,
    ].filter(Boolean);
    return parts.join(", ");
  };

  return (
    <div className="create-farm-container">
      <MinimalHeader />
      <main className="create-farm-main">
        <div className="form-header">
          <h1>Create New Farm</h1>
          <p>Draw the boundaries of your farm on the map below.</p>
        </div>

        {/* Updated form controls with autocomplete search */}
        <div className="form-controls">
          <input
            type="text"
            className="farm-name-input"
            placeholder="Enter farm name (e.g., Green Valley)"
            value={farmName}
            onChange={(e) => setFarmName(e.target.value)}
          />
          <div className="search-container" ref={searchRef}>
            <div className="search-input-wrapper">
              <span className="material-symbols-outlined">search</span>
              <input
                type="text"
                className="search-input"
                placeholder="Search for a location..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() =>
                  searchResults.length > 0 && setShowSuggestions(true)
                }
              />
              {isSearching && (
                <span className="search-loading">
                  <span className="material-symbols-outlined spinning">
                    sync
                  </span>
                </span>
              )}
            </div>
            {/* Autocomplete suggestions dropdown */}
            {showSuggestions && searchResults.length > 0 && (
              <ul className="search-suggestions">
                {searchResults.map((result) => (
                  <li
                    key={result.id}
                    className="suggestion-item"
                    onClick={() => handleSelectLocation(result)}
                  >
                    <span className="material-symbols-outlined suggestion-icon">
                      location_on
                    </span>
                    <div className="suggestion-text">
                      <span className="suggestion-name">
                        {result.name || result.city}
                      </span>
                      <span className="suggestion-details">
                        {[result.city, result.state, result.country]
                          .filter((v) => v && v !== result.name)
                          .join(", ")}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="map-wrapper">
          {/* Map layer toggle button */}
          <button
            className="map-layer-toggle"
            onClick={() => setMapLayer(mapLayer === "satellite" ? "street" : "satellite")}
            title={mapLayer === "satellite" ? "Switch to Street View" : "Switch to Satellite View"}
          >
            <span className="material-symbols-outlined">
              {mapLayer === "satellite" ? "map" : "satellite_alt"}
            </span>
            <span className="toggle-label">
              {mapLayer === "satellite" ? "Street" : "Satellite"}
            </span>
          </button>

          {/* Added ref to the MapContainer */}
          <MapContainer
            ref={mapRef}
            center={[20.5937, 78.9629]}
            zoom={5}
            style={{ height: "100%", width: "100%" }}
          >
            {mapLayer === "satellite" ? (
              <TileLayer
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                attribution='&copy; <a href="https://www.esri.com/">Esri</a> | Imagery'
              />
            ) : (
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              />
            )}
            <FeatureGroup>
              <EditControl
                position="topright"
                onCreated={handleCreated}
                draw={{
                  rectangle: false,
                  circle: false,
                  circlemarker: false,
                  marker: false,
                  polyline: false,
                }}
                edit={{ edit: false, remove: true }}
              />
            </FeatureGroup>
          </MapContainer>
        </div>
        {error && <p className="error-message-farm">{error}</p>}
      </main>
      <footer className="create-farm-footer">
        <button className="cancel-btn" onClick={() => navigate("/home")}>
          Cancel
        </button>
        <button
          className="save-btn"
          onClick={handleSaveFarm}
          disabled={loading}
        >
          {loading ? "Saving..." : "Save Farm"}
        </button>
      </footer>
    </div>
  );
};

export default CreateFarmPage;
