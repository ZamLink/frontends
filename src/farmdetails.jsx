// // src/pages/FarmDetailsPage.jsx
// import React, { useState, useEffect } from "react";
// import { useParams } from "react-router-dom";
// import { supabase } from "./createclient";
// import Sidebar from "./sidebar";
// import {
//   getWeatherForPolygon,
//   getSoilDataForPolygon,
//   getNdviHistoryForPolygon,
//   searchSatelliteImages,
// } from "./agromonitoring";

// // Import Chart.js components
// import { Line } from "react-chartjs-2";
// import {
//   Chart as ChartJS,
//   CategoryScale,
//   LinearScale,
//   PointElement,
//   LineElement,
//   Title,
//   Tooltip,
//   Legend,
// } from "chart.js";

// import "./farmdetails.css";

// // Register Chart.js components
// ChartJS.register(
//   CategoryScale,
//   LinearScale,
//   PointElement,
//   LineElement,
//   Title,
//   Tooltip,
//   Legend
// );

// // NDVI Chart Component
// const NdviChart = ({ data }) => {
//   const chartData = {
//     labels: data.map((item) => new Date(item.dt * 1000).toLocaleDateString()),
//     datasets: [
//       {
//         label: "Mean NDVI",
//         data: data.map((item) => item.data.mean),
//         borderColor: "#4cdf20",
//         backgroundColor: "rgba(76, 223, 32, 0.2)",
//         fill: true,
//       },
//     ],
//   };
//   const options = { responsive: true, plugins: { legend: { display: false } } };
//   return <Line options={options} data={chartData} />;
// };

// const FarmDetailsPage = () => {
//   const { farmId } = useParams();
//   const [farm, setFarm] = useState(null);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState("");

//   // State for all our new data
//   const [weather, setWeather] = useState(null);
//   const [soil, setSoil] = useState(null);
//   const [ndviHistory, setNdviHistory] = useState([]);
//   const [latestImage, setLatestImage] = useState(null);
//   const [imageType, setImageType] = useState("tci"); // 'tci' or 'ndvi'

//   useEffect(() => {
//     const fetchAllData = async () => {
//       try {
//         // 1. Get farm details from our database (this includes the agromonitoring_id)
//         const { data: farmData, error: farmError } = await supabase
//           .from("farms")
//           .select("*")
//           .eq("id", farmId)
//           .single();
//         if (farmError) throw farmError;
//         setFarm(farmData);

//         if (!farmData.agromonitoring_id) {
//           throw new Error(
//             "This farm is not registered with the monitoring service."
//           );
//         }

//         const polyId = farmData.agromonitoring_id;

//         // 2. Fetch all AgroMonitoring data in parallel for speed
//         const [weatherData, soilData, ndviData, imageData] = await Promise.all([
//           getWeatherForPolygon(polyId),
//           getSoilDataForPolygon(polyId),
//           getNdviHistoryForPolygon(polyId),
//           searchSatelliteImages(polyId),
//         ]);

//         setWeather(weatherData);
//         setSoil(soilData);
//         setNdviHistory(ndviData);
//         setLatestImage(imageData);
//       } catch (err) {
//         setError(err.message);
//         console.error("Error fetching farm data:", err);
//       } finally {
//         setLoading(false);
//       }
//     };

//     fetchAllData();
//   }, [farmId]);

//   const getImageUrl = () => {
//     if (!latestImage) return null;
//     return imageType === "tci" ? latestImage.image.tci : latestImage.image.ndvi;
//   };

//   if (loading) {
//     return (
//       <div className="farm-details-container">
//         <Sidebar />
//         <main className="farm-details-main loading-state">
//           Loading farm details...
//         </main>
//       </div>
//     );
//   }
//   if (error) {
//     return (
//       <div className="farm-details-container">
//         <Sidebar />
//         <main className="farm-details-main error-state">Error: {error}</main>
//       </div>
//     );
//   }

//   return (
//     <div className="farm-details-container">
//       <Sidebar />
//       <main className="farm-details-main">
//         <h1 className="farm-name-title">{farm?.name}</h1>

//         <div className="data-grid">
//           {/* Weather Card */}
//           <div className="data-card weather-card">
//             <h3>Current Weather</h3>
//             {weather ? (
//               <div className="weather-content">
//                 <img
//                   src={`http://openweathermap.org/img/wn/${weather[0].weather[0].icon}@2x.png`}
//                   alt="weather icon"
//                 />
//                 <div className="weather-details">
//                   <p className="temperature">
//                     {Math.round(weather[0].main.temp - 273.15)}°C
//                   </p>
//                   <p className="description">
//                     {weather[0].weather[0].description}
//                   </p>
//                 </div>
//               </div>
//             ) : (
//               <p>Loading weather...</p>
//             )}
//           </div>

//           {/* Soil Data Card */}
//           <div className="data-card soil-card">
//             <h3>Soil Data</h3>
//             {soil ? (
//               <div className="soil-content">
//                 <p>Temperature: {Math.round(soil.t10 - 273.15)}°C</p>
//                 <p>Moisture: {(soil.moisture * 100).toFixed(1)}%</p>
//               </div>
//             ) : (
//               <p>Loading soil data...</p>
//             )}
//           </div>

//           {/* NDVI Chart */}
//           <div className="data-card chart-card">
//             <h3>NDVI Trend (30 Days)</h3>
//             {ndviHistory.length > 0 ? (
//               <NdviChart data={ndviHistory} />
//             ) : (
//               <p>No NDVI data available.</p>
//             )}
//           </div>

