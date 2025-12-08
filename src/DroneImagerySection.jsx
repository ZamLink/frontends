// src/DroneImagerySection.jsx
/**
 * Drone Imagery Section for Farm Details Page
 * Displays drone imagery with upload and cloud fetch capabilities
 * Uses TiTiler's preview endpoint for simple image display
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { supabase } from "./createclient";
import {
  getPreviewUrl,
  checkHealth,
  LAYER_CONFIGS,
  isLocalMode,
  isTiTilerConfigured,
} from "./titiler";
import {
  uploadDroneImagery,
  fetchFromGoogleDrive,
  getImageryUrl,
  ensureStorageBucket,
} from "./droneImageryService";
import {
  login as webodmLogin,
  checkHealth as checkWebODM,
  processImages,
  getTaskStatus,
  TASK_STATUS,
  getStatusLabel,
} from "./webodmService";
import { toast } from "react-hot-toast";
import "./droneimagery.css";

const DroneImagerySection = ({ farmId, farmName = "Farm" }) => {
  // Refs
  const fileInputRef = useRef(null);
  const rawFilesInputRef = useRef(null);

  // State
  const [serverOnline, setServerOnline] = useState(false);
  const [isLocal, setIsLocal] = useState(false);
  const [webodmOnline, setWebodmOnline] = useState(false);
  const [droneFlights, setDroneFlights] = useState([]);
  const [selectedFlight, setSelectedFlight] = useState(null);
  const [activeLayerType, setActiveLayerType] = useState("rgb");
  const [loading, setLoading] = useState(true);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Upload state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadMode, setUploadMode] = useState("processed"); // "processed" or "raw"
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadForm, setUploadForm] = useState({
    file: null,
    flightDate: new Date().toISOString().split("T")[0],
    layerType: "ndvi",
    pilotName: "",
    droneModel: "",
  });

  // Raw image processing state
  const [rawFiles, setRawFiles] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(null);
  const [processingJobs, setProcessingJobs] = useState([]);
  const [webodmToken, setWebodmToken] = useState(null);

  // Drive fetch state
  const [showDriveModal, setShowDriveModal] = useState(false);
  const [driveFolderId, setDriveFolderId] = useState("");
  const [fetchingFromDrive, setFetchingFromDrive] = useState(false);

  // Date picker state
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [searchingByDate, setSearchingByDate] = useState(false);

  // Check TiTiler server health and local mode
  useEffect(() => {
    // Check if we're in local development mode
    setIsLocal(isLocalMode());

    const checkServer = async () => {
      // Only check if TiTiler is configured
      if (!isTiTilerConfigured()) {
        setServerOnline(false);
        return;
      }
      const online = await checkHealth();
      setServerOnline(online);
    };

    checkServer();
    // Recheck every 30 seconds (only in local mode)
    if (isLocalMode()) {
      const interval = setInterval(checkServer, 30000);
      return () => clearInterval(interval);
    }
  }, []);

  // Check WebODM server health
  useEffect(() => {
    const checkWebODMServer = async () => {
      const online = await checkWebODM();
      setWebodmOnline(online);
    };

    checkWebODMServer();
    const interval = setInterval(checkWebODMServer, 30000);
    return () => clearInterval(interval);
  }, []);

  // Fetch processing jobs
  const fetchProcessingJobs = useCallback(async () => {
    if (!farmId) return;

    try {
      const { data, error } = await supabase
        .from("processing_jobs")
        .select(
          `
          *,
          drone_flights!inner(farm_id)
        `
        )
        .eq("drone_flights.farm_id", farmId)
        .in("status", ["pending", "uploading", "queued", "processing"])
        .order("created_at", { ascending: false });

      if (!error && data) {
        setProcessingJobs(data);
      }
    } catch (error) {
      console.error("Error fetching processing jobs:", error);
    }
  }, [farmId]);

  // Poll processing jobs
  useEffect(() => {
    fetchProcessingJobs();
    const interval = setInterval(fetchProcessingJobs, 10000);
    return () => clearInterval(interval);
  }, [fetchProcessingJobs]);

  // Fetch drone flights from Supabase
  const fetchDroneFlights = useCallback(async () => {
    if (!farmId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("drone_flights")
        .select(
          `
          *,
          drone_imagery_layers(*)
        `
        )
        .eq("farm_id", farmId)
        .order("flight_date", { ascending: false });

      if (error) throw error;

      // Transform data for easier use
      const flights = (data || []).map((flight) => ({
        id: flight.id,
        date: flight.flight_date.replace(/-/g, ""), // Convert to YYYYMMDD
        displayDate: flight.flight_date,
        pilotName: flight.pilot_name,
        droneModel: flight.drone_model,
        altitude: flight.altitude_meters,
        layers: flight.drone_imagery_layers.map((l) => l.layer_type),
        layersData: flight.drone_imagery_layers,
      }));

      setDroneFlights(flights);

      if (flights.length > 0) {
        setSelectedFlight(flights[0]);
        // Set first available layer as active
        if (flights[0].layers.length > 0) {
          setActiveLayerType(flights[0].layers[0]);
        }
      }
    } catch (error) {
      console.error("Error fetching drone flights:", error);
    } finally {
      setLoading(false);
    }
  }, [farmId]);

  // Fetch on mount
  useEffect(() => {
    fetchDroneFlights();
  }, [fetchDroneFlights]);

  // Handle file upload
  const handleFileUpload = async () => {
    if (!uploadForm.file) {
      toast.error("Please select a file");
      return;
    }

    setUploading(true);
    setUploadProgress(10);

    try {
      // Check storage bucket exists
      const bucketExists = await ensureStorageBucket();
      if (!bucketExists) {
        toast.error(
          "Storage bucket not configured. Please run the storage migration."
        );
        return;
      }

      setUploadProgress(30);

      const result = await uploadDroneImagery({
        file: uploadForm.file,
        farmId,
        flightDate: uploadForm.flightDate,
        layerType: uploadForm.layerType,
        pilotName: uploadForm.pilotName || null,
        droneModel: uploadForm.droneModel || null,
      });

      setUploadProgress(90);

      if (result.success) {
        toast.success(
          `Uploaded ${uploadForm.layerType.toUpperCase()} layer successfully!`
        );
        setShowUploadModal(false);
        setUploadForm({
          file: null,
          flightDate: new Date().toISOString().split("T")[0],
          layerType: "ndvi",
          pilotName: "",
          droneModel: "",
        });
        // Refresh the flights list
        await fetchDroneFlights();
      }
    } catch (error) {
      console.error("Upload error:", error);
      toast.error(`Upload failed: ${error.message}`);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  // Handle Google Drive fetch
  const handleFetchFromDrive = async () => {
    if (!driveFolderId.trim()) {
      toast.error("Please enter a Google Drive folder ID");
      return;
    }

    setFetchingFromDrive(true);

    try {
      const result = await fetchFromGoogleDrive(driveFolderId.trim(), farmId);

      const successCount = result.processed.filter((p) => p.success).length;
      const failCount = result.processed.filter((p) => !p.success).length;

      if (successCount > 0) {
        toast.success(`Imported ${successCount} file(s) from Google Drive`);
        await fetchDroneFlights();
      }
      if (failCount > 0) {
        toast.error(`Failed to import ${failCount} file(s)`);
      }
      if (result.totalFound === 0) {
        toast.error("No GeoTIFF files found in the folder");
      }

      setShowDriveModal(false);
      setDriveFolderId("");
    } catch (error) {
      console.error("Drive fetch error:", error);
      toast.error(error.message);
    } finally {
      setFetchingFromDrive(false);
    }
  };

  // Handle search by date
  const handleSearchByDate = async () => {
    if (!selectedDate) {
      toast.error("Please select a date");
      return;
    }

    setSearchingByDate(true);

    try {
      // Search for flights on the selected date
      const { data, error } = await supabase
        .from("drone_flights")
        .select(
          `
          *,
          drone_imagery_layers(*)
        `
        )
        .eq("farm_id", farmId)
        .eq("flight_date", selectedDate);

      if (error) throw error;

      if (data && data.length > 0) {
        // Found imagery for this date
        const flight = {
          id: data[0].id,
          date: data[0].flight_date.replace(/-/g, ""),
          displayDate: data[0].flight_date,
          pilotName: data[0].pilot_name,
          droneModel: data[0].drone_model,
          altitude: data[0].altitude_meters,
          layers: data[0].drone_imagery_layers.map((l) => l.layer_type),
          layersData: data[0].drone_imagery_layers,
        };

        setSelectedFlight(flight);
        if (flight.layers.length > 0) {
          setActiveLayerType(flight.layers[0]);
        }
        setImageError(false);
        toast.success(`Found imagery from ${formatDate(selectedDate)}`);
        setShowDatePicker(false);
      } else {
        toast.error(`No imagery found for ${formatDate(selectedDate)}`);
      }
    } catch (error) {
      console.error("Date search error:", error);
      toast.error("Failed to search for imagery");
    } finally {
      setSearchingByDate(false);
    }
  };

  // Get available dates for the date picker (dates with imagery)
  const getAvailableDates = useCallback(() => {
    return droneFlights.map((f) => f.displayDate);
  }, [droneFlights]);

  // Handle raw image processing with WebODM
  const handleProcessRawImages = async () => {
    if (rawFiles.length < 3) {
      toast.error("Please select at least 3 images for processing");
      return;
    }

    if (!webodmOnline) {
      toast.error("WebODM is not running. Start it with docker-compose up -d");
      return;
    }

    setProcessing(true);
    setProcessingProgress({ step: "auth", message: "Connecting to WebODM..." });

    try {
      // Login to WebODM
      let token = webodmToken;
      if (!token) {
        token = await webodmLogin();
        setWebodmToken(token);
      }

      // Create a flight record first
      const { data: flight, error: flightError } = await supabase
        .from("drone_flights")
        .insert({
          farm_id: farmId,
          flight_date: uploadForm.flightDate,
          pilot_name: uploadForm.pilotName || null,
          drone_model: uploadForm.droneModel || null,
          status: "processing",
        })
        .select()
        .single();

      if (flightError) throw flightError;

      // Create processing job record
      const { data: job, error: jobError } = await supabase
        .from("processing_jobs")
        .insert({
          flight_id: flight.id,
          status: "uploading",
          images_count: rawFiles.length,
        })
        .select()
        .single();

      if (jobError) throw jobError;

      // Start processing
      const result = await processImages({
        token,
        farmId,
        farmName,
        images: rawFiles,
        onProgress: async (progress) => {
          setProcessingProgress(progress);

          // Update job progress in DB
          await supabase
            .from("processing_jobs")
            .update({
              status:
                progress.step === "processing"
                  ? "processing"
                  : progress.step === "complete"
                  ? "completed"
                  : "uploading",
              progress: progress.progress || 0,
            })
            .eq("id", job.id);
        },
      });

      // Update job with results
      await supabase
        .from("processing_jobs")
        .update({
          status: "completed",
          progress: 100,
          webodm_project_id: result.projectId,
          webodm_task_id: result.taskId,
          processing_time: result.processingTime,
          completed_at: new Date().toISOString(),
          outputs: {
            orthophoto: result.orthophotoUrl,
            tiles: result.tileUrl,
          },
        })
        .eq("id", job.id);

      // Update flight status
      await supabase
        .from("drone_flights")
        .update({ status: "completed" })
        .eq("id", flight.id);

      toast.success("Processing complete! Orthophoto is ready.");
      setShowUploadModal(false);
      setRawFiles([]);
      await fetchDroneFlights();
    } catch (error) {
      console.error("Processing error:", error);
      toast.error(`Processing failed: ${error.message}`);
      setProcessingProgress({ step: "error", message: error.message });
    } finally {
      setProcessing(false);
    }
  };

  // Build filename for TiTiler
  const getFilename = useCallback(
    (flight, layerType) => {
      // Check if we have specific filename from DB
      const layerData = flight.layersData?.find(
        (l) => l.layer_type === layerType
      );
      if (layerData?.filename) {
        return layerData.filename;
      }
      // Fallback to convention: farmId_date_layerType.tif
      return `${farmId}_${flight.date}_${layerType}.tif`;
    },
    [farmId]
  );

  // Get preview URL - use Supabase storage URL for TiTiler
  const getPreviewImageUrl = useCallback(() => {
    if (!selectedFlight) {
      console.log("No selected flight");
      return null;
    }

    console.log("Selected flight:", selectedFlight);
    console.log("Active layer type:", activeLayerType);
    console.log("Layers data:", selectedFlight.layersData);

    const layerData = selectedFlight.layersData?.find(
      (l) => l.layer_type === activeLayerType
    );
    if (!layerData) {
      console.log("No layer data found for type:", activeLayerType);
      return null;
    }

    console.log("Layer data found:", layerData);

    // Get the public URL from Supabase storage
    const publicUrl = getImageryUrl(farmId, layerData.filename);
    console.log("Public URL:", publicUrl);

    const config = LAYER_CONFIGS[activeLayerType] || {};

    // Build TiTiler preview URL with the public storage URL
    const TITILER_URL =
      import.meta.env.VITE_TITILER_URL || "http://localhost:8000";
    const params = new URLSearchParams({
      url: publicUrl,
      max_size: "800",
    });

    if (config.colormap) {
      params.append("colormap_name", config.colormap);
    }
    if (config.rescale) {
      params.append("rescale", config.rescale);
    }

    const finalUrl = `${TITILER_URL}/cog/preview?${params.toString()}`;
    console.log("TiTiler URL:", finalUrl);

    return finalUrl;
  }, [selectedFlight, activeLayerType, farmId]);

  // Fallback: Get preview URL from local files (for backwards compatibility)
  const getLocalPreviewUrl = useCallback(() => {
    if (!selectedFlight || !serverOnline) return null;

    const filename = getFilename(selectedFlight, activeLayerType);
    const config = LAYER_CONFIGS[activeLayerType] || {};

    return getPreviewUrl(filename, {
      colormap: config.colormap,
      rescale: config.rescale,
      maxSize: 800, // Higher resolution preview
    });
  }, [selectedFlight, activeLayerType, serverOnline, getFilename]);

  // Format date for display
  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // Get available layer types for current flight
  const getAvailableLayers = () => {
    if (!selectedFlight?.layers || selectedFlight.layers.length === 0) {
      return ["rgb", "ndvi"]; // Default layers
    }
    return selectedFlight.layers;
  };

  // Get layer statistics from DB
  const getLayerStats = () => {
    if (!selectedFlight?.layersData) return null;
    const layer = selectedFlight.layersData.find(
      (l) => l.layer_type === activeLayerType
    );
    return layer?.statistics;
  };

  const previewUrl = getPreviewImageUrl();
  const stats = getLayerStats();

  // Loading state
  if (loading) {
    return (
      <div className="data-card drone-imagery-card">
        <div className="image-header">
          <h3>
            <span
              className="material-symbols-outlined"
              style={{ marginRight: "8px" }}
            >
              flight
            </span>
            Drone Imagery
          </h3>
        </div>
        <div className="drone-loading">
          <div className="loader"></div>
          <p>Loading drone flights...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="data-card drone-imagery-card">
      <div className="image-header">
        <h3>
          <span
            className="material-symbols-outlined"
            style={{ marginRight: "8px" }}
          >
            flight
          </span>
          Drone Imagery
          {serverOnline ? (
            <span
              className="server-status online"
              title="TiTiler server online"
            >
              ●
            </span>
          ) : (
            <span
              className="server-status offline"
              title={
                isLocal
                  ? "TiTiler server offline - run docker-compose up"
                  : "Local setup required"
              }
            >
              ●
            </span>
          )}
        </h3>

        {droneFlights.length > 0 && (
          <div className="flight-selector">
            <select
              value={selectedFlight?.date || ""}
              onChange={(e) => {
                const flight = droneFlights.find(
                  (f) => f.date === e.target.value
                );
                setSelectedFlight(flight);
                setImageError(false);
              }}
            >
              {droneFlights.map((flight) => (
                <option key={flight.id} value={flight.date}>
                  {formatDate(flight.displayDate)}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="drone-actions">
        <button
          className="drone-action-btn upload-btn"
          onClick={() => setShowUploadModal(true)}
          title="Upload GeoTIFF file"
        >
          <span className="material-symbols-outlined">upload_file</span>
          Upload Image
        </button>
        <button
          className="drone-action-btn date-btn"
          onClick={() => setShowDatePicker(true)}
          title="Find imagery by date"
        >
          <span className="material-symbols-outlined">calendar_month</span>
          By Date
        </button>
        <button
          className="drone-action-btn drive-btn"
          onClick={() => setShowDriveModal(true)}
          title="Fetch from Google Drive"
        >
          <span className="material-symbols-outlined">cloud_download</span>
          Get from Drive
        </button>
        <button
          className="drone-action-btn refresh-btn"
          onClick={fetchDroneFlights}
          disabled={loading}
          title="Refresh imagery list"
        >
          <span className="material-symbols-outlined">refresh</span>
        </button>
      </div>

      {/* Processing Jobs Status */}
      {processingJobs.length > 0 && (
        <div className="processing-jobs-section">
          <h4>
            <span className="material-symbols-outlined">sync</span>
            Processing Jobs
          </h4>
          {processingJobs.map((job) => (
            <div key={job.id} className="processing-job-item">
              <div className="job-info">
                <span className="job-status">{job.status}</span>
                <span className="job-images">{job.images_count} images</span>
              </div>
              <div className="job-progress">
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${job.progress || 0}%` }}
                  ></div>
                </div>
                <span className="progress-text">
                  {Math.round(job.progress || 0)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Layer Type Toggle */}
      {droneFlights.length > 0 && (
        <div className="image-toggle drone-toggle">
          {getAvailableLayers().map((layerType) => {
            const config = LAYER_CONFIGS[layerType] || {
              name: layerType.toUpperCase(),
            };
            return (
              <button
                key={layerType}
                onClick={() => {
                  setActiveLayerType(layerType);
                  setImageError(false);
                  setImageLoading(true);
                }}
                className={activeLayerType === layerType ? "active" : ""}
              >
                {config.name}
              </button>
            );
          })}
        </div>
      )}

      {/* Image Display */}
      <div className="drone-image-container">
        {!serverOnline ? (
          <div className="drone-placeholder">
            <span className="material-symbols-outlined">cloud_off</span>
            {isLocal ? (
              <>
                <p>TiTiler server is offline</p>
                <code className="server-command">docker-compose up -d</code>
                <small>Run this command in the titiler-local folder</small>
              </>
            ) : (
              <>
                <p>Drone imagery requires local setup</p>
                <small>
                  This feature is available in development mode only. Run the
                  app locally with TiTiler to view drone imagery.
                </small>
              </>
            )}
          </div>
        ) : droneFlights.length === 0 ? (
          <div className="drone-placeholder">
            <span className="material-symbols-outlined">flight</span>
            <p>No drone imagery available</p>
            <small>Add GeoTIFF files to the imagery folder</small>
          </div>
        ) : imageError ? (
          <div className="drone-placeholder">
            <span className="material-symbols-outlined">broken_image</span>
            <p>Could not load {activeLayerType.toUpperCase()} layer</p>
            <small>Check that the file exists in titiler-local/imagery/</small>
          </div>
        ) : (
          <>
            {imageLoading && (
              <div className="image-loading-overlay">
                <div className="loader"></div>
              </div>
            )}
            <img
              src={previewUrl}
              alt={`${activeLayerType.toUpperCase()} drone imagery`}
              className="drone-image"
              onLoad={() => setImageLoading(false)}
              onError={() => {
                setImageLoading(false);
                setImageError(true);
              }}
            />
          </>
        )}
      </div>

      {/* Statistics */}
      {stats && !imageError && (
        <div className="drone-stats">
          <div className="stat-item">
            <span className="stat-label">Min</span>
            <span className="stat-value">{stats.min?.toFixed(3) || "N/A"}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Max</span>
            <span className="stat-value">{stats.max?.toFixed(3) || "N/A"}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Mean</span>
            <span className="stat-value">
              {stats.mean?.toFixed(3) || "N/A"}
            </span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Std</span>
            <span className="stat-value">{stats.std?.toFixed(3) || "N/A"}</span>
          </div>
        </div>
      )}

      {/* Flight Info */}
      {selectedFlight && droneFlights.length > 0 && (
        <div className="flight-info">
          {selectedFlight.droneModel && (
            <span className="info-chip">
              <span className="material-symbols-outlined">adb</span>
              {selectedFlight.droneModel}
            </span>
          )}
          {selectedFlight.altitude && (
            <span className="info-chip">
              <span className="material-symbols-outlined">height</span>
              {selectedFlight.altitude}m
            </span>
          )}
          {selectedFlight.pilotName && (
            <span className="info-chip">
              <span className="material-symbols-outlined">person</span>
              {selectedFlight.pilotName}
            </span>
          )}
        </div>
      )}

      {/* Layer Legend */}
      {!imageError && droneFlights.length > 0 && (
        <div className="drone-legend">
          {activeLayerType === "ndvi" && (
            <>
              <div className="legend-gradient ndvi-gradient"></div>
              <div className="legend-labels">
                <span>-1 (Bare/Water)</span>
                <span>0 (Soil)</span>
                <span>+1 (Dense Vegetation)</span>
              </div>
            </>
          )}
          {activeLayerType === "moisture" && (
            <>
              <div className="legend-gradient moisture-gradient"></div>
              <div className="legend-labels">
                <span>0 (Dry)</span>
                <span>1 (Wet)</span>
              </div>
            </>
          )}
          {activeLayerType === "thermal" && (
            <>
              <div className="legend-gradient thermal-gradient"></div>
              <div className="legend-labels">
                <span>20°C (Cool)</span>
                <span>45°C (Hot)</span>
              </div>
            </>
          )}
        </div>
      )}

      {/* Upload Modal - Rendered via Portal to avoid z-index issues */}
      {showUploadModal &&
        createPortal(
          <div
            className="drone-modal-overlay"
            onClick={() => !processing && setShowUploadModal(false)}
            onMouseMove={(e) => e.stopPropagation()}
            onMouseOver={(e) => e.stopPropagation()}
          >
            <div
              className="drone-modal drone-modal-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="drone-modal-header">
                <h3>Upload Drone Imagery</h3>
                <button
                  className="close-btn"
                  onClick={() => setShowUploadModal(false)}
                  disabled={processing}
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              {/* Upload Mode Toggle */}
              <div className="upload-mode-toggle">
                <button
                  className={uploadMode === "processed" ? "active" : ""}
                  onClick={() => setUploadMode("processed")}
                  disabled={processing}
                >
                  <span className="material-symbols-outlined">image</span>
                  Pre-processed GeoTIFF
                </button>
                <button
                  className={uploadMode === "raw" ? "active" : ""}
                  onClick={() => setUploadMode("raw")}
                  disabled={processing}
                >
                  <span className="material-symbols-outlined">
                    photo_library
                  </span>
                  Raw Images (Process with WebODM)
                </button>
              </div>

              <div className="drone-modal-content">
                {/* Common fields */}
                <div className="form-row">
                  <div className="form-group">
                    <label>Flight Date *</label>
                    <input
                      type="date"
                      value={uploadForm.flightDate}
                      onChange={(e) =>
                        setUploadForm({
                          ...uploadForm,
                          flightDate: e.target.value,
                        })
                      }
                      disabled={processing}
                    />
                  </div>
                  <div className="form-group">
                    <label>Pilot Name</label>
                    <input
                      type="text"
                      placeholder="Optional"
                      value={uploadForm.pilotName}
                      onChange={(e) =>
                        setUploadForm({
                          ...uploadForm,
                          pilotName: e.target.value,
                        })
                      }
                      disabled={processing}
                    />
                  </div>
                  <div className="form-group">
                    <label>Drone Model</label>
                    <input
                      type="text"
                      placeholder="e.g., DJI Mavic 3"
                      value={uploadForm.droneModel}
                      onChange={(e) =>
                        setUploadForm({
                          ...uploadForm,
                          droneModel: e.target.value,
                        })
                      }
                      disabled={processing}
                    />
                  </div>
                </div>

                {/* Processed GeoTIFF Upload */}
                {uploadMode === "processed" && (
                  <>
                    <div className="form-group">
                      <label>GeoTIFF File *</label>
                      <div className="file-input-wrapper">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".tif,.tiff,image/tiff"
                          onChange={(e) =>
                            setUploadForm({
                              ...uploadForm,
                              file: e.target.files[0],
                            })
                          }
                        />
                        {uploadForm.file && (
                          <span className="file-name">
                            {uploadForm.file.name}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="form-group">
                      <label>Layer Type *</label>
                      <select
                        value={uploadForm.layerType}
                        onChange={(e) =>
                          setUploadForm({
                            ...uploadForm,
                            layerType: e.target.value,
                          })
                        }
                      >
                        <option value="rgb">True Color (RGB)</option>
                        <option value="ndvi">NDVI</option>
                        <option value="ndre">NDRE</option>
                        <option value="moisture">Moisture</option>
                        <option value="thermal">Thermal</option>
                        <option value="lai">LAI</option>
                        <option value="gndvi">GNDVI</option>
                      </select>
                    </div>

                    {uploading && (
                      <div className="upload-progress">
                        <div className="progress-bar">
                          <div
                            className="progress-fill"
                            style={{ width: `${uploadProgress}%` }}
                          ></div>
                        </div>
                        <span>Uploading... {uploadProgress}%</span>
                      </div>
                    )}
                  </>
                )}

                {/* Raw Images Upload for WebODM Processing */}
                {uploadMode === "raw" && (
                  <>
                    <div className="webodm-status">
                      <span
                        className={`status-indicator ${
                          webodmOnline ? "online" : "offline"
                        }`}
                      ></span>
                      <span>WebODM: {webodmOnline ? "Online" : "Offline"}</span>
                      {!webodmOnline && (
                        <small className="status-help">
                          Start WebODM: <code>docker-compose up -d</code> in
                          webodm-local folder
                        </small>
                      )}
                    </div>

                    <div className="form-group">
                      <label>Raw Drone Images * (JPG, PNG - minimum 3)</label>
                      <div className="file-input-wrapper multi-file">
                        <input
                          ref={rawFilesInputRef}
                          type="file"
                          accept="image/jpeg,image/png,.jpg,.jpeg,.png"
                          multiple
                          onChange={(e) =>
                            setRawFiles(Array.from(e.target.files))
                          }
                          disabled={processing}
                        />
                        <div className="drop-zone">
                          <span className="material-symbols-outlined">
                            cloud_upload
                          </span>
                          <p>Drop images here or click to browse</p>
                          <small>
                            Supports JPG, PNG - Select all images from a flight
                          </small>
                        </div>
                      </div>
                      {rawFiles.length > 0 && (
                        <div className="selected-files">
                          <span className="file-count">
                            {rawFiles.length} files selected
                          </span>
                          <span className="file-size">
                            (
                            {(
                              rawFiles.reduce((sum, f) => sum + f.size, 0) /
                              1024 /
                              1024
                            ).toFixed(1)}{" "}
                            MB)
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="info-box processing-info">
                      <span className="material-symbols-outlined">info</span>
                      <div>
                        <strong>What happens next:</strong>
                        <ol>
                          <li>Images are uploaded to WebODM</li>
                          <li>WebODM creates an orthomosaic (stitched map)</li>
                          <li>RGB and NDVI layers are generated</li>
                          <li>Results appear in your drone imagery</li>
                        </ol>
                        <p>
                          <strong>Processing time:</strong> 5-30 minutes
                          depending on image count
                        </p>
                      </div>
                    </div>

                    {processing && processingProgress && (
                      <div className="processing-status">
                        <div className="processing-step">
                          <span
                            className={`step-icon ${processingProgress.step}`}
                          >
                            {processingProgress.step === "error" ? (
                              <span className="material-symbols-outlined">
                                error
                              </span>
                            ) : processingProgress.step === "complete" ? (
                              <span className="material-symbols-outlined">
                                check_circle
                              </span>
                            ) : (
                              <div className="loader small"></div>
                            )}
                          </span>
                          <span className="step-message">
                            {processingProgress.message}
                          </span>
                        </div>
                        {processingProgress.progress !== undefined && (
                          <div className="progress-bar">
                            <div
                              className="progress-fill"
                              style={{
                                width: `${processingProgress.progress}%`,
                              }}
                            ></div>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="drone-modal-footer">
                <button
                  className="cancel-btn"
                  onClick={() => setShowUploadModal(false)}
                  disabled={uploading || processing}
                >
                  Cancel
                </button>
                {uploadMode === "processed" ? (
                  <button
                    className="submit-btn"
                    onClick={handleFileUpload}
                    disabled={uploading || !uploadForm.file}
                  >
                    {uploading ? "Uploading..." : "Upload"}
                  </button>
                ) : (
                  <button
                    className="submit-btn process-btn"
                    onClick={handleProcessRawImages}
                    disabled={
                      processing || rawFiles.length < 3 || !webodmOnline
                    }
                  >
                    {processing
                      ? "Processing..."
                      : `Process ${rawFiles.length} Images`}
                  </button>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Date Picker Modal - Rendered via Portal */}
      {showDatePicker &&
        createPortal(
          <div
            className="drone-modal-overlay"
            onClick={() => setShowDatePicker(false)}
            onMouseMove={(e) => e.stopPropagation()}
            onMouseOver={(e) => e.stopPropagation()}
          >
            <div
              className="drone-modal date-picker-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="drone-modal-header">
                <h3>Find Imagery by Date</h3>
                <button
                  className="close-btn"
                  onClick={() => setShowDatePicker(false)}
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              <div className="drone-modal-content">
                <p className="modal-description">
                  Select a date to find drone imagery captured on that day.
                </p>

                <div className="form-group">
                  <label>Capture Date *</label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    max={new Date().toISOString().split("T")[0]}
                  />
                </div>

                {searchingByDate && (
                  <div className="fetch-progress">
                    <div className="loader"></div>
                    <span>Searching for imagery...</span>
                  </div>
                )}
              </div>

              <div className="drone-modal-footer">
                <button
                  className="cancel-btn"
                  onClick={() => setShowDatePicker(false)}
                  disabled={searchingByDate}
                >
                  Cancel
                </button>
                <button
                  className="submit-btn"
                  onClick={handleSearchByDate}
                  disabled={searchingByDate || !selectedDate}
                >
                  {searchingByDate ? "Searching..." : "Find Imagery"}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Google Drive Modal - Rendered via Portal */}
      {showDriveModal &&
        createPortal(
          <div
            className="drone-modal-overlay"
            onClick={() => setShowDriveModal(false)}
            onMouseMove={(e) => e.stopPropagation()}
            onMouseOver={(e) => e.stopPropagation()}
          >
            <div className="drone-modal" onClick={(e) => e.stopPropagation()}>
              <div className="drone-modal-header">
                <h3>Import from Google Drive</h3>
                <button
                  className="close-btn"
                  onClick={() => setShowDriveModal(false)}
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              <div className="drone-modal-content">
                <p className="modal-description">
                  Enter the Google Drive folder ID where the drone imagery is
                  stored. The folder must be shared with "Anyone with the link".
                </p>

                <div className="form-group">
                  <label>Google Drive Folder ID *</label>
                  <input
                    type="text"
                    placeholder="e.g., 1a2b3c4d5e6f7g8h9i0j"
                    value={driveFolderId}
                    onChange={(e) => setDriveFolderId(e.target.value)}
                  />
                  <small className="input-help">
                    Find this in the folder URL: drive.google.com/drive/folders/
                    <strong>[FOLDER_ID]</strong>
                  </small>
                </div>

                <div className="info-box">
                  <span className="material-symbols-outlined">info</span>
                  <div>
                    <strong>Supported file formats:</strong>
                    <p>GeoTIFF (.tif, .tiff)</p>
                    <strong>Naming convention:</strong>
                    <p>farmId_YYYYMMDD_layerType.tif</p>
                    <p>Example: farm123_20241208_ndvi.tif</p>
                  </div>
                </div>

                {fetchingFromDrive && (
                  <div className="fetch-progress">
                    <div className="loader"></div>
                    <span>Fetching files from Google Drive...</span>
                  </div>
                )}
              </div>

              <div className="drone-modal-footer">
                <button
                  className="cancel-btn"
                  onClick={() => setShowDriveModal(false)}
                  disabled={fetchingFromDrive}
                >
                  Cancel
                </button>
                <button
                  className="submit-btn"
                  onClick={handleFetchFromDrive}
                  disabled={fetchingFromDrive || !driveFolderId.trim()}
                >
                  {fetchingFromDrive ? "Fetching..." : "Fetch Files"}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

export default DroneImagerySection;
