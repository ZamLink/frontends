// src/pages/UploadKmlPage.jsx
import React, { useState, useCallback, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useDropzone } from "react-dropzone";
import { MapContainer, TileLayer, GeoJSON } from "react-leaflet";
// import { toGeoJSON } from "@tmcw/togeojson";
import { supabase } from "./createclient";
import "./kmlpage.css";
import logo from "./assets/Image_fx.png";
// CORRECT
import { kml } from "@tmcw/togeojson";
import { toast } from "react-hot-toast";
import { useAuth } from "./useauth";
import { registerPolygonWithAgro } from "./agromonitoring";
import { extractPolygonFromFeatureCollection, geoJSONToLeaflet } from "./utils/geometryHelpers";
// Reusable header from CreateFarmPage
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

// Helper component to auto-fit the map to the GeoJSON bounds
const FitBounds = ({ geoJsonData }) => {
  const map = useMap();
  useEffect(() => {
    if (geoJsonData) {
      const layer = L.geoJSON(geoJsonData);
      map.fitBounds(layer.getBounds());
    }
  }, [geoJsonData, map]);
  return null;
};

const UploadKmlPage = () => {
  const [kmlFile, setKmlFile] = useState(null);
  const [geoJsonData, setGeoJsonData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { role, loading: authLoading } = useAuth();

  // Role protection: Only farmers can upload KML files
  useEffect(() => {
    if (!authLoading && role === "admin") {
      toast.error("Admins cannot create farms");
      navigate("/admin-dashboard");
    }
  }, [role, authLoading, navigate]);

  const onDrop = useCallback((acceptedFiles) => {
    setError("");
    const file = acceptedFiles[0];
    if (
      file.type !== "application/vnd.google-earth.kml+xml" &&
      !file.name.endsWith(".kml")
    ) {
      setError("Invalid file type. Please upload a .kml file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      // 5MB limit
      setError("File is too large. Maximum size is 5MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        // CORRECT
        const kmlText = reader.result; // <-- THE FIX IS HERE
        const dom = new DOMParser().parseFromString(kmlText, "text/xml");
        const converted = kml(dom);
        setGeoJsonData(converted);
        setKmlFile(file);
      } catch (e) {
        setError("Failed to parse KML file. Please ensure it is valid.");
        console.error(e);
      }
    };
    reader.readAsText(file);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/vnd.google-earth.kml+xml": [".kml"] },
    maxFiles: 1,
  });

  const handleSubmit = async () => {
    if (!geoJsonData) {
      setError("Please upload a KML file to define boundaries.");
      return;
    }

    // You may want a modal to ask for the farm name here.
    // For now, we'll use the KML filename.
    const farmName = kmlFile.name.replace(".kml", "");

    // Extract polygon geometry from the KML-parsed GeoJSON
    const polygonGeometry = extractPolygonFromFeatureCollection(geoJsonData);
    if (!polygonGeometry) {
      setError("No polygon boundary found in the KML file.");
      return;
    }

    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("User not found.");

      // 1. Create farm using PostGIS RPC function
      // The KML parser already gives us GeoJSON format, so we can use it directly
      const { data: farmResult, error: rpcError } = await supabase.rpc(
        'create_farm_with_boundary',
        {
          p_user_id: user.id,
          p_name: farmName,
          p_geojson: polygonGeometry
        }
      );

      if (rpcError) {
        if (rpcError.message.includes('Invalid polygon')) {
          throw new Error("Invalid farm boundary in KML file. Please ensure the polygon doesn't intersect itself.");
        }
        throw rpcError;
      }

      if (!farmResult || !farmResult.farm_id) {
        throw new Error("Failed to create farm in database.");
      }

      const newFarmId = farmResult.farm_id;

      // 2. Register with AgroMonitoring (needs Leaflet format)
      const leafletCoords = geoJSONToLeaflet(polygonGeometry);
      const agroId = await registerPolygonWithAgro(farmName, leafletCoords);

      // 3. Update farm with AgroMonitoring ID
      const { error: updateError } = await supabase
        .from("farms")
        .update({ agromonitoring_id: agroId })
        .eq("id", newFarmId);

      if (updateError) throw updateError;

      toast.success("Farm boundaries submitted and registered!");
      navigate("/home");
    } catch (error) {
      setError(error.message);
      console.error("Error submitting farm:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="upload-kml-container">
      <MinimalHeader />
      <main className="upload-kml-main">
        <div className="page-header">
          <h1>Define Your Farm Boundaries</h1>
          <p>
            Upload a KML file to define your farm's perimeter. This is essential
            for accurate payment calculations and compliance.
          </p>
        </div>

        <div className="content-grid">
          <div className="upload-column">
            <h2>Upload KML File</h2>
            <p>Select the KML file from your device.</p>
            <div
              {...getRootProps()}
              className={`dropzone ${isDragActive ? "active" : ""}`}
            >
              <input {...getInputProps()} />
              <span className="material-symbols-outlined upload-icon">
                upload_file
              </span>
              <p className="dropzone-text">
                <span className="upload-link">Click to upload</span> or drag and
                drop
              </p>
              <p className="dropzone-hint">KML file format only (max. 5MB)</p>
            </div>
            {kmlFile && (
              <p className="file-name">Selected file: {kmlFile.name}</p>
            )}

            <div className="info-box">
              <span className="material-symbols-outlined">info</span>
              <div>
                <h3>Why is this important?</h3>
                <p>
                  Accurate farm boundaries ensure you are correctly compensated
                  for your eligible land area and help us verify program
                  requirements.
                </p>
              </div>
            </div>
          </div>
          <div className="preview-column">
            <h2>Map Preview</h2>
            <p>Review your uploaded farm boundaries on the map.</p>
            <div className="map-preview-box">
              {geoJsonData ? (
                <MapContainer
                  center={[20.5937, 78.9629]}
                  zoom={4}
                  style={{ height: "100%", width: "100%" }}
                >
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <GeoJSON data={geoJsonData} />
                  {/* <FitBounds geoJsonData={geoJsonData} /> */}
                </MapContainer>
              ) : (
                <div className="map-placeholder">
                  <p>Your map preview will appear here</p>
                </div>
              )}
            </div>
          </div>
        </div>
        {error && <p className="error-message-kml">{error}</p>}
      </main>
      <footer className="upload-kml-footer">
        <button
          className="submit-boundaries-btn"
          onClick={handleSubmit}
          disabled={!kmlFile || loading}
        >
          {loading ? "Submitting..." : "Submit Boundaries"}
          <span className="material-symbols-outlined">arrow_forward</span>
        </button>
      </footer>
    </div>
  );
};

export default UploadKmlPage;