//           {/* Satellite Image Card */}
//           <div className="data-card image-card">
//             <div className="image-header">
//               <h3>Latest Satellite Image</h3>
//               <div className="image-toggle">
//                 <button
//                   onClick={() => setImageType("tci")}
//                   className={imageType === "tci" ? "active" : ""}
//                 >
//                   True Color
//                 </button>
//                 <button
//                   onClick={() => setImageType("ndvi")}
//                   className={imageType === "ndvi" ? "active" : ""}
//                 >
//                   NDVI
//                 </button>
//               </div>
//             </div>
//             {latestImage ? (
//               <img
//                 src={getImageUrl()}
//                 alt={`${imageType} view`}
//                 className="satellite-image"
//               />
//             ) : (
//               <p>No recent satellite imagery found.</p>
//             )}
//           </div>
//         </div>
//       </main>
//     </div>
//   );
// };

// export default FarmDetailsPage;

// src/pages/FarmDetailsPage.jsx
import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "./createclient";
import Sidebar from "./sidebar";
import Modal from "./modal";
import ConfirmDialog from "./confirmdialog";
import {
  getWeatherForPolygon,
  getSoilDataForPolygon,
  getNdviHistoryForPolygon,
  searchSatelliteImages,
  getCurrentWeatherForPolygon,
  getUviForPolygon,
} from "./agromonitoring";
import {
  getSentinelTrueColor,
  getSentinelNDVI,
  getSentinelSAVI,
  getSentinelMoisture,
  getSentinelLAI,
  getVegetationStats,
  getVegetationHistory,
} from "./sentinelhub";
import DroneImagerySection from "./DroneImagerySection";
import { toast } from "react-hot-toast";

// Import Chart.js components
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";

import "./farmdetails.css";
import { useAuth } from "./useauth";
import {
  MILESTONE_STATUS,
  getStatusDisplay,
  getStatusColor,
  isVerifiedStatus,
  isPendingVerification,
} from "./utils/statusHelpers";
import { geoJSONToLeaflet } from "./utils/geometryHelpers";

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);
import Spinner from "./spinner";
// NDVI Chart Component (from AgroMonitoring)
const NdviChart = ({ data }) => {
  const chartData = {
    labels: data.map((item) => new Date(item.dt * 1000).toLocaleDateString()),
    datasets: [
      {
        label: "Mean NDVI",
        data: data.map((item) => item.data.mean),
        borderColor: "#22c55e",
        backgroundColor: "rgba(34, 197, 94, 0.1)",
        fill: true,
        tension: 0.4,
      },
    ],
  };
  const options = { responsive: true, plugins: { legend: { display: false } } };
  return <Line options={options} data={chartData} />;
};

// Generic Vegetation Index Chart Component (for Sentinel Hub data)
const VegetationChart = ({
  data,
  label,
  color,
  minValue = -1,
  maxValue = 1,
}) => {
  if (!data || data.length === 0) return null;

  const chartData = {
    labels: data.map((item) => new Date(item.dt * 1000).toLocaleDateString()),
    datasets: [
      {
        label: label,
        data: data.map((item) => item.data.mean),
        borderColor: color,
        backgroundColor: `${color}20`,
        fill: true,
        tension: 0.4,
        pointRadius: 3,
        pointHoverRadius: 5,
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context) => `${label}: ${context.parsed.y.toFixed(3)}`,
        },
      },
    },
    scales: {
      y: {
        min: minValue,
        max: maxValue,
        title: {
          display: true,
          text: label,
        },
      },
    },
  };

  return <Line options={options} data={chartData} />;
};

// Helper function to safely format numbers (handles NaN and undefined)
const safeToFixed = (value, decimals = 2) => {
  if (value === null || value === undefined || isNaN(value)) {
    return "N/A";
  }
  return Number(value).toFixed(decimals);
};

// Helper to check if a value is a valid number
const isValidNumber = (value) => {
  return (
    value !== null && value !== undefined && !isNaN(value) && isFinite(value)
  );
};

// Helper function to get farm coordinates from PostGIS boundary
// Returns coordinates in Leaflet format [{lat, lng}] for Sentinel Hub API compatibility
const getFarmCoordinates = (farmData) => {
  if (!farmData) return null;

  // Get coordinates from PostGIS boundary column
  if (farmData.boundary) {
    try {
      // boundary is already GeoJSON from the database
      const geojson =
        typeof farmData.boundary === "string"
          ? JSON.parse(farmData.boundary)
          : farmData.boundary;
      return geoJSONToLeaflet(geojson);
    } catch (e) {
      console.warn("Failed to parse boundary GeoJSON:", e);
    }
  }

  return null;
};

