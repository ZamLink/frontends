// src/components/Navbar.jsx
import React from "react";
// Import useLocation along with Link
import { Link, useLocation } from "react-router-dom";
import "./navbar.css";
import logo from "./assets/Image_fx.png";

const Navbar = () => {
  const location = useLocation();

  return (
    <header className="header">
      <div className="header-content">
        <Link to="/" className="logo-container">
          <img className="logo-img" src={logo} alt="AgriPay" />
          <h1 className="logo-text">AgriPay</h1>
        </Link>
        <nav className="nav">
          <a className="nav-link" href="#">
            About
          </a>
          <a className="nav-link" href="#">
            Contact
          </a>

          {location.pathname === "/signup" ? (
            // If it is, show the Log In button
            <Link to="/login" className="signup-btn">
              Log In
            </Link>
          ) : (
            // Otherwise, show the Sign Up button
            <Link to="/signup" className="signup-btn">
              Sign Up
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
};

export default Navbar;
