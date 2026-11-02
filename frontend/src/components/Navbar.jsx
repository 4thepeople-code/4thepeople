import React from "react";
import { Link } from "react-router-dom";

function Navbar() {
  return (
    <nav className="flex justify-between items-center bg-gray-800 p-4 text-white">
      <h1 className="text-xl font-bold">My Dashboard</h1>
      <div className="space-x-4">
        <Link to="/" className="hover:text-gray-300">Home</Link>
        <Link to="/clubs" className="hover:text-gray-300">Clubs</Link>
        <Link to="/departments" className="hover:text-gray-300">Departments</Link>
        <Link to="/signup" className="hover:text-gray-300">Signup</Link>
        <Link to="/signin" className="hover:text-gray-300">Signin</Link>
        <Link to="/dashboard" className="hover:text-gray-300">Dashboard</Link>
      </div>
    </nav>
  );
}

export default Navbar;