const FarmDetailsPage = () => {
  const { farmId } = useParams();
  const { role, loading: authLoading } = useAuth();
  const [farm, setFarm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [weather, setWeather] = useState(null);
  const [soil, setSoil] = useState(null);
  const [ndviHistory, setNdviHistory] = useState([]);
  const [latestImage, setLatestImage] = useState(null);
  const [imageType, setImageType] = useState("tci");

  // Additional AgroMonitoring data states
  const [currentWeather, setCurrentWeather] = useState(null);
  const [uvi, setUvi] = useState(null);

  // Sentinel Hub data states
  const [sentinelImages, setSentinelImages] = useState({
    trueColor: null,
    ndvi: null,
    savi: null,
    moisture: null,
    lai: null,
  });
  const [sentinelImageType, setSentinelImageType] = useState("trueColor");
  const [sentinelLoading, setSentinelLoading] = useState(false);
  const [sentinelStats, setSentinelStats] = useState(null);
  const [sentinelHistory, setSentinelHistory] = useState({
    ndvi: [],
    savi: [],
    moisture: [],
    lai: [],
  });
  const [activeCycle, setActiveCycle] = useState(null);
  const [cycleMilestones, setCycleMilestones] = useState([]);
  const [availableCrops, setAvailableCrops] = useState([]);

  // Modal state for starting a cycle
  const [isStartCycleModalOpen, setIsStartCycleModalOpen] = useState(false);
  const [selectedCropId, setSelectedCropId] = useState("");

  // Confirmation dialog state for milestone verification
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [milestoneToVerify, setMilestoneToVerify] = useState(null);

  useEffect(() => {
    const fetchFarmData = async () => {
      setLoading(true);
      setError("");
      try {
        // --- Part 1: Fetch core farm data and available crops ---
        const { data: farmData, error: farmError } = await supabase
          .from("farms")
          .select("*")
          .eq("id", farmId)
          .single();
        if (farmError) throw farmError;
        setFarm(farmData);

        const { data: crops } = await supabase.from("crops").select("*");
        if (crops) {
          setAvailableCrops(crops);
          if (crops.length > 0) setSelectedCropId(crops[0].id);
        }

        // --- Part 2: Check for an active crop cycle (this remains the same) ---
        const { data: cycleData, error: cycleError } = await supabase
          .from("crop_cycles")
          .select(`*, cycle_milestones(*, milestone_templates(*))`)
          .eq("farm_id", farmId)
          .eq("is_active", true);
        if (cycleError) throw cycleError;

        if (cycleData && cycleData.length === 1) {
          const currentCycle = cycleData[0];
          setActiveCycle(currentCycle);
          const sortedMilestones = currentCycle.cycle_milestones.sort(
            (a, b) =>
              a.milestone_templates.sequence - b.milestone_templates.sequence
          );
          setCycleMilestones(sortedMilestones);
        } else {
          setActiveCycle(null);
          setCycleMilestones([]);
        }

        // --- THE FIX IS HERE ---
        // Part 3: Fetch AgroMonitoring data regardless of active cycle, as long as the farm is registered.
        if (farmData && farmData.agromonitoring_id) {
          const polyId = farmData.agromonitoring_id;

          // Use Promise.allSettled to prevent one failed request from stopping all others
          // Note: Some APIs (EVI, accumulated temp/precip, weather history) require paid subscription
          const results = await Promise.allSettled([
            getWeatherForPolygon(polyId),
            getSoilDataForPolygon(polyId),
            getNdviHistoryForPolygon(polyId),
            searchSatelliteImages(polyId),
            getCurrentWeatherForPolygon(polyId),
            getUviForPolygon(polyId),
          ]);

          const apiNames = [
            "Weather Forecast",
            "Soil",
            "NDVI",
            "Satellite Images",
            "Current Weather",
            "UV Index",
          ];

          // Assign data if the request was successful
          if (results[0].status === "fulfilled") {
            console.log("Weather forecast data fetched successfully");
            setWeather(results[0].value);
          }
          if (results[1].status === "fulfilled") {
            console.log("Soil data fetched successfully");
            setSoil(results[1].value);
          }
          if (results[2].status === "fulfilled") {
            console.log("NDVI data fetched successfully");
            setNdviHistory(results[2].value);
          }
          if (results[3].status === "fulfilled") {
            console.log("Satellite images fetched successfully");
            setLatestImage(results[3].value);
          }
          if (results[4].status === "fulfilled") {
            console.log("Current weather data fetched successfully");
            setCurrentWeather(results[4].value);
          }
          if (results[5].status === "fulfilled") {
            console.log("UV Index data fetched successfully");
            setUvi(results[5].value);
          }

          // Log any errors without crashing the page
          const failedRequests = [];
          results.forEach((result, index) => {
            if (result.status === "rejected") {
              console.warn(
                `Failed to fetch ${apiNames[index]} data:`,
                result.reason
              );
              // Only add to failed list if it's not NDVI (which takes time for new farms)
              if (apiNames[index] !== "NDVI") {
                failedRequests.push(apiNames[index]);
              }
            }
          });

          // Show toast notification if critical API calls failed (not NDVI)
          if (failedRequests.length > 0) {
            toast.error(`Failed to fetch: ${failedRequests.join(", ")}`);
          }

          // Show info message if NDVI specifically failed (normal for new farms)
          if (results[2].status === "rejected") {
            console.info(
              "NDVI data not yet available - this is normal for newly registered farms (takes 24-48 hours)"
            );
          }

          // --- Fetch Sentinel Hub data ---
          // Get coordinates from either new PostGIS boundary or deprecated location_data
          const farmCoords = getFarmCoordinates(farmData);
          if (farmCoords && farmCoords.length > 0) {
            fetchSentinelData(farmCoords);
          }
        } else {
          // If the farm isn't registered with AgroMonitoring, we can't fetch this data.
          console.warn(
            "Farm is not registered with AgroMonitoring service. Skipping data fetch."
          );

          // But we can still try Sentinel Hub if we have coordinates
          const farmCoords = getFarmCoordinates(farmData);
          if (farmCoords && farmCoords.length > 0) {
            fetchSentinelData(farmCoords);
          }
        }
        // --- END OF FIX ---
      } catch (error) {
        setError(error.message);
        console.error("Error fetching page data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchFarmData();
  }, [farmId]);

  // Function to fetch Sentinel Hub satellite imagery
  const fetchSentinelData = async (coords) => {
    setSentinelLoading(true);
    try {
      const sentinelResults = await Promise.allSettled([
        getSentinelTrueColor(coords),
        getSentinelNDVI(coords),
        getSentinelSAVI(coords),
        getSentinelMoisture(coords),
        getSentinelLAI(coords),
        getVegetationStats(coords),
        getVegetationHistory(coords, 60), // Get 60 days of history
      ]);

      const imageTypes = ["trueColor", "ndvi", "savi", "moisture", "lai"];
      const newImages = { ...sentinelImages };

      sentinelResults.slice(0, 5).forEach((result, index) => {
        if (result.status === "fulfilled") {
          console.log(`Sentinel ${imageTypes[index]} fetched successfully`);
          newImages[imageTypes[index]] = result.value;
        } else {
          console.error(`Sentinel ${imageTypes[index]} failed:`, result.reason);
        }
      });

      setSentinelImages(newImages);

      // Handle vegetation stats (index 5)
      if (sentinelResults[5].status === "fulfilled") {
        console.log(
          "Sentinel vegetation stats fetched:",
          sentinelResults[5].value
        );
        setSentinelStats(sentinelResults[5].value);
      } else {
        console.error("Sentinel stats failed:", sentinelResults[5].reason);
      }

      // Handle vegetation history (index 6)
      if (sentinelResults[6].status === "fulfilled") {
        console.log(
          "Sentinel vegetation history fetched:",
          sentinelResults[6].value
        );
        setSentinelHistory(sentinelResults[6].value);
      } else {
        console.error("Sentinel history failed:", sentinelResults[6].reason);
      }
    } catch (error) {
      console.error("Error fetching Sentinel data:", error);
      toast.error("Failed to fetch Sentinel satellite data");
    } finally {
      setSentinelLoading(false);
    }
  };

  const getImageUrl = () => {
    if (!latestImage) return null;
    console.log("Latest Image Object:", latestImage);
    // AgroMonitoring API uses 'truecolor' not 'tci' for true color images
    if (imageType === "tci") {
      return latestImage.image?.truecolor || latestImage.image?.tci || null;
    }
    return latestImage.image?.ndvi || null;
  };
  const handleApproveClick = (milestone) => {
    setMilestoneToVerify(milestone);
    setShowConfirmDialog(true);
  };

  const handleConfirmApprove = async () => {
    if (!milestoneToVerify) return;

    try {
      const { data, error } = await supabase.functions.invoke(
        "update-milestone-status",
        {
          body: {
            milestoneId: milestoneToVerify.id,
            action: "verify",
          },
        }
      );

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success("Milestone approved successfully");
      // Update local state for instant UI feedback
      setCycleMilestones((prev) =>
        prev.map((m) =>
          m.id === milestoneToVerify.id
            ? { ...m, status: MILESTONE_STATUS.VERIFIED }
            : m
        )
      );
    } catch (error) {
      console.error("Verification error:", error);
      toast.error(error.message || "Error updating verification");
    }
    setMilestoneToVerify(null);
  };
  const handleStartCycle = async () => {
    if (!selectedCropId) {
      // alert("Please select a crop.");
      toast.error("No Crop Selected");
      return;
    }

    try {
      const { error } = await supabase.functions.invoke("start-crop-cycle", {
        body: { farm_id: farmId, crop_id: selectedCropId },
      });
      if (error) throw error;
      // alert("Crop cycle started successfully!");
      toast.success("Cycle Started Succesfully");
      window.location.reload(); // Easiest way to refresh all data
    } catch (error) {
      // alert("Error starting cycle: " + error.message);
      toast.error("Error starting cycle");
    }
  };
  const handleStatusChange = async (milestoneId, newStatus) => {
    try {
      const { data, error } = await supabase.functions.invoke(
        "update-milestone-status",
        {
          body: {
            milestoneId,
            newStatus,
          },
        }
      );

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Update local state for instant UI feedback
      setCycleMilestones((prev) =>
        prev.map((m) =>
          m.id === milestoneId ? { ...m, status: newStatus } : m
        )
      );
    } catch (error) {
      console.error("Status change error:", error);
      toast.error(error.message || "Error updating status");
    }
  };

  if (loading) {
    return (
      <div className="farm-details-container">
        <Sidebar />
        <main className="farm-details-main loading-state">
          Loading farm details...
        </main>
        <Spinner></Spinner>
      </div>
    );
  }
  if (error) {
    return (
      <div className="farm-details-container">
        <Sidebar />
        <main className="farm-details-main error-state">Error: {error}</main>
      </div>
    );
  }

  //   const getImageUrl = () => {
  //     // ... (This function remains exactly the same)
  //   };

  // Improved Loading and Error states
  if (loading) {
    return (
      <div className="farm-details-container">
        <Sidebar />
        <main className="farm-details-main state-container">
          <div className="loader"></div>
          <p>Fetching farm data...</p>
          <Spinner></Spinner>
        </main>
      </div>
    );
  }
  if (error) {
    return (
      <div className="farm-details-container">
        <Sidebar />
        <main className="farm-details-main state-container">
          <span className="material-symbols-outlined error-icon">error</span>
          <p>Error: {error}</p>
        </main>
      </div>
    );
  }

  return (
    <div className="farm-details-container">
      <Sidebar />
      <main className="farm-details-main">
        <div className="page-title-section">
          <h1 className="farm-name-title">{farm?.name}</h1>
          <p className="farm-subtitle">
            Live farm metrics and satellite imagery
          </p>
        </div>
        {activeCycle ? (
          // --- MILESTONE VIEW ---
          <div className="milestone-section">
            <h2>
              Ongoing Cycle:{" "}
              {availableCrops.find((c) => c.id === activeCycle.crop_id)?.name}
            </h2>
            <div className="milestone-list">
              {cycleMilestones.map((ms) => (
                <div key={ms.id} className="milestone-item">
                  <div className="milestone-info">
                    <h4>{ms.milestone_templates.name}</h4>
                    <p>{ms.milestone_templates.description}</p>
                  </div>
                  <div className="milestone-status">
                    {role === "admin" ? (
                      // UI for Admin (Technical Officer)
                      <>
                        <span
                          className={`status-pill role-view ${getStatusColor(
                            ms.status
                          )}`}
                        >
                          {getStatusDisplay(ms.status)}
                        </span>
                        {!isVerifiedStatus(ms.status) ? (
                          <button
                            onClick={() => handleApproveClick(ms)}
                            className="verify-btn verify"
                            disabled={!isPendingVerification(ms.status)} // Only allow verification if farmer marked it complete
                          >
                            Verify
                          </button>
                        ) : (
                          <span className="verified-locked">
                            <span className="material-symbols-outlined">
                              lock
                            </span>
                            Verified (Locked)
                          </span>
                        )}
                      </>
                    ) : (
                      // UI for Farmer - can only set to not_started, in_progress, or pending_verification
                      <>
                        <select
                          value={ms.status}
                          onChange={(e) =>
                            handleStatusChange(ms.id, e.target.value)
                          }
                          disabled={isVerifiedStatus(ms.status)} // Cannot change after verified
                        >
                          <option value={MILESTONE_STATUS.NOT_STARTED}>
                            Not Started
                          </option>
                          <option value={MILESTONE_STATUS.IN_PROGRESS}>
                            In Progress
                          </option>
                          <option value={MILESTONE_STATUS.PENDING_VERIFICATION}>
                            Completed - Awaiting Verification
                          </option>
                        </select>
                        <span
                          className={`verified-badge ${
                            isVerifiedStatus(ms.status) ? "verified" : ""
                          }`}
                        >
                          {isVerifiedStatus(ms.status)
                            ? "Verified"
                            : getStatusDisplay(ms.status)}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          // --- START CYCLE VIEW ---
          role === "farmer" && (
            <div className="start-cycle-card">
              <h3>No Active Crop Cycle</h3>
              <p>
                Start a new cycle to begin tracking milestones for this farm.
              </p>
              <button
                className="start-btn"
                onClick={() => setIsStartCycleModalOpen(true)}
              >
                Start New Crop Cycle
              </button>
            </div>
          )
        )}

        <div className="data-grid">
          {/* Weather Card */}
          <div className="data-card weather-card">
            <h3>Live Weather</h3>
            {weather && weather.length > 0 ? (
              <div className="weather-content">
                <img
                  src={`http://openweathermap.org/img/wn/${weather[0].weather[0].icon}@4x.png`}
                  alt="weather icon"
                />
                <div className="weather-details">
                  <p className="temperature">
                    {Math.round(weather[0].main.temp - 273.15)}°C
                  </p>
                  <p className="description">
                    {weather[0].weather[0].description}
                  </p>
                </div>
              </div>
            ) : loading ? (
              <p>Loading weather...</p>
            ) : (
              <p style={{ color: "#64748b", fontSize: "0.875rem" }}>
                Weather data unavailable. Check console for details.
              </p>
            )}
          </div>

          {/* Soil Data Card */}
          <div className="data-card soil-card">
            <h3>Live Soil Data</h3>
            {soil ? (
              <div className="soil-content">
                <div className="metric-item">
                  <span className="material-symbols-outlined metric-icon">
                    device_thermostat
                  </span>
                  <div>
                    <p className="metric-label">Temperature (10cm)</p>
                    <p className="metric-value">
                      {Math.round(soil.t10 - 273.15)}°C
                    </p>
                  </div>
                </div>
                <div className="metric-item">
                  <span className="material-symbols-outlined metric-icon">
                    water_drop
                  </span>
                  <div>
                    <p className="metric-label">Moisture</p>
                    <p className="metric-value">
                      {(soil.moisture * 100).toFixed(1)}%
                    </p>
                  </div>
                </div>
              </div>
            ) : loading ? (
              <p>Loading soil data...</p>
            ) : (
              <p style={{ color: "#64748b", fontSize: "0.875rem" }}>
                Soil data unavailable. Check console for details.
              </p>
            )}
          </div>

          {/* NDVI Card (from Sentinel) */}
          <div className="data-card ndvi-card">
            <h3>NDVI</h3>
            {sentinelStats?.ndvi && isValidNumber(sentinelStats.ndvi.mean) ? (
              <div className="vegetation-stat-content">
                <div className="vegetation-main-value">
                  <span className="veg-value">
                    {safeToFixed(sentinelStats.ndvi.mean, 3)}
                  </span>
                  <span
                    className="veg-badge"
                    style={{
                      backgroundColor:
                        sentinelStats.ndvi.mean > 0.5
                          ? "#22c55e"
                          : sentinelStats.ndvi.mean > 0.3
                          ? "#eab308"
                          : "#ef4444",
                    }}
                  >
                    {sentinelStats.ndvi.mean > 0.5
                      ? "Healthy"
                      : sentinelStats.ndvi.mean > 0.3
                      ? "Moderate"
                      : "Low"}
                  </span>
                </div>
                <p className="veg-description">Vegetation Health Index</p>
                <div className="veg-range">
                  <span>Min: {safeToFixed(sentinelStats.ndvi.min, 2)}</span>
                  <span>Max: {safeToFixed(sentinelStats.ndvi.max, 2)}</span>
                </div>
              </div>
            ) : sentinelLoading ? (
              <p>Loading NDVI...</p>
            ) : (
              <p style={{ color: "#64748b", fontSize: "0.875rem" }}>
                NDVI data unavailable.
              </p>
            )}
          </div>

          {/* LAI Card (from Sentinel) */}
          <div className="data-card lai-card">
            <h3>LAI</h3>
            {sentinelStats?.lai && isValidNumber(sentinelStats.lai.mean) ? (
              <div className="vegetation-stat-content">
                <div className="vegetation-main-value">
                  <span className="veg-value">
                    {safeToFixed(sentinelStats.lai.mean, 2)}
                  </span>
                  <span
                    className="veg-badge"
                    style={{
                      backgroundColor:
                        sentinelStats.lai.mean > 3
                          ? "#22c55e"
                          : sentinelStats.lai.mean > 1.5
                          ? "#eab308"
                          : "#ef4444",
                    }}
                  >
                    {sentinelStats.lai.mean > 3
                      ? "Dense"
                      : sentinelStats.lai.mean > 1.5
                      ? "Growing"
                      : "Sparse"}
                  </span>
                </div>
                <p className="veg-description">Leaf Area Index</p>
                <div className="veg-range">
                  <span>Min: {safeToFixed(sentinelStats.lai.min, 1)}</span>
                  <span>Max: {safeToFixed(sentinelStats.lai.max, 1)}</span>
                </div>
              </div>
            ) : sentinelLoading ? (
              <p>Loading LAI...</p>
            ) : (
              <p style={{ color: "#64748b", fontSize: "0.875rem" }}>
                LAI data unavailable.
              </p>
            )}
          </div>

          {/* UV Index Card */}
          <div className="data-card uvi-card">
            <h3>UV Index</h3>
            {uvi ? (
              <div className="uvi-content">
                <div className="metric-item">
                  <span
                    className="material-symbols-outlined metric-icon"
                    style={{ backgroundColor: "#fef3c7", color: "#f59e0b" }}
                  >
                    wb_sunny
                  </span>
                  <div>
                    <p className="metric-label">Current UV Index</p>
                    <p className="metric-value">
                      {uvi.uvi?.toFixed(1) || "N/A"}
                    </p>
                    <p
                      className="uvi-level"
                      style={{ fontSize: "0.75rem", color: "#64748b" }}
                    >
                      {uvi.uvi <= 2
                        ? "Low"
                        : uvi.uvi <= 5
                        ? "Moderate"
                        : uvi.uvi <= 7
                        ? "High"
                        : uvi.uvi <= 10
                        ? "Very High"
                        : "Extreme"}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <p style={{ color: "#64748b", fontSize: "0.875rem" }}>
                UV Index data unavailable.
              </p>
            )}
          </div>

          {/* Current Weather Details Card */}
          <div className="data-card current-weather-card">
            <h3>Current Conditions</h3>
            {currentWeather ? (
              <div className="current-weather-content">
                <div className="weather-grid">
                  <div className="weather-stat">
                    <span className="material-symbols-outlined">air</span>
                    <div>
                      <p className="stat-label">Wind Speed</p>
                      <p className="stat-value">
                        {currentWeather.wind?.speed?.toFixed(1) || 0} m/s
                      </p>
                    </div>
                  </div>
                  <div className="weather-stat">
                    <span className="material-symbols-outlined">
                      humidity_percentage
                    </span>
                    <div>
                      <p className="stat-label">Humidity</p>
                      <p className="stat-value">
                        {currentWeather.main?.humidity || 0}%
                      </p>
                    </div>
                  </div>
                  <div className="weather-stat">
                    <span className="material-symbols-outlined">compress</span>
                    <div>
                      <p className="stat-label">Pressure</p>
                      <p className="stat-value">
                        {currentWeather.main?.pressure || 0} hPa
                      </p>
                    </div>
                  </div>
                  <div className="weather-stat">
                    <span className="material-symbols-outlined">
                      visibility
                    </span>
                    <div>
                      <p className="stat-label">Clouds</p>
                      <p className="stat-value">
                        {currentWeather.clouds?.all || 0}%
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <p style={{ color: "#64748b", fontSize: "0.875rem" }}>
                Current weather data unavailable.
              </p>
            )}
          </div>

          {/* SAVI Card (from Sentinel) */}
          <div className="data-card savi-card">
            <h3>SAVI</h3>
            {sentinelStats?.savi && isValidNumber(sentinelStats.savi.mean) ? (
              <div className="vegetation-stat-content">
                <div className="vegetation-main-value">
                  <span className="veg-value">
                    {safeToFixed(sentinelStats.savi.mean, 3)}
                  </span>
                  <span
                    className="veg-badge"
                    style={{
                      backgroundColor:
                        sentinelStats.savi.mean > 0.4
                          ? "#22c55e"
                          : sentinelStats.savi.mean > 0.2
                          ? "#eab308"
                          : "#ef4444",
                    }}
                  >
                    {sentinelStats.savi.mean > 0.4
                      ? "Good"
                      : sentinelStats.savi.mean > 0.2
                      ? "Fair"
                      : "Poor"}
                  </span>
                </div>
                <p className="veg-description">Soil-Adjusted Vegetation</p>
                <div className="veg-range">
                  <span>Min: {safeToFixed(sentinelStats.savi.min, 2)}</span>
                  <span>Max: {safeToFixed(sentinelStats.savi.max, 2)}</span>
                </div>
              </div>
            ) : sentinelLoading ? (
              <p>Loading SAVI...</p>
            ) : (
              <p style={{ color: "#64748b", fontSize: "0.875rem" }}>
                SAVI data unavailable.
              </p>
            )}
          </div>

          {/* Moisture Card (from Sentinel) */}
          <div className="data-card moisture-card">
            <h3>Plant Moisture</h3>
            {sentinelStats?.moisture &&
            isValidNumber(sentinelStats.moisture.mean) ? (
              <div className="vegetation-stat-content">
                <div className="vegetation-main-value">
                  <span className="veg-value">
                    {safeToFixed(sentinelStats.moisture.mean, 3)}
                  </span>
                  <span
                    className="veg-badge"
                    style={{
                      backgroundColor:
                        sentinelStats.moisture.mean > 0.1
                          ? "#3b82f6"
                          : sentinelStats.moisture.mean > -0.1
                          ? "#eab308"
                          : "#ef4444",
                    }}
                  >
                    {sentinelStats.moisture.mean > 0.1
                      ? "Adequate"
                      : sentinelStats.moisture.mean > -0.1
                      ? "Normal"
                      : "Dry"}
                  </span>
                </div>
                <p className="veg-description">NDMI Water Stress Index</p>
                <div className="veg-range">
                  <span>Min: {safeToFixed(sentinelStats.moisture.min, 2)}</span>
                  <span>Max: {safeToFixed(sentinelStats.moisture.max, 2)}</span>
                </div>
              </div>
            ) : sentinelLoading ? (
              <p>Loading moisture...</p>
            ) : (
              <p style={{ color: "#64748b", fontSize: "0.875rem" }}>
                Moisture data unavailable.
              </p>
            )}
          </div>

          {/* Drone Imagery Card - TiTiler Integration */}
          <DroneImagerySection farmId={farmId} />

          {/* NDVI Chart (AgroMonitoring) */}
          <div className="data-card chart-card">
            <h3>NDVI Trend (Last 30 Days)</h3>
            <p className="card-subtitle">
              Higher values indicate healthier vegetation
            </p>
            {ndviHistory.length > 0 ? (
              <div className="chart-container">
                <NdviChart data={ndviHistory} />
              </div>
            ) : loading ? (
              <p>Loading NDVI data...</p>
            ) : (
              <p style={{ color: "#64748b", fontSize: "0.875rem" }}>
                No NDVI data available. Check console for details.
              </p>
            )}
          </div>

          {/* Sentinel Hub NDVI Trend Chart */}
          <div className="data-card chart-card sentinel-chart-card">
            <h3>
              <span
                className="material-symbols-outlined"
                style={{
                  color: "#22c55e",
                  marginRight: "8px",
                  fontSize: "1.2rem",
                  verticalAlign: "middle",
                }}
              >
                show_chart
              </span>
              NDVI History (Sentinel Hub)
            </h3>
            <p className="card-subtitle">60-day vegetation health trend</p>
            {sentinelHistory.ndvi.length > 0 ? (
              <div className="chart-container">
                <VegetationChart
                  data={sentinelHistory.ndvi}
                  label="NDVI"
                  color="#22c55e"
                  minValue={-0.2}
                  maxValue={1}
                />
              </div>
            ) : sentinelLoading ? (
              <p>Loading Sentinel NDVI history...</p>
            ) : (
              <p style={{ color: "#64748b", fontSize: "0.875rem" }}>
                No NDVI history available.
              </p>
            )}
          </div>

          {/* Sentinel Hub SAVI Trend Chart */}
          <div className="data-card chart-card sentinel-chart-card">
            <h3>
              <span
                className="material-symbols-outlined"
                style={{
                  color: "#10b981",
                  marginRight: "8px",
                  fontSize: "1.2rem",
                  verticalAlign: "middle",
                }}
              >
                grass
              </span>
              SAVI History (Sentinel Hub)
            </h3>
            <p className="card-subtitle">
              60-day soil-adjusted vegetation trend
            </p>
            {sentinelHistory.savi.length > 0 ? (
              <div className="chart-container">
                <VegetationChart
                  data={sentinelHistory.savi}
                  label="SAVI"
                  color="#10b981"
                  minValue={-0.2}
                  maxValue={1.5}
                />
              </div>
            ) : sentinelLoading ? (
              <p>Loading SAVI history...</p>
            ) : (
              <p style={{ color: "#64748b", fontSize: "0.875rem" }}>
                No SAVI history available.
              </p>
            )}
          </div>

          {/* Sentinel Hub Moisture Trend Chart */}
          <div className="data-card chart-card sentinel-chart-card">
            <h3>
              <span
                className="material-symbols-outlined"
                style={{
                  color: "#0ea5e9",
                  marginRight: "8px",
                  fontSize: "1.2rem",
                  verticalAlign: "middle",
                }}
              >
                water_drop
              </span>
              Moisture History (Sentinel Hub)
            </h3>
            <p className="card-subtitle">60-day vegetation moisture trend</p>
            {sentinelHistory.moisture.length > 0 ? (
              <div className="chart-container">
                <VegetationChart
                  data={sentinelHistory.moisture}
                  label="Moisture"
                  color="#0ea5e9"
                  minValue={-0.5}
                  maxValue={0.5}
                />
              </div>
            ) : sentinelLoading ? (
              <p>Loading moisture history...</p>
            ) : (
              <p style={{ color: "#64748b", fontSize: "0.875rem" }}>
                No moisture history available.
              </p>
            )}
          </div>

          {/* Sentinel Hub LAI Trend Chart */}
          <div className="data-card chart-card sentinel-chart-card">
            <h3>
              <span
                className="material-symbols-outlined"
                style={{
                  color: "#84cc16",
                  marginRight: "8px",
                  fontSize: "1.2rem",
                  verticalAlign: "middle",
                }}
              >
                eco
              </span>
              LAI History (Sentinel Hub)
            </h3>
            <p className="card-subtitle">60-day leaf area index trend</p>
            {sentinelHistory.lai.length > 0 ? (
              <div className="chart-container">
                <VegetationChart
                  data={sentinelHistory.lai}
                  label="LAI"
                  color="#84cc16"
                  minValue={0}
                  maxValue={8}
                />
              </div>
            ) : sentinelLoading ? (
              <p>Loading LAI history...</p>
            ) : (
              <p style={{ color: "#64748b", fontSize: "0.875rem" }}>
                No LAI history available.
              </p>
            )}
          </div>

          {/* Sentinel Hub Satellite Imagery Card */}
          <div className="data-card image-card sentinel-card">
            <div className="image-header">
              <h3>Sentinel-2 Satellite Imagery</h3>
              <div className="image-toggle sentinel-toggle">
                <button
                  onClick={() => setSentinelImageType("trueColor")}
                  className={sentinelImageType === "trueColor" ? "active" : ""}
                >
                  True Color
                </button>
                <button
                  onClick={() => setSentinelImageType("ndvi")}
                  className={sentinelImageType === "ndvi" ? "active" : ""}
                >
                  NDVI
                </button>
                <button
                  onClick={() => setSentinelImageType("savi")}
                  className={sentinelImageType === "savi" ? "active" : ""}
                >
                  SAVI
                </button>
                <button
                  onClick={() => setSentinelImageType("moisture")}
                  className={sentinelImageType === "moisture" ? "active" : ""}
                >
                  Moisture
                </button>
                <button
                  onClick={() => setSentinelImageType("lai")}
                  className={sentinelImageType === "lai" ? "active" : ""}
                >
                  LAI
                </button>
              </div>
            </div>
            <p className="card-subtitle sentinel-subtitle">
              {sentinelImageType === "trueColor" &&
                "Natural color satellite view"}
              {sentinelImageType === "ndvi" &&
                "Vegetation health index (green = healthy)"}
              {sentinelImageType === "savi" &&
                "Soil-adjusted vegetation - better for sparse crops"}
              {sentinelImageType === "moisture" &&
                "Plant water stress (blue = wet, red = dry)"}
              {sentinelImageType === "lai" &&
                "Leaf Area Index - crop growth indicator"}
            </p>
            {sentinelLoading ? (
              <div className="satellite-placeholder">
                <div className="loader"></div>
                <p>Loading Sentinel-2 imagery...</p>
              </div>
            ) : sentinelImages[sentinelImageType] ? (
              <img
                src={sentinelImages[sentinelImageType]}
                alt={`Sentinel ${sentinelImageType} view`}
                className="satellite-image"
              />
            ) : (
              <div className="satellite-placeholder">
                <span className="material-symbols-outlined">satellite_alt</span>
                <p>
                  Sentinel imagery unavailable. Configure Sentinel Hub
                  credentials.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
      <Modal
        isOpen={isStartCycleModalOpen}
        onClose={() => setIsStartCycleModalOpen(false)}
      >
        <div className="start-cycle-modal">
          <h2>Start a New Crop Cycle</h2>
          <div className="crop-selector">
            <label htmlFor="crop-select">Select a Crop:</label>
            <div className="select-wrapper">
              <select
                id="crop-select"
                value={selectedCropId}
                onChange={(e) => setSelectedCropId(e.target.value)}
              >
                {availableCrops.map((crop) => (
                  <option key={crop.id} value={crop.id}>
                    {crop.name}
                  </option>
                ))}
              </select>
            </div>
            <button className="modal-start-btn" onClick={handleStartCycle}>
              Start Cycle
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={showConfirmDialog}
        onClose={() => {
          setShowConfirmDialog(false);
          setMilestoneToVerify(null);
        }}
        onConfirm={handleConfirmApprove}
        type="success"
        title="Approve Milestone Verification?"
        confirmText="Approve & Release Payment"
        cancelText="Cancel"
      >
        {milestoneToVerify && (
          <div className="confirm-dialog-details">
            <p className="confirm-milestone-name">
              <strong>
                {milestoneToVerify.milestone_templates?.name || "Milestone"}
              </strong>
              {" - "}
              {milestoneToVerify.crop_cycles?.crops?.name || "Crop"}
            </p>
            <div className="confirm-warning-box">
              <span className="material-symbols-outlined">info</span>
              <div>
                <strong className="confirm-warning-title">
                  Warning: This action is irreversible
                </strong>
                <p className="confirm-warning-text">
                  Once approved, payment will be released to the farmer via
                  blockchain smart contract. This transaction cannot be reversed
                  or cancelled.
                </p>
              </div>
            </div>
            <div className="confirm-checklist">
              <label className="confirm-checkbox">
                <input type="checkbox" required />I have reviewed the milestone
                completion evidence
              </label>
              <label className="confirm-checkbox">
                <input type="checkbox" required />I have verified the
                agricultural data and metrics
              </label>
              <label className="confirm-checkbox">
                <input type="checkbox" required />I confirm this milestone meets
                all required criteria
              </label>
            </div>
          </div>
        )}
      </ConfirmDialog>
    </div>
  );
};

export default FarmDetailsPage;
