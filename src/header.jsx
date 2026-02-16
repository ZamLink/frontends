import React from "react";
import logo from "./assets/Image_fx.png";

const Header = () => {
  return (
    <header className="w-full px-4 sm:px-6 lg:px-8">
      <div className="container mx-auto flex items-center justify-between py-4 border-b border-primary/20 dark:border-primary/30">
        <div className="flex items-center gap-3">
          <img className="w-8 h-8" src={logo} alt="AgriPay" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            AgriPay
          </h1>
        </div>
        <nav className="hidden md:flex items-center gap-6">
          <a
            className="text-sm font-medium hover:text-primary transition-colors"
            href="#"
          >
            About
          </a>
          <a
            className="text-sm font-medium hover:text-primary transition-colors"
            href="#"
          >
            Contact
          </a>
          <button className="px-4 py-2 text-sm font-semibold rounded-lg bg-primary/20 hover:bg-primary/30 dark:bg-primary/30 dark:hover:bg-primary/40 text-gray-800 dark:text-white transition-colors">
            Sign Up
          </button>
        </nav>
        <button className="md:hidden flex items-center justify-center p-2 rounded-lg hover:bg-primary/20 dark:hover:bg-primary/30">
          <span className="material-symbols-outlined">menu</span>
        </button>
      </div>
    </header>
  );
};

export default Header;
