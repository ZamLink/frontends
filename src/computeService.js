/**
 * Shared API client for the AgriPay compute backend (ml-models).
 *
 * Used by DroneImagerySection (plant counting) and
 * farmdetails (milestone verification).
 */
import { supabase } from "./createclient";

const COMPUTE_API =
  import.meta.env.VITE_COMPUTE_API_URL ?? "http://localhost:8001";

// ---------------------------------------------------------------------------
// Plant counting
// ---------------------------------------------------------------------------

/**
 * Analyze an existing drone image by filename.
 * Backend resolves the full path via settings.imagery_dir.
 */
export async function analyzeByFilename(
  filename,
  modelId = "wheat_plant_counter_v1"
) {
  const res = await fetch(`${COMPUTE_API}/api/v1/analyze/plant-count`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename, model_id: modelId }),
  });
  if (!res.ok) throw new Error(`Analysis request failed (${res.status})`);
  return res.json(); // { job_id, status, message }
}

/**
 * Upload a file and start analysis (browser upload flow).
 */
export async function uploadAndAnalyze(file) {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${COMPUTE_API}/upload`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok)
    throw new Error("Upload failed. Is the compute server running?");
  return res.json(); // { job_id, status, progress, message }
}

/**
 * Poll job status.
 * Uses the /status compat endpoint which remaps keys to frontend shape.
 */
export async function getJobStatus(jobId) {
  const res = await fetch(`${COMPUTE_API}/status/${jobId}`);
  if (!res.ok) throw new Error("Failed to fetch job status");
  return res.json();
  // { job_id, status, progress (0-100), message, result?, error? }
}

/**
 * Download a result image as an object-URL (blob).
 * type: "counting" | "size_annotated" | "size_colored" | "heatmap"
 */
export async function getResultImageBlob(jobId, type) {
  const res = await fetch(`${COMPUTE_API}/download/${jobId}/${type}`);
  if (!res.ok) throw new Error("Could not fetch result image");
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

// ---------------------------------------------------------------------------
// Milestone verification
// ---------------------------------------------------------------------------

/**
 * Trigger multi-source ML verification for a milestone.
 * Returns { status, verdict, overall_confidence, recommendation, report }.
 */
export async function verifyMilestone(milestoneId) {
  const res = await fetch(`${COMPUTE_API}/api/v1/verify-milestone`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ milestone_id: milestoneId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Verification failed (${res.status})`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Result caching (Supabase — generic ml_results table)
// ---------------------------------------------------------------------------

/**
 * Check for cached ML results for a specific flight and model.
 * Returns the most recent result row, or null.
 * The model-specific output lives in result_data (JSONB).
 */
export async function getCachedResults(
  flightId,
  modelId = "wheat_plant_counter_v1"
) {
  const { data, error } = await supabase
    .from("ml_results")
    .select("*")
    .eq("flight_id", flightId)
    .eq("model_id", modelId)
    .order("analyzed_at", { ascending: false })
    .limit(1);
  if (error) {
    console.warn("Cache lookup failed:", error.message);
    return null;
  }
  return data?.[0] || null;
}

/**
 * Persist ML results to the generic cache table.
 * `result` is the raw model output — stored as-is in result_data JSONB.
 */
export async function saveResults({
  farmId,
  flightId,
  layerId,
  jobId,
  filename,
  result,
  modelId = "wheat_plant_counter_v1",
}) {
  const { error } = await supabase.from("ml_results").insert({
    farm_id: farmId,
    flight_id: flightId || null,
    layer_id: layerId || null,
    job_id: jobId || null,
    model_id: modelId,
    image_filename: filename,
    result_data: result,
    processing_time_seconds: result.processing_time_seconds,
    analyzed_at: new Date().toISOString(),
  });
  if (error) console.warn("Could not save ML results:", error.message);
}
