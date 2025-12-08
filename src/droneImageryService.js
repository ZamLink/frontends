// src/droneImageryService.js
/**
 * Drone Imagery Service
 * Handles uploading GeoTIFFs and fetching from cloud storage (Drive/OneDrive)
 */

import { supabase } from "./createclient";

const TITILER_URL = import.meta.env.VITE_TITILER_URL || "http://localhost:8000";

/**
 * Upload a GeoTIFF file to Supabase Storage and register in database
 */
export const uploadDroneImagery = async ({
  file,
  farmId,
  flightDate,
  layerType,
  pilotName = null,
  droneModel = null,
  altitude = null,
}) => {
  try {
    // 1. Format the filename: farmId_YYYYMMDD_layerType.tif
    const dateStr = flightDate.replace(/-/g, "");
    const filename = `${farmId}_${dateStr}_${layerType}.tif`;
    const storagePath = `${farmId}/${filename}`;

    // 2. Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("drone-imagery")
      .upload(storagePath, file, {
        cacheControl: "3600",
        upsert: true, // Overwrite if exists
      });

    if (uploadError) throw uploadError;

    // 3. Get or create the drone_flight record
    let flightId;

    // Check if flight exists for this date
    const { data: existingFlight } = await supabase
      .from("drone_flights")
      .select("id")
      .eq("farm_id", farmId)
      .eq("flight_date", flightDate)
      .single();

    if (existingFlight) {
      flightId = existingFlight.id;
    } else {
      // Create new flight record
      const { data: newFlight, error: flightError } = await supabase
        .from("drone_flights")
        .insert({
          farm_id: farmId,
          flight_date: flightDate,
          pilot_name: pilotName,
          drone_model: droneModel,
          altitude_meters: altitude,
        })
        .select("id")
        .single();

      if (flightError) throw flightError;
      flightId = newFlight.id;
    }

    // 4. Get file info from TiTiler (if server is running)
    let bounds = null;
    let statistics = null;
    let crs = null;

    try {
      // Get the public URL for the file
      const { data: urlData } = supabase.storage
        .from("drone-imagery")
        .getPublicUrl(storagePath);

      // Try to get info from TiTiler
      const infoResponse = await fetch(
        `${TITILER_URL}/cog/info?url=${encodeURIComponent(urlData.publicUrl)}`
      );
      if (infoResponse.ok) {
        const info = await infoResponse.json();
        crs = info.crs;
        bounds = info.bounds;
      }

      const statsResponse = await fetch(
        `${TITILER_URL}/cog/statistics?url=${encodeURIComponent(
          urlData.publicUrl
        )}`
      );
      if (statsResponse.ok) {
        statistics = await statsResponse.json();
      }
    } catch (e) {
      console.warn("TiTiler not available for metadata extraction:", e);
    }

    // 5. Insert or update the imagery layer record
    const { data: layerData, error: layerError } = await supabase
      .from("drone_imagery_layers")
      .upsert(
        {
          flight_id: flightId,
          layer_type: layerType,
          filename: filename,
          file_size_bytes: file.size,
          crs: crs,
          bounds: bounds,
          statistics: statistics,
        },
        {
          onConflict: "flight_id,layer_type",
        }
      )
      .select()
      .single();

    if (layerError) throw layerError;

    return {
      success: true,
      flight: { id: flightId, date: flightDate },
      layer: layerData,
      storagePath,
    };
  } catch (error) {
    console.error("Error uploading drone imagery:", error);
    throw error;
  }
};

/**
 * Get the public URL for a drone imagery file
 */
export const getImageryUrl = (farmId, filename) => {
  const storagePath = `${farmId}/${filename}`;
  const { data } = supabase.storage
    .from("drone-imagery")
    .getPublicUrl(storagePath);
  return data.publicUrl;
};

/**
 * Get tile URL for displaying imagery via TiTiler
 */
export const getTileUrlFromStorage = (farmId, filename, options = {}) => {
  const publicUrl = getImageryUrl(farmId, filename);

  const params = new URLSearchParams({
    url: publicUrl,
  });

  if (options.colormap) {
    params.append("colormap_name", options.colormap);
  }
  if (options.rescale) {
    params.append("rescale", options.rescale);
  }

  return `${TITILER_URL}/cog/tiles/{z}/{x}/{y}?${params.toString()}`;
};

/**
 * Delete a drone imagery file
 */
export const deleteDroneImagery = async (farmId, layerId, filename) => {
  try {
    // Delete from storage
    const storagePath = `${farmId}/${filename}`;
    const { error: storageError } = await supabase.storage
      .from("drone-imagery")
      .remove([storagePath]);

    if (storageError) throw storageError;

    // Delete from database
    const { error: dbError } = await supabase
      .from("drone_imagery_layers")
      .delete()
      .eq("id", layerId);

    if (dbError) throw dbError;

    return { success: true };
  } catch (error) {
    console.error("Error deleting drone imagery:", error);
    throw error;
  }
};

