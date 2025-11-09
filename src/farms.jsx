// src/pages/FarmsPage.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "./createclient";
import Sidebar from "./sidebar";
import { area as turfArea } from "@turf/area";
import { polygon as turfPolygon } from "@turf/helpers";
import "./farms.css";
import Spinner from "./spinner";

// This is the new, self-contained Farm Card component
const FarmCard = ({ farm }) => {
  const navigate = useNavigate();
  const mapboxApiKey = import.meta.env.VITE_MAPBOX_API_KEY;

  // Calculate area in hectares (1 hectare = 10,000 sq meters)
  const getAreaInHectares = (locationData) => {
    if (!locationData) return 0;
    const coords = locationData.map((p) => [p.lng, p.lat]);
    if (coords.length < 3) return 0;
    if (
      coords[0][0] !== coords[coords.length - 1][0] ||
      coords[0][1] !== coords[coords.length - 1][1]
    ) {
      coords.push(coords[0]);
    }
    const poly = turfPolygon([coords]);
    const areaInMeters = turfArea(poly);
    return (areaInMeters / 10000).toFixed(2);
  };

  // Construct Mapbox Static Image URL
  const getMapImageUrl = (locationData) => {
    if (!locationData || !mapboxApiKey) {
      return "https://via.placeholder.com/350x150?text=Map+Preview+Unavailable";
    }
    const coords = locationData.map((p) => [p.lng, p.lat]);
    if (coords.length < 3)
      return "https://via.placeholder.com/350x150?text=Invalid+Polygon";
    if (
      coords[0][0] !== coords[coords.length - 1][0] ||
      coords[0][1] !== coords[coords.length - 1][1]
    ) {
      coords.push(coords[0]);
    }
    const geoJson = turfPolygon([coords]);
    const encodedGeoJson = encodeURIComponent(JSON.stringify(geoJson.geometry));

    return `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/geojson(${encodedGeoJson})/auto/350x150?padding=20&access_token=${mapboxApiKey}`;
  };

  const area = getAreaInHectares(farm.location_data);
  const imageUrl = getMapImageUrl(farm.location_data);
  const milestonesComplete = 0; // Placeholder data
  const totalMilestones = 5; // Placeholder data
  const progress = (milestonesComplete / totalMilestones) * 100;

  return (
    <div className="farm-card">
      <img src={imageUrl} alt={`Map of ${farm.name}`} className="card-image" />
      <div className="card-content">
        <div className="card-header">
          <h3>{farm.name}</h3>
          <button
            onClick={() => navigate(`/farm/${farm.id}`)}
            className="view-details-btn"
          >
            View Details
          </button>
        </div>
        <div className="card-details">
          <p>Total Area: {area} Hectares</p>
          <p>
            {milestonesComplete} of {totalMilestones} milestones complete
          </p>
          <div className="progress-bar-container">
            <div
              className="progress-bar"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>
      </div>
    </div>
  );
};

const FarmsPage = () => {
  const [farms, setFarms] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchFarms = async () => {
      // Fetch all necessary data for the cards
      const { data, error } = await supabase
        .from("farms")
        .select("id, name, location_data");
      if (error) {
        console.error("Error fetching farms:", error);
      } else {
        setFarms(data);
      }
      setLoading(false);
    };
    fetchFarms();
  }, []);

  if (loading) return <Spinner></Spinner>;

  return (
    <div className="farms-page-container">
      <Sidebar />
      <main className="farms-main">
        <header className="farms-page-header">
          <div>
            <h1>My Farms</h1>
            <p className="page-subtitle">
              An overview of all your registered farms.
            </p>
          </div>
          <div className="search-bar">
            <span className="material-symbols-outlined">search</span>
            <input type="text" placeholder="Search by farm name..." />
          </div>
        </header>

        <div className="farms-grid">
          {farms.map((farm) => (
            <FarmCard key={farm.id} farm={farm} />
          ))}
          {/* "Add New Farm" card */}
          <div
            className="add-farm-card"
            onClick={() => navigate("/create-farm")}
          >
            <div className="add-icon-circle">
              <span className="material-symbols-outlined">add</span>
            </div>
            <h3>Have another property?</h3>
            <button className="add-farm-cta">Add a New Farm</button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default FarmsPage;
