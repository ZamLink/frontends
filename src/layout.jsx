// src/components/MainLayout.jsx
import React from "react";
import Sidebar from "./sidebar";
import Header from "./head";
import "./layout.css";

const MainLayout = ({ children }) => {
  return (
    <div className="main-layout">
      <Sidebar />
      <div className="main-layout-content">
        <Header />
        <main>
          {children}
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