/**
 * Fetch files from a shared Google Drive folder
 * Requires Google Drive API key and folder ID
 */
export const fetchFromGoogleDrive = async (folderId, farmId) => {
  const apiKey = import.meta.env.VITE_GOOGLE_DRIVE_API_KEY;

  if (!apiKey) {
    throw new Error(
      "Google Drive API key not configured. Add VITE_GOOGLE_DRIVE_API_KEY to .env"
    );
  }

  try {
    // List files in the folder
    const listUrl = `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents&key=${apiKey}&fields=files(id,name,mimeType,size,modifiedTime)`;

    const listResponse = await fetch(listUrl);
    if (!listResponse.ok) {
      throw new Error("Failed to list Google Drive files");
    }

    const { files } = await listResponse.json();

    // Filter for GeoTIFF files
    const tiffFiles = files.filter(
      (f) =>
        f.name.endsWith(".tif") ||
        f.name.endsWith(".tiff") ||
        f.mimeType === "image/tiff"
    );

    const results = [];

    for (const file of tiffFiles) {
      try {
        // Download the file
        const downloadUrl = `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media&key=${apiKey}`;
        const downloadResponse = await fetch(downloadUrl);

        if (!downloadResponse.ok) continue;

        const blob = await downloadResponse.blob();
        const fileObj = new File([blob], file.name, { type: "image/tiff" });

        // Parse filename to extract metadata
        // Expected format: farmId_YYYYMMDD_layerType.tif or just layerType.tif
        const parsed = parseFilename(file.name);

        // Upload to our storage
        const result = await uploadDroneImagery({
          file: fileObj,
          farmId: farmId,
          flightDate: parsed.date || new Date().toISOString().split("T")[0],
          layerType: parsed.layerType || "rgb",
        });

        results.push({
          originalName: file.name,
          ...result,
        });
      } catch (fileError) {
        console.error(`Error processing file ${file.name}:`, fileError);
        results.push({
          originalName: file.name,
          success: false,
          error: fileError.message,
        });
      }
    }

    return {
      totalFound: tiffFiles.length,
      processed: results,
    };
  } catch (error) {
    console.error("Error fetching from Google Drive:", error);
    throw error;
  }
};

/**
 * Fetch files from a shared OneDrive folder
 * Requires Microsoft Graph API setup
 */
export const fetchFromOneDrive = async (shareLink, farmId) => {
  // OneDrive share links need to be converted to API endpoint
  // Format: https://1drv.ms/f/s!xxx or similar

  // For shared links, we need to use the sharing API
  // This requires OAuth setup - for now, throw an informative error

  throw new Error(
    "OneDrive integration requires Microsoft Graph API setup. " +
      "Please use the manual upload option or Google Drive for now."
  );
};

/**
 * Parse a filename to extract date and layer type
 * Supports formats:
 * - farmId_YYYYMMDD_layerType.tif
 * - YYYYMMDD_layerType.tif
 * - layerType.tif
 * - ndvi_20241208.tif
 */
const parseFilename = (filename) => {
  const name = filename.replace(/\.(tif|tiff)$/i, "");
  const parts = name.split("_");

  let date = null;
  let layerType = "rgb";

  // Look for date pattern (YYYYMMDD or YYYY-MM-DD)
  for (const part of parts) {
    if (/^\d{8}$/.test(part)) {
      date = `${part.slice(0, 4)}-${part.slice(4, 6)}-${part.slice(6, 8)}`;
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(part)) {
      date = part;
    }
  }

  // Look for layer type
  const layerTypes = [
    "rgb",
    "ndvi",
    "ndre",
    "moisture",
    "thermal",
    "lai",
    "gndvi",
    "savi",
  ];
  for (const part of parts) {
    if (layerTypes.includes(part.toLowerCase())) {
      layerType = part.toLowerCase();
    }
  }

  return { date, layerType };
};

/**
 * Check if drone-imagery bucket exists by trying to access it
 * Note: listBuckets() requires admin permissions, so we test by listing files instead
 */
export const ensureStorageBucket = async () => {
  try {
    // Try to list files in the bucket - this will fail if bucket doesn't exist
    const { data, error } = await supabase.storage
      .from("drone-imagery")
      .list("", { limit: 1 });

    // If we get a "Bucket not found" error, the bucket doesn't exist
    if (error) {
      if (
        error.message?.includes("Bucket not found") ||
        error.statusCode === 404
      ) {
        console.warn(
          "drone-imagery bucket does not exist. Please create it in Supabase dashboard."
        );
        return false;
      }
      // Other errors (like permission issues) - assume bucket exists but we can't list
      console.warn("Storage access warning:", error.message);
    }

    // If we got here, bucket exists (even if empty)
    return true;
  } catch (error) {
    console.error("Error checking storage bucket:", error);
    // On network errors, assume bucket might exist and let upload try
    return true;
  }
};
