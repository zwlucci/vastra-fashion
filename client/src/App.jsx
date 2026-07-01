import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout.jsx";
import { ProtectedRoute, RoleProtectedRoute } from "./components/ProtectedRoute.jsx";
import { Account } from "./pages/Account.jsx";
import { AdminDashboard } from "./pages/AdminDashboard.jsx";
import { AdminWardrobe } from "./pages/AdminWardrobe.jsx";
import { Cart } from "./pages/Cart.jsx";
import { Contact } from "./pages/Contact.jsx";
import { Home } from "./pages/Home.jsx";
import { Login } from "./pages/Login.jsx";
import { Messages } from "./pages/Messages.jsx";
import { Orders } from "./pages/Orders.jsx";
import { ProductDetail } from "./pages/ProductDetail.jsx";
import { Register } from "./pages/Register.jsx";
import { Shop } from "./pages/Shop.jsx";
import { VendorDashboard } from "./pages/VendorDashboard.jsx";
import { VendorProfile } from "./pages/VendorProfile.jsx";
import { VerifyEmail } from "./pages/VerifyEmail.jsx";
import { Wishlist } from "./pages/Wishlist.jsx";
import { Wardrobe } from "./pages/Wardrobe.jsx";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="/shop" element={<Shop />} />
        <Route path="/shop/:id" element={<ProductDetail />} />
        <Route path="/vendors/:id" element={<VendorProfile />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/profile" element={<Account />} />
        <Route path="/account" element={<Navigate to="/profile" replace />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/wishlist" element={<Wishlist />} />
        <Route path="/wardrobe" element={<Wardrobe />} />
        <Route path="/messages" element={<Messages />} />
        <Route path="/orders" element={<ProtectedRoute><Orders /></ProtectedRoute>} />
        <Route path="/vendor/dashboard" element={<RoleProtectedRoute roles={["vendor"]}><VendorDashboard /></RoleProtectedRoute>} />
        <Route path="/admin/dashboard" element={<RoleProtectedRoute roles={["admin"]}><AdminDashboard /></RoleProtectedRoute>} />
        <Route path="/admin/wardrobe" element={<RoleProtectedRoute roles={["admin"]}><AdminWardrobe /></RoleProtectedRoute>} />
      </Route>
    </Routes>
  );
}
