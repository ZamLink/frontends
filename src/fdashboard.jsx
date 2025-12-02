// src/pages/DashboardPage.jsx
import React from "react";
import Sidebar from "./sidebar";
import "./dashboard.css";
import Modal from "./modal";
import { useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";

// src/pages/DashboardPage.jsx
import { useState, useEffect } from "react";
import { supabase } from "./createclient"; // Import supabase client
import Spinner from "./spinner";
import { toast } from "react-hot-toast";
import { isVerified, normalizeStatus, MILESTONE_STATUSES } from "./utils/statusHelpers";
import { getMapboxStaticImageUrl } from "./utils/geometryHelpers";
const DashboardPage = () => {
  // State to hold the user's profile and loading status
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false); // State for modal
  const navigate = useNavigate(); // Hook for navigation
  const [farms, setFarms] = useState([]);
  const [farmSummary, setFarmSummary] = useState({ count: 0, totalAcreage: 0 });
  const [milestoneSummary, setMilestoneSummary] = useState({
    upcoming: [],
    progress: 0,
  });
  const [payments, setPayments] = useState([]);
  const [farmImages, setFarmImages] = useState({ first: null, second: null });
  const mapboxApiKey = import.meta.env.VITE_MAPBOX_API_KEY;

  // useEffect to fetch data when the component mounts
  // useEffect(() => {
  //   const fetchUserProfile = async () => {
  //     try {
  //       // 1. Get the current user session
  //       const {
  //         data: { session },
  //       } = await supabase.auth.getSession();

  //       if (session) {
  //         // 2. Query the 'profiles' table with the user's ID
  //         const { data, error } = await supabase
  //           .from("profiles")
  //           .select("full_name") // We only need the full_name column
  //           .eq("id", session.user.id) // Match the row to the logged-in user
  //           .single(); // We expect only one result

  //         if (error) {
  //           throw error;
  //         }

  //         if (data) {
  //           // 3. Set the user profile in state
  //           setUserProfile(data);
  //         }
  //       }
  //     } catch (error) {
  //       console.error("Error fetching user profile:", error.message);
  //     } finally {
  //       // 4. Set loading to false once fetching is complete
  //       setLoading(false);
  //     }
  //   };
  //   const fetchFarms = async () => {
  //     const { data, error } = await supabase.from("farms").select("id, name");
  //     if (data) setFarms(data);
  //   };
  //   fetchFarms();

  //   fetchUserProfile();
  // }, []); // The empty array ensures this effect runs only once on mount

  // Extract the first name from the full_name
  const getFirstName = () => {
    if (!userProfile || !userProfile.full_name) {
      return "User"; // Return a default value if name isn't available
    }
    return userProfile.full_name.split(" ")[0];
  };
  const handleLogout = async () => {
    try {
      // Use Supabase client to sign out
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      // Redirect the user to the login page
      navigate("/login");
    } catch (error) {
      // alert(error.message);
      toast.error(error.message);
    }
  };
  // useEffect(() => {
  //   const fetchDashboardData = async () => {
  //     try {
  //       // Fetch user profile (as before)
  //       const {
  //         data: { session },
  //       } = await supabase.auth.getSession();
  //       if (session) {
  //         const { data, error } = await supabase
  //           .from("profiles")
  //           .select("full_name")
  //           .eq("id", session.user.id)
  //           .single();
  //         if (error) throw error;
  //         if (data) setUserProfile(data);
  //       }

  //       // Fetch all farms to calculate summary
  //       const { data: farms, error: farmsError } = await supabase
  //         .from("farms")
  //         .select("location_data");
  //       if (farmsError) throw farmsError;

  //       if (farms) {
  //         let totalMeters = 0;
  //         farms.forEach((farm) => {
  //           if (farm.location_data) {
  //             // Convert our coordinates to the format Turf.js expects: [[lng, lat], ...]
  //             const coords = farm.location_data.map((p) => [p.lng, p.lat]);
  //             // Ensure polygon is closed for accurate calculation
  //             if (
  //               coords.length > 2 &&
  //               (coords[0][0] !== coords[coords.length - 1][0] ||
  //                 coords[0][1] !== coords[coords.length - 1][1])
  //             ) {
  //               coords.push(coords[0]);
  //             }
  //             const poly = turfPolygon([coords]);
  //             totalMeters += turfArea(poly);
  //           }
  //         });
  //         // Convert square meters to acres (1 acre ≈ 4046.86 sq meters)
  //         const totalAcres = totalMeters / 4046.86;
  //         setFarmSummary({
  //           count: farms.length,
  //           totalAcreage: totalAcres.toFixed(1),
  //         });
  //       }
  //     } catch (error) {
  //       console.error("Error fetching dashboard data:", error.message);
  //     } finally {
  //       setLoading(false);
  //     }
  //     const { data: milestones, error } = await supabase
  //       .from("cycle_milestones")
  //       .select(
  //         `
  //                   status,
  //                   crop_cycles ( farms (id, name) )
  //               `
  //       )
  //       .eq("crop_cycles.is_active", true);

  //     if (milestones) {
  //       const completed = milestones.filter(
  //         (m) => m.status === "Completed"
  //       ).length;
  //       const total = milestones.length;
  //       const progress = total > 0 ? (completed / total) * 100 : 0;

  //       // For simplicity, just show all non-completed as upcoming for now
  //       const upcoming = milestones.filter((m) => m.status !== "Completed");

  //       setMilestoneSummary({ upcoming, progress: progress.toFixed(0) });
  //     }
  //   };

  //   fetchDashboardData();
  // }, []);
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        // Get the current user's session first
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!session?.user) {
          // If no user, no need to fetch anything else
          setLoading(false);
          return;
        }
        const userId = session.user.id;

        // --- Fetch all data in parallel ---
        const [profileRes, farmsRes, farmsWithBoundaryRes, milestonesRes, paymentsRes] = await Promise.all([
          supabase
            .from("profiles")
            .select("full_name")
            .eq("id", userId)
            .single(),
          // Use stored area_hectares instead of calculating from location_data
          supabase.from("farms").select("id, area_hectares").eq("user_id", userId),
          // Fetch farms with GeoJSON boundaries for map images
          supabase.rpc('get_user_farms_geojson'),
          supabase
            .from("cycle_milestones")
            .select(
              `
                            id,
                            status,
                            crop_cycles!inner(farms(id, name)),
                            milestone_templates(name)
                        `
            )
            .eq("crop_cycles.user_id", userId)
            .eq("crop_cycles.is_active", true),
          // Query for verified milestones using status enum instead of is_verified
          supabase
            .from("cycle_milestones")
            .select(
              `
                            id,
                            updated_at,
                            crop_cycles!inner(
                              farms(name)
                            )
                        `
            )
            .eq("crop_cycles.user_id", userId)
            .eq("status", "verified")  // Use status enum instead of is_verified
            .order("updated_at", { ascending: false })
            .limit(5),
        ]);

        // Process Profile
        if (profileRes.error) throw profileRes.error;
        setUserProfile(profileRes.data);

        // Process Farms for Summary - use stored area_hectares
        if (farmsRes.error) throw farmsRes.error;
        if (farmsRes.data) {
          // Sum up area_hectares and convert to acres
          const totalHectares = farmsRes.data.reduce(
            (sum, farm) => sum + (farm.area_hectares || 0), 
            0
          );
          const totalAcres = totalHectares * 2.471; // 1 hectare = 2.471 acres
          setFarmSummary({
            count: farmsRes.data.length,
            totalAcreage: totalAcres.toFixed(1),
          });
        }

        // Process Farm Images from boundary GeoJSON
        if (!farmsWithBoundaryRes.error && farmsWithBoundaryRes.data && mapboxApiKey) {
          const farmsWithBoundary = farmsWithBoundaryRes.data;
          if (farmsWithBoundary.length > 0) {
            // Get first farm's boundary for the first card image
            const firstFarm = farmsWithBoundary[0];
            let firstImageUrl = null;
            if (firstFarm.boundary_geojson) {
              try {
                let geom = firstFarm.boundary_geojson;
                if (typeof geom === 'string') geom = JSON.parse(geom);
                firstImageUrl = getMapboxStaticImageUrl(geom, mapboxApiKey, { width: 400, height: 200 });
              } catch (e) {
                console.warn('Failed to generate first farm image:', e);
              }
            }

            // Get second farm (or reuse first) for second card image
            const secondFarm = farmsWithBoundary.length > 1 ? farmsWithBoundary[1] : firstFarm;
            let secondImageUrl = null;
            if (secondFarm.boundary_geojson) {
              try {
                let geom = secondFarm.boundary_geojson;
                if (typeof geom === 'string') geom = JSON.parse(geom);
                secondImageUrl = getMapboxStaticImageUrl(geom, mapboxApiKey, { width: 400, height: 200 });
              } catch (e) {
                console.warn('Failed to generate second farm image:', e);
              }
            }

            setFarmImages({ first: firstImageUrl, second: secondImageUrl });
          }
        }

        // Process Milestones for Summary - use new status values
        if (milestonesRes.error) throw milestonesRes.error;
        if (milestonesRes.data) {
          const milestones = milestonesRes.data;
          // Count verified milestones using the helper function
          const verified = milestones.filter(
            (m) => isVerified(m.status)
          ).length;
          const total = milestones.length;
          const progress = total > 0 ? (verified / total) * 100 : 0;
          // Upcoming = not verified (includes not_started, in_progress, pending_verification)
          const upcoming = milestones.filter((m) => !isVerified(m.status));
          setMilestoneSummary({ upcoming, progress: progress.toFixed(0) });
        }

        // Process Payments
        if (paymentsRes.error) throw paymentsRes.error;
        if (paymentsRes.data) {
          setPayments(paymentsRes.data);
        }
      } catch (error) {
        console.error("Error fetching dashboard data:", error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  //this one good
  // useEffect(() => {
  //   const fetchDashboardData = async () => {
  //     try {
  //       // --- Part 1: Fetch User Profile ---
  //       const {
  //         data: { session },
  //       } = await supabase.auth.getSession();
  //       if (session?.user) {
  //         const { data: profileData, error: profileError } = await supabase
  //           .from("profiles")
  //           .select("full_name")
  //           .eq("id", session.user.id)
  //           .single();
  //         if (profileError) throw profileError;
  //         setUserProfile(profileData);
  //       }

  //       // --- Part 2: Fetch Farms for Summary ---
  //       const { data: farms, error: farmsError } = await supabase
  //         .from("farms")
  //         .select("location_data");
  //       if (farmsError) throw farmsError;

  //       if (farms) {
  //         let totalMeters = 0;
  //         farms.forEach((farm) => {
  //           if (farm.location_data?.length > 2) {
  //             const coords = farm.location_data.map((p) => [p.lng, p.lat]);
  //             if (
  //               coords[0][0] !== coords[coords.length - 1][0] ||
  //               coords[0][1] !== coords[coords.length - 1][1]
  //             ) {
  //               coords.push(coords[0]);
  //             }
  //             totalMeters += turfArea(turfPolygon([coords]));
  //           }
  //         });
  //         const totalAcres = totalMeters / 4046.86;
  //         setFarmSummary({
  //           count: farms.length,
  //           totalAcreage: totalAcres.toFixed(1),
  //         });
  //       }

  //       // --- Part 3: Fetch Milestones for Summary ---
  //       const { data: milestones, error: milestonesError } = await supabase
  //         .from("cycle_milestones")
  //         .select(
  //           `
  //                       id,
  //                       status,
  //                       crop_cycles!inner ( is_active, farms (id, name) ),
  //                       milestone_templates ( name )
  //                   `
  //         )
  //         .eq("crop_cycles.is_active", true);

  //       if (milestonesError) throw milestonesError;

  //       if (milestones) {
  //         const completed = milestones.filter(
  //           (m) => m.status === "Completed"
  //         ).length;
  //         const total = milestones.length;
  //         const progress = total > 0 ? (completed / total) * 100 : 0;

  //         const upcoming = milestones.filter((m) => m.status !== "Completed");
  //         setMilestoneSummary({ upcoming, progress: progress.toFixed(0) });
  //       }
  //     } catch (error) {
  //       console.error("Error fetching dashboard data:", error.message);
  //     } finally {
  //       setLoading(false); // Only set loading to false after ALL data is fetched
  //     }
  //   };

  //   fetchDashboardData();
  // }, []);

  // Show a loading indicator while fetching data
  if (loading) {
    return (
      <div className="dashboard-container">
        <Sidebar />
        <main className="dashboard-main">
          <Spinner></Spinner>
        </main>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <Sidebar />
      <main className="dashboard-main">
        <header className="dashboard-header">
          <div>
            <h1 className="dashboard-title">Dashboard</h1>
            {/* Display the fetched first name */}
            <p className="dashboard-subtitle">Welcome back, {getFirstName()}</p>
          </div>
          <div className="header-actions">
            <button
              className="add-farm-btn"
              onClick={() => setIsModalOpen(true)}
            >
              <span className="material-symbols-outlined">add</span>
              Add New Farm
            </button>
            {/* --- NEW LOGOUT BUTTON --- */}
            <button className="logout-btn" onClick={handleLogout}>
              <span className="material-symbols-outlined">logout</span>
              Logout
            </button>
          </div>
        </header>
        <section className="dashboard-section">
          <h2 className="section-title">Farm Summary</h2>
          <div className="summary-cards">
            <div className="summary-card">
              <div>
                <p className="card-label">Total Farms</p>
                <p className="card-value">{farmSummary.count}</p>
                <p className="card-description">
                  Manage your farms and their details
                </p>
              </div>
              <img
                src={farmImages.first || "https://images.unsplash.com/photo-1500382017468-9049fed747ef?q=80&w=400"}
                alt="Farm landscape"
              />
            </div>
            <div className="summary-card">
              <div>
                <p className="card-label">Total Acreage</p>
                <p className="card-value">{farmSummary.totalAcreage} acres</p>
                <p className="card-description">Total land under cultivation</p>
              </div>
              <img
                src={farmImages.second || "https://images.unsplash.com/photo-1444930694458-01bab732b857?q=80&w=400"}
                alt="Aerial farm view"
              />
            </div>
          </div>
        </section>

        {/* The rest of your dashboard content remains the same */}
        {/* <section className="dashboard-section">
          <h2 className="section-title">Farm Summary</h2>
          <div className="summary-cards">
            <div className="summary-card">
              <div>
                <p className="card-label">Total Farms</p>
                <p className="card-value">3</p>
                <p className="card-description">
                  Manage your farms and their details
                </p>
              </div>
              <img
                src="https://via.placeholder.com/100x60"
                alt="Farm landscape"
              />
            </div>
            <div className="summary-card">
              <div>
                <p className="card-label">Total Acreage</p>
                <p className="card-value">150 acres</p>
                <p className="card-description">Total land under cultivation</p>
              </div>
              <img
                src="https://via.placeholder.com/100x60"
                alt="Aerial farm view"
              />
            </div>
          </div>
        </section> */}
        {/* <section className="dashboard-section">
          <h2 className="section-title">Your Farms</h2>
          <div className="farms-list">
            {farms.length > 0 ? (
              farms.map((farm) => (
                // The structure inside the Link is updated
                <Link
                  to={`/farm/${farm.id}`}
                  key={farm.id}
                  className="farm-card-link"
                >
                  <div className="farm-card-content">
                    <h3>{farm.name}</h3>
                    <p>
                      View Details
                      <span className="material-symbols-outlined">
                        arrow_forward
                      </span>
                    </p>
                  </div>
                </Link>
              ))
            ) : (
              <div className="no-farms-message">
                <p>You haven't added any farms yet.</p>
                <p>Click "Add New Farm" to get started.</p>
              </div>
            )}
          </div>
        </section> */}

        <section className="dashboard-section">
          <h2 className="section-title">Overall Milestone Progress</h2>
          <div className="progress-card">
            <div className="progress-details">
              <span>{milestoneSummary.progress}% Complete</span>
            </div>
            <div className="main-progress-bar-container">
              <div
                className="main-progress-bar"
                style={{ width: `${milestoneSummary.progress}%` }}
              ></div>
            </div>
          </div>
        </section>

        {/* UPCOMING MILESTONES (Replaces old static table) */}
        <section className="dashboard-section">
          <h2 className="section-title">Upcoming Milestones</h2>
          {milestoneSummary.upcoming.length > 0 ? (
            <div className="table-card">
              {/* You can build a table here similar to the old one */}
              {/* For now, a simple list: */}
              <ul>
                {milestoneSummary.upcoming.slice(0, 5).map((m) => (
                  <li key={m.id}>
                    {m.crop_cycles.farms.name} - {m.milestone_templates?.name || "Unnamed Milestone"}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p>No upcoming milestones!</p>
          )}
        </section>

        <section className="dashboard-section">
          <h2 className="section-title">Payment Status</h2>
          <div className="table-card">
            <table>
              <thead>
                <tr>
                  <th>Farm</th>
                  <th>Milestone</th>
                  <th>Status</th>
                  <th>Payment Date</th>
                </tr>
              </thead>
              <tbody>
                {payments.length > 0 ? (
                  payments.map((payment) => (
                    <tr key={payment.id}>
                      <td>{payment.crop_cycles?.farms?.name || "N/A"}</td>
                      <td>Milestone Verified</td>
                      <td>
                        <span className="status-pill paid">Paid</span>
                      </td>
                      <td>
                        {new Date(payment.updated_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" style={{ textAlign: "center" }}>
                      No payments processed yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <div className="modal-body">
          <h2>How would you like to add your farm?</h2>
          <p>Choose a method to define your farm's boundaries.</p>
          <div className="modal-options">
            <button
              className="modal-option-btn"
              onClick={() => navigate("/create-farm")}
            >
              <span className="material-symbols-outlined">edit</span>
              Draw Polygon on Map
            </button>
            <button
              className="modal-option-btn"
              onClick={() => navigate("/upload-kml")}
            >
              <span className="material-symbols-outlined">upload_file</span>
              Enter Coordinates (KML)
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default DashboardPage;
