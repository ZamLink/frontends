// src/titiler.js
/**
 * TiTiler API service for drone imagery
 * Handles COG tile serving with dynamic styling
 */

const TITILER_URL = import.meta.env.VITE_TITILER_URL || "";

// Check if we're in a production environment (no local TiTiler)
export const isLocalMode = () => {
  return TITILER_URL && TITILER_URL.includes("localhost");
};

// Check if TiTiler is configured at all
export const isTiTilerConfigured = () => {
  return !!TITILER_URL && TITILER_URL.length > 0;
};

/**
 * Build tile URL for Leaflet TileLayer
 * @param {string} filename - Name of file in imagery folder (e.g., 'farm1_ndvi.tif')
 * @param {object} options - Tile options
 */
export const getTileUrl = (filename, options = {}) => {
  const fileUrl = `file:///data/${filename}`;
  const params = new URLSearchParams({
    url: fileUrl,
  });

  // Add colormap for indices
  if (options.colormap) {
    params.append("colormap_name", options.colormap);
  }

  // Add rescale for proper color mapping
  if (options.rescale) {
    params.append("rescale", options.rescale);
  }

  // Add band selection if needed
  if (options.bidx) {
    params.append("bidx", options.bidx);
  }

  return `${TITILER_URL}/cog/tiles/{z}/{x}/{y}?${params.toString()}`;
};

/**
 * Get raster bounds for fitting map view
 */
export const getBounds = async (filename) => {
  const fileUrl = `file:///data/${filename}`;
  const response = await fetch(
    `${TITILER_URL}/cog/bounds?url=${encodeURIComponent(fileUrl)}`
  );

  if (!response.ok) {
    throw new Error("Failed to get bounds");
  }

  const data = await response.json();
  // Returns { bounds: [minx, miny, maxx, maxy] }
  return data.bounds;
};

/**
 * Get raster info (CRS, dimensions, bands, etc.)
 */
export const getInfo = async (filename) => {
  const fileUrl = `file:///data/${filename}`;
  const response = await fetch(
    `${TITILER_URL}/cog/info?url=${encodeURIComponent(fileUrl)}`
  );

  if (!response.ok) {
    throw new Error("Failed to get info");
  }

  return response.json();
};

/**
 * Get band statistics (min, max, mean, std)
 */
export const getStatistics = async (filename) => {
  const fileUrl = `file:///data/${filename}`;
  const response = await fetch(
    `${TITILER_URL}/cog/statistics?url=${encodeURIComponent(fileUrl)}`
  );

  if (!response.ok) {
    throw new Error("Failed to get statistics");
  }

  return response.json();
};

/**
 * Get pixel value at a specific point
 */
export const getPointValue = async (filename, lat, lon) => {
  const fileUrl = `file:///data/${filename}`;
  const response = await fetch(
    `${TITILER_URL}/cog/point/${lon},${lat}?url=${encodeURIComponent(fileUrl)}`
  );

  if (!response.ok) {
    throw new Error("Failed to get point value");
  }

  return response.json();
};

/**
 * Get preview image URL
 */
export const getPreviewUrl = (filename, options = {}) => {
  const fileUrl = `file:///data/${filename}`;
  const params = new URLSearchParams({
    url: fileUrl,
    max_size: options.maxSize || 512,
  });

  if (options.colormap) {
    params.append("colormap_name", options.colormap);
  }

  if (options.rescale) {
    params.append("rescale", options.rescale);
  }

  return `${TITILER_URL}/cog/preview?${params.toString()}`;
};

/**
 * Predefined layer configurations
 */
export const LAYER_CONFIGS = {
  rgb: {
    name: "True Color",
    colormap: null,
    rescale: null,
    bidx: "1,2,3",
  },
  ndvi: {
    name: "NDVI",
    colormap: "rdylgn",
    rescale: "-1,1",
    bidx: null,
  },
  ndre: {
    name: "NDRE",
    colormap: "rdylgn",
    rescale: "-1,1",
    bidx: null,
  },
  moisture: {
    name: "Moisture",
    colormap: "blues",
    rescale: "0,1",
    bidx: null,
  },
  thermal: {
    name: "Thermal",
    colormap: "inferno",
    rescale: "20,45", // Celsius
    bidx: null,
  },
  lai: {
    name: "LAI",
    colormap: "greens",
    rescale: "0,8",
    bidx: null,
  },
};

/**
 * Check if TiTiler server is available
 */
export const checkHealth = async () => {
  // If no TiTiler URL configured, return false immediately
  if (!isTiTilerConfigured()) {
    return false;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout

    const response = await fetch(`${TITILER_URL}/healthz`, {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    return false;
  }
};
